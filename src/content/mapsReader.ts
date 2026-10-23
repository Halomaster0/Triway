// Reads route information from Google Maps. Google offers no extension API,
// so everything here is scraping: keep all selectors and text patterns in
// this file so they are easy to fix when Maps changes.
import { regionAgency } from "../core/geo";
import type { Agency, LatLng, RouteInfo, TransitLeg, TravelMode, TripOption } from "../core/types";

const MODE_CODES: Record<string, TravelMode> = { "0": "driving", "1": "cycling", "2": "walking", "3": "transit" };

/** Origin, destination and travel mode from a /maps/dir/ URL. */
export function parseMapsUrl(href: string): Pick<RouteInfo, "mode" | "origin" | "destination"> {
  const url = decodeURIComponent(href);
  const points: LatLng[] = [];
  // Each waypoint is encoded as !1d<lng>!2d<lat>.
  for (const m of url.matchAll(/!1d(-?\d+(?:\.\d+)?)!2d(-?\d+(?:\.\d+)?)/g)) {
    points.push({ lng: Number(m[1]), lat: Number(m[2]) });
  }
  const modeMatch = url.match(/!3e(\d)/);
  return {
    mode: modeMatch ? (MODE_CODES[modeMatch[1]] ?? "unknown") : "unknown",
    origin: points[0] ?? null,
    destination: points.length > 1 ? points[points.length - 1] : null,
  };
}

export function parseDurationMin(text: string): number | null {
  const m = text.match(/(?:(\d+)\s*(?:hr|h|hours?)\b)?\s*(?:(\d+)\s*min)/i) ?? text.match(/(\d+)\s*(?:hr|h|hours?)\b/i);
  if (!m) return null;
  if (m.length === 2) return Number(m[1]) * 60;
  return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
}

export function parseDistanceKm(text: string): number | null {
  const km = text.match(/(\d+(?:[.,]\d+)?)\s*km\b/i);
  if (km) return Number(km[1].replace(",", "."));
  const m = text.match(/(\d+)\s*m\b/);
  return m ? Number(m[1]) / 1000 : null;
}

// Names Google Maps shows for lines and agencies, in trip summaries or details.
// Case-sensitive on purpose: "GO" must not match the English word "go".
// GO rail lines appear as their short codes (LW, LE, KI, MI, BR, ST, RH).
const AGENCY_PATTERNS: Array<[Agency, RegExp]> = [
  ["GO", /\bGO Transit\b|\bGO\b|Lakeshore (?:West|East)|\b(?:LW|LE|KI|MI|BR|ST|RH)\b|\b(?:Kitchener|Milton|Barrie|Stouffville|Richmond Hill) [Ll]ine\b/g],
  ["TTC", /Toronto Transit Commission|\bTTC\b|\bLine [1-6]\b|Yonge[- ]University|Bloor[- ]Danforth|Eglinton Crosstown|Finch West/g],
  ["MiWay", /\bMiWay\b|Mississauga Transit|Hazel McCallion/g],
  ["Brampton", /Brampton Transit|\bZ[uü]m\b/g],
  ["YRT", /York Region Transit|\bYRT\b|\bViva\b/g],
  ["DRT", /Durham Region Transit|\bDRT\b|\bPULSE\b/g],
  ["HSR", /Hamilton Street Railway|\bHSR\b|\bB-Line\b/g],
];

// Vehicle words Maps uses as icon alt text / labels before a line name.
const VEHICLE = /^(Bus|Train|Subway|Metro|Tram|Streetcar|Light rail|Commuter train)$/i;
const LINE_NUMBER = /^\d{1,3}[A-Z]?$/;

interface Segment {
  agency: Agency | null;
  label: string;
  /** Minutes since midnight of the last clock time seen before this ride. */
  clock?: number;
}

/** A single clock time such as "2:21 PM", "2:21 p.m." or "14:21"; ranges return null. */
export function parseClock(token: string): number | null {
  if (/\d{1,2}:\d{2}.*[–—-]\s*\d{1,2}:\d{2}/.test(token)) return null;
  const m = token.match(/(?:^|\D)(\d{1,2}):(\d{2})(?:\s*([AaPp])\.?[Mm]\.?)?(?!\d)/);
  if (!m) return null;
  let h = Number(m[1]);
  if (m[3]) h = (h % 12) + (/p/i.test(m[3]) ? 12 : 0);
  return h * 60 + Number(m[2]);
}

// Stop names like "Clarkson GO" or "Bramalea GO Station" are places, not rides.
const GO_STATION_NAME = /^\S.*\sGO(?:\s(?:Station|Bus Terminal|Bus Stop))?$/;

function agencyOf(token: string): Agency | null {
  if (GO_STATION_NAME.test(token)) return null;
  for (const [agency, re] of AGENCY_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(token)) return agency;
  }
  return null;
}

