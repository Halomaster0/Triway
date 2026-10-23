import { riderCategory } from "../rider";
import { round2 } from "../fuel";
import type { Agency, FareCategory, RiderProfile, TransitLeg } from "../types";
import { GO_FARES, LOCAL_FARES } from "./fares";

/** What happens at one tap, in trip order. */
export interface FareLine {
  agency: Agency;
  label: string;
  /** Charged at this tap. */
  amount: number;
  note?: string;
  /** Local fare(s) paid earlier in the window and refunded at this tap (local → GO). */
  refund?: number;
  refundFrom?: Agency[];
}

export interface FareResult {
  total: number;
  category: FareCategory;
  lines: FareLine[];
  warnings: string[];
  /** True when any part is an estimate (GO distance fare, unverified data). */
  estimated: boolean;
}

export interface FareOptions {
  /** Total trip length in minutes, used to flag trips longer than a transfer window. */
  tripMinutes?: number | null;
  /** Distance to price GO legs with when the legs themselves carry no km. */
  goKmFallback?: number | null;
}

const DEFAULT_GO_KM = 30;

/** Adult PRESTO GO fare estimate for a ride of `km`. */
export function goAdultFare(km: number): number {
  const g = GO_FARES;
  if (km <= g.shortTripKm) return g.shortTripFare;
  const mid = Math.min(km, 40) - g.shortTripKm;
  const long = Math.max(0, km - 40);
  return round2(g.shortTripFare + mid * g.perKmTo40 + long * g.perKmAfter40);
}

export function goFare(km: number, category: FareCategory): number {
  if (category === "child") return 0;
  return round2(goAdultFare(km) * (1 - GO_FARES.discount[category]));
}

export function localFare(
  agency: Exclude<Agency, "GO">,
  category: FareCategory,
  rider: RiderProfile,
  warnings: string[],
): number {
  if (category === "child") return 0;
  if (agency === "Brampton" && category === "senior" && rider.bramptonResident) return 0;
  const a = LOCAL_FARES[agency];
  const v = a.fares[category];
  if (v === null) {
    const msg = `No ${category} fare on file for ${a.name}; using the adult fare.`;
    if (!warnings.includes(msg)) warnings.push(msg);
    return a.fares.adult ?? 0;
  }
  return v;
}

const LOCAL_WINDOW_MIN = 120;

interface OneFareWindow {
  kind: "local" | "go";
  start: number;
  /** Local fares charged in this window (refundable by a GO tap). */
  localPaid: number;
  localAgencies: Agency[];
  lastAgency: Agency;
}

/**
 * Prices a transit trip paid with PRESTO, tap by tap in trip order. Order
 * matters because each tap is priced against what was already paid in the
 * current transfer window.
 *
 * - Children 12 and under ride free everywhere.
 * - One Fare (TTC, GO, MiWay, Brampton, YRT, DRT):
 *   - Local then local, within 2 h of the first tap: pay once; a later tap on
 *     a pricier agency tops up the difference.
 *   - Local then GO, within 2 h of the first tap: the local fare is refunded
 *     at the GO tap and you pay the GO fare.
 *   - GO then local, within 3 h of boarding GO: the local ride is free.
 *   - Consecutive GO rides (train + GO bus) are one GO fare.
 * - HSR is outside One Fare: its own fare, free transfers within 2 h.
 * - Leg times come from `startOffsetMin`; legs without one count as inside the window.
 */
export function computeFare(legs: TransitLeg[], rider: RiderProfile, opts: FareOptions = {}): FareResult {
  const category = riderCategory(rider);
  const warnings: string[] = [];
  let estimated = false;
  if (legs.length === 0) return { total: 0, category, lines: [], warnings: ["No transit legs found."], estimated };

  const lines: FareLine[] = [];
  let win: OneFareWindow | null = null;
  let hsrStart: number | null = null;
  const inWindow = (w: OneFareWindow, t: number) =>
    t - w.start <= (w.kind === "go" ? GO_FARES.transferWindowMin : LOCAL_WINDOW_MIN);

  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const t = leg.startOffsetMin ?? 0;
    const prev = legs[i - 1];

    if (leg.agency === "HSR") {
      if (hsrStart !== null && t - hsrStart <= LOCAL_FARES.HSR.transferWindowMin) {
        lines.push({ agency: "HSR", label: leg.label, amount: 0, note: "Free transfer" });
      } else {
        hsrStart = t;
        lines.push({ agency: "HSR", label: leg.label, amount: localFare("HSR", category, rider, warnings) });
      }
      if (LOCAL_FARES.HSR.unverified) {
        estimated = true;
        const msg = "HSR fares are not verified for 2026.";
        if (!warnings.includes(msg)) warnings.push(msg);
      }
      continue;
    }

    if (leg.agency === "GO") {
      if (prev?.agency === "GO") {
        lines.push({ agency: "GO", label: leg.label, amount: 0, note: "Same GO fare" });
        continue;
      }
      // Price this GO trip on the run of consecutive GO rides starting here.
      let j = i;
      let legKm = 0;
      while (legs[j]?.agency === "GO") legKm += legs[j++].km ?? 0;
      let km = legKm || opts.goKmFallback || 0;
      if (!km) {
        km = DEFAULT_GO_KM;
        warnings.push(`GO trip distance unknown; assumed ${DEFAULT_GO_KM} km.`);
      }
      estimated = true;
      const line: FareLine = { agency: "GO", label: leg.label, amount: goFare(km, category), note: `≈ ${Math.round(km)} km distance fare` };
      if (win?.kind === "local" && inWindow(win, t) && win.localPaid > 0) {
        line.refund = win.localPaid;
        line.refundFrom = [...new Set(win.localAgencies)];
      }
      lines.push(line);
      win = { kind: "go", start: t, localPaid: 0, localAgencies: [], lastAgency: "GO" };
      continue;
    }

    const fare = localFare(leg.agency, category, rider, warnings);
    if (win && inWindow(win, t)) {
      if (win.kind === "go") {
        lines.push({ agency: leg.agency, label: leg.label, amount: 0, note: "Free with GO (One Fare)" });
      } else {
        const topUp = round2(Math.max(0, fare - win.localPaid));
        const note = topUp > 0 ? "One Fare top-up" : win.lastAgency === leg.agency ? "Free transfer" : "One Fare transfer";
        lines.push({ agency: leg.agency, label: leg.label, amount: topUp, note });
        win.localPaid = round2(win.localPaid + topUp);
        if (topUp > 0) win.localAgencies.push(leg.agency);
        win.lastAgency = leg.agency;
      }
    } else {
      lines.push({ agency: leg.agency, label: leg.label, amount: fare });
      win = { kind: "local", start: t, localPaid: fare, localAgencies: fare > 0 ? [leg.agency] : [], lastAgency: leg.agency };
    }
  }

  const known = legs.every((l) => l.startOffsetMin !== undefined);
  const firstWindow = legs[0].agency === "GO" ? GO_FARES.transferWindowMin : LOCAL_WINDOW_MIN;
  if (!known && opts.tripMinutes && opts.tripMinutes > firstWindow) {
    warnings.push(`Trip is longer than the ${firstWindow / 60}-hour transfer window; you may pay an extra fare.`);
  }
  if (category === "child") warnings.unshift("Children 12 and under ride free on all GTA agencies.");

  const total = round2(lines.reduce((s, l) => s + l.amount - (l.refund ?? 0), 0));
  return { total, category, lines, warnings, estimated };
}