// An agency name on its own, as Maps prints next to a bare line number.
const AGENCY_NAME_ONLY =
  /^(?:Toronto Transit Commission|TTC|GO Transit|GO|MiWay|Mississauga Transit|Brampton Transit|York Region Transit|YRT|Durham Region Transit|DRT|Hamilton Street Railway|HSR)$/;

const isBareAgencyName = (s: Segment) => s.agency !== null && AGENCY_NAME_ONLY.test(s.label);

/**
 * Transit legs, one per ride, in the order Maps lists them.
 *
 * Maps names rail lines ("Line 1", "LW", "GO") but often shows buses only as a
 * number after a "Bus" icon. Those get an agency by position: rides before the
 * first named one belong to the start area's agency, rides after the last
 * named one to the destination's, and rides in between to the nearest named
 * neighbour.
 */
export function detectLegs(
  text: string,
  origin: LatLng | null,
  destination: LatLng | null = null,
): { legs: TransitLeg[]; assumed: boolean } {
  const tokens = text.split("\n").map((t) => t.trim()).filter(Boolean);
  const segs: Segment[] = [];
  let vehicle: string | null = null;
  let clock: number | undefined;
  for (const token of tokens) {
    const c = parseClock(token);
    if (c !== null) clock = c;
    if (VEHICLE.test(token)) {
      vehicle = token;
      continue;
    }
    const last = segs[segs.length - 1];
    const agency = agencyOf(token);
    if (agency) {
      if (!vehicle && last && last.agency === null && AGENCY_NAME_ONLY.test(token)) last.agency = agency;
      else if (vehicle || !(last && last.agency === agency && (isBareAgencyName(last) || AGENCY_NAME_ONLY.test(token) || token === last.label))) {
        segs.push({ agency, label: token.length > 40 ? agency : token, clock });
      }
    } else if (LINE_NUMBER.test(token) && (vehicle || (last && isBareAgencyName(last)))) {
      if (!vehicle && last) last.label = `${last.label} ${token}`;
      else
        segs.push({
          agency: /train/i.test(vehicle ?? "") ? "GO" : /subway|metro/i.test(vehicle ?? "") ? "TTC" : null,
          label: `${vehicle} ${token}`,
          clock,
        });
    }
    vehicle = null;
  }

  const startAgency = regionAgency(origin);
  const endAgency = regionAgency(destination) ?? startAgency;
  const named = segs.map((s, i) => (s.agency ? i : -1)).filter((i) => i >= 0);
  let assumed = false;
  segs.forEach((s, i) => {
    if (s.agency) return;
    assumed = true;
    if (named.length === 0) s.agency = i === segs.length - 1 && i > 0 ? endAgency : startAgency;
    else if (i < named[0]) s.agency = startAgency ?? segs[named[0]].agency;
    else if (i > named[named.length - 1]) s.agency = endAgency ?? segs[named[named.length - 1]].agency;
    else {
      const prev = Math.max(...named.filter((n) => n < i));
      s.agency = segs[prev].agency;
    }
  });

  const kept = segs.filter((s) => s.agency);
  const legs: TransitLeg[] = kept.map((s) => ({ agency: s.agency!, label: s.label }));
  applyOffsets(
    legs,
    kept.map((s) => s.clock),
  );
  if (legs.length > 0) return { legs, assumed };
  return startAgency
    ? { legs: [{ agency: startAgency, label: `${startAgency} (assumed from start location)` }], assumed: true }
    : { legs, assumed: true };
}

/**
 * Sets each leg's start time relative to the first, but only when every ride
 * has its own, later departure time (as in Maps' details view). A trip card
 * shows one departure for the whole trip, so its rides stay unset and the
 * fare engine treats them as inside the transfer window.
 */
function applyOffsets(legs: TransitLeg[], clocks: Array<number | undefined>) {
  if (legs.length < 2 || clocks.some((c) => c === undefined)) return;
  const offsets = [0];
  for (let i = 1; i < clocks.length; i++) {
    let gap = clocks[i]! - clocks[i - 1]!;
    if (gap < 0) gap += 24 * 60; // past midnight
    if (gap === 0) return;
    offsets.push(offsets[i - 1] + gap);
  }
  legs.forEach((l, i) => (l.startOffsetMin = offsets[i]));
}

/**
 * Text of an element in document order, including image alt text and
 * aria-labels, which carry agency and line names. Parts are joined with
 * newlines because adjacent chips like "Line 1" and "GO" have no whitespace
 * between them in the DOM.
 */
export function elementText(el: Element): string {
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let n: Node | null = walker.currentNode; n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = n.textContent?.trim();
      if (t) parts.push(t);
    } else {
      const e = n as Element;
      const label = e.getAttribute("aria-label") ?? (e.tagName === "IMG" ? e.getAttribute("alt") : null);
      if (label) parts.push(label);
    }
  }
  return parts.join("\n");
}

export function parseTrip(text: string, mode: TravelMode, origin: LatLng | null, destination: LatLng | null = null): TripOption {
  return {
    km: mode === "transit" ? null : parseDistanceKm(text),
    minutes: parseDurationMin(text),
    legs: mode === "transit" ? detectLegs(text, origin, destination).legs : [],
    hasTolls: /\btoll/i.test(text),
    text,
  };
}

// Trip cards in the directions panel. Maps has used these ids for years, but
// not on every version of the page, so findTripCards() has a text fallback.
const TRIP_SELECTOR = 'div[id^="section-directions-trip-"]';
// The left-hand directions panel. Also holds the details of a selected transit trip.
const PANEL_SELECTOR = 'div[role="main"]';
// Plain textContent runs chips together ("32 min29.2 km"), so no \b after units.
const DURATION_RE = /\d+\s*(?:min|hr|h)(?![a-z])/;
const KM_RE = /\d+(?:[.,]\d+)?\s*km(?![a-z])/;
const TIME_RANGE_RE = /\d{1,2}:\d{2}\s*(?:[AaPp]\.?[Mm]\.?)?\s*[–—-]\s*\d{1,2}:\d{2}/;

/**
 * Trip option cards. Prefers Maps' ids; otherwise finds the smallest blocks
 * that hold a duration plus a distance (driving) or a time range (transit),
 * and widens each to the largest ancestor that holds no other trip.
 */
export function findTripCards(doc: Document, mode: TravelMode): Element[] {
  const byId = Array.from(doc.querySelectorAll(TRIP_SELECTOR));
  if (byId.length > 0) return byId;
  const root = doc.querySelector(PANEL_SELECTOR) ?? doc.body;
  if (!root) return [];
  const second = mode === "transit" ? TIME_RANGE_RE : KM_RE;
  const hits = Array.from(root.querySelectorAll("div")).filter((el) => {
    if (el.closest("#triway-root")) return false;
    const t = el.textContent ?? "";
    return DURATION_RE.test(t) && second.test(t);
  });
  const smallest = hits.filter((el) => !hits.some((o) => o !== el && el.contains(o)));
  return smallest.map((el) => {
    let card: Element = el;
    while (card.parentElement && card.parentElement !== root && smallest.filter((s) => card.parentElement!.contains(s)).length === 1) {
      card = card.parentElement;
    }
    return card;
  });
}

/** Travel mode from the selected mode button, for URLs that don't encode it. */
export function selectedMode(doc: Document): TravelMode {
  const selected = doc.querySelectorAll('[aria-checked="true"], [aria-pressed="true"], [aria-selected="true"]');
  for (const el of Array.from(selected)) {
    const label = `${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("data-tooltip") ?? ""}`;
    const code = el.getAttribute("data-travel_mode");
    if (code && MODE_CODES[code]) return MODE_CODES[code];
    if (/\bDriving\b/i.test(label)) return "driving";
    if (/\bTransit\b/i.test(label)) return "transit";
  }
  return "unknown";
}

export function readRoute(doc: Document, href: string): RouteInfo {
  const base = parseMapsUrl(href);
  let mode = base.mode === "unknown" ? selectedMode(doc) : base.mode;
  if (mode === "unknown") {
    const first = findTripCards(doc, "driving")[0];
    if (first) mode = KM_RE.test(first.textContent ?? "") ? "driving" : "transit";
  }
  const cards = findTripCards(doc, mode);
  let trips = cards.map((c) => parseTrip(elementText(c), mode, base.origin, base.destination));

  // On a selected transit trip Maps replaces the list with a details view.
  if (trips.length === 0 && mode === "transit") {
    const details = doc.querySelector(PANEL_SELECTOR);
    if (details) trips = [parseTrip(elementText(details), mode, base.origin, base.destination)];
  }
  return { ...base, mode, trips };
}

/** The same directions URL in transit mode, or null if the URL can't be rewritten safely. */
export function transitUrl(href: string): string | null {
  if (!href.includes("/maps/dir/")) return null;
  if (/!3e\d/.test(href)) return href.replace(/!3e\d/, "!3e3");
  if (href.includes("/data=")) return null;
  const [path, query] = href.split("?");
  return `${path.replace(/\/?$/, "/")}data=!4m2!4m1!3e3${query ? `?${query}` : ""}`;
}

/** Plain-text dump of what the reader sees, for bug reports. */
export function debugInfo(doc: Document, href: string): string {
  const r = readRoute(doc, href);
  const trips = findTripCards(doc, r.mode)
    .slice(0, 4)
    .map((c, i) => `--- trip ${i} ---\n${elementText(c).slice(0, 1500)}`);
  return [
    `Triway debug`,
    `URL: ${href}`,
    `Mode: ${r.mode}`,
    `Origin: ${JSON.stringify(r.origin)} Destination: ${JSON.stringify(r.destination)}`,
    `Parsed: ${JSON.stringify(r.trips.map(({ text, ...t }) => t))}`,
    ...trips,
  ].join("\n");
}

export function routeKey(r: Pick<RouteInfo, "origin" | "destination">): string | null {
  if (!r.origin || !r.destination) return null;
  const f = (p: LatLng) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
  return `${f(r.origin)}>${f(r.destination)}`;
}
