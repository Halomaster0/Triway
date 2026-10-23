// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  detectLegs,
  parseClock,
  findTripCards,
  selectedMode,
  transitUrl,
  parseDistanceKm,
  parseDurationMin,
  parseMapsUrl,
  readRoute,
  routeKey,
} from "../src/content/mapsReader";

export const DRIVE_URL =
  "https://www.google.com/maps/dir/Union+Station,+Toronto,+ON/Square+One,+Mississauga,+ON/@43.62,-79.51,12z/data=!3m1!4b1!4m14!4m13!1m5!1m1!1s0x0:0x1!2m2!1d-79.3806!2d43.6453!1m5!1m1!1s0x0:0x2!2m2!1d-79.6424!2d43.5931!3e0";
export const TRANSIT_URL = DRIVE_URL.replace("!3e0", "!3e3");

function loadFixture(name: string): Document {
  return new DOMParser().parseFromString(readFileSync(`tests/fixtures/${name}`, "utf8"), "text/html");
}

describe("URL parsing", () => {
  it("reads endpoints and travel mode", () => {
    const r = parseMapsUrl(DRIVE_URL);
    expect(r.mode).toBe("driving");
    expect(r.origin).toEqual({ lat: 43.6453, lng: -79.3806 });
    expect(r.destination).toEqual({ lat: 43.5931, lng: -79.6424 });
    expect(parseMapsUrl(TRANSIT_URL).mode).toBe("transit");
  });
  it("handles URLs without data", () => {
    expect(parseMapsUrl("https://www.google.com/maps/dir/A/B/")).toEqual({ mode: "unknown", origin: null, destination: null });
  });
  it("builds the same key for both modes", () => {
    expect(routeKey(parseMapsUrl(DRIVE_URL))).toBe(routeKey(parseMapsUrl(TRANSIT_URL)));
  });
});

describe("text parsing", () => {
  it.each([
    ["28 min", 28],
    ["1 hr 10 min", 70],
    ["2 h 5 min", 125],
    ["1 hr", 60],
    ["8:05 AM—9:02 AM 57 min", 57],
  ])("duration %s", (t, n) => expect(parseDurationMin(t)).toBe(n));

  it.each([
    ["27.6 km", 27.6],
    ["27,6 km", 27.6],
    ["850 m", 0.85],
    ["57 min", null],
  ])("distance %s", (t, n) => expect(parseDistanceKm(t)).toBe(n));
});

describe("agency detection", () => {
  it("returns one leg per ride in order", () => {
    const { legs } = detectLegs("Line 1\nLine 2\nGO\nLW\nMiWay\n19", null);
    expect(legs.map((l) => l.agency)).toEqual(["TTC", "TTC", "GO", "MiWay"]);
    expect(legs[3].label).toBe("MiWay 19");
  });
  it("assigns unnamed buses by position around named rides", () => {
    const UTM = { lat: 43.5483, lng: -79.6627 };
    const UNION = { lat: 43.6453, lng: -79.3806 };
    const text = "Walk\nBus\n110\nTrain\nLW\nBus\n504";
    const { legs, assumed } = detectLegs(text, UTM, UNION);
    expect(legs.map((l) => `${l.agency}:${l.label}`)).toEqual(["MiWay:Bus 110", "GO:LW", "TTC:Bus 504"]);
    expect(assumed).toBe(true);
  });
  it("gives a bus between two named rides its nearest named neighbour", () => {
    const { legs } = detectLegs("Line 2\nBus\n52\nViva Blue", null);
    expect(legs.map((l) => l.agency)).toEqual(["TTC", "TTC", "YRT"]);
  });
  it("uses the agency name that follows a bare line number", () => {
    const { legs } = detectLegs("Bus\n19\nMiWay\nSubway\nLine 1", null);
    expect(legs.map((l) => l.agency)).toEqual(["MiWay", "TTC"]);
  });
  it("ignores times and durations that look like numbers", () => {
    expect(detectLegs("8:05 AM—9:02 AM\n57\nLine 1", null).legs.map((l) => l.agency)).toEqual(["TTC"]);
  });
  it("does not treat the word 'go' as GO Transit", () => {
    expect(detectLegs("Let's go downtown via Line 4", null).legs.map((l) => l.agency)).toEqual(["TTC"]);
  });
  it("recognises 905 agencies", () => {
    const text = "Viva Blue\nZüm 502\nPULSE 900\nB-Line";
    expect(detectLegs(text, null).legs.map((l) => l.agency)).toEqual(["YRT", "Brampton", "DRT", "HSR"]);
  });
  it("falls back to the start location's agency", () => {
    const r = detectLegs("Bus 52", { lat: 43.6453, lng: -79.3806 });
    expect(r.assumed).toBe(true);
    expect(r.legs[0].agency).toBe("TTC");
  });
});

describe("readRoute on Maps-like DOM", () => {
  it("reads driving trips", () => {
    const r = readRoute(loadFixture("maps-driving.html"), DRIVE_URL);
    expect(r.mode).toBe("driving");
    expect(r.trips).toHaveLength(2);
    expect(r.trips[0]).toMatchObject({ km: 27.6, minutes: 28, hasTolls: true });
    expect(r.trips[1]).toMatchObject({ km: 31.2, minutes: 35, hasTolls: false });
  });
  it("reads transit trips and their agencies", () => {
    const r = readRoute(loadFixture("maps-transit.html"), TRANSIT_URL);
    expect(r.mode).toBe("transit");
    expect(r.trips[0].minutes).toBe(57);
    expect(r.trips[0].legs.map((l) => l.agency)).toEqual(["TTC", "GO", "MiWay"]);
    expect(r.trips[1].legs.map((l) => l.agency)).toEqual(["TTC", "MiWay"]);
  });
});

const UTM_URL =
  "https://www.google.com/maps/dir/University+of+Toronto+Mississauga/Union+Station/@43.6,-79.5,12z/data=!4m14!4m13!1m5!1m1!1s0x0:0x1!2m2!1d-79.6627!2d43.5483!1m5!1m1!1s0x0:0x2!2m2!1d-79.3806!2d43.6453!3e0";

describe("Maps markup without trip ids", () => {
  it("finds driving trips by their text and ignores map callouts", () => {
    const doc = loadFixture("maps-driving-noid.html");
    expect(findTripCards(doc, "driving")).toHaveLength(2);
    const r = readRoute(doc, UTM_URL);
    expect(r.trips.map((t) => [t.km, t.minutes])).toEqual([
      [29.2, 32],
      [29.4, 34],
    ]);
  });
  it("reads unnamed buses around GO and subway rides", () => {
    const r = readRoute(loadFixture("maps-transit-utm.html"), UTM_URL.replace("!3e0", "!3e3"));
    expect(r.trips[0].minutes).toBe(76);
    expect(r.trips[0].legs.map((l) => `${l.agency}:${l.label}`)).toEqual(["MiWay:Bus 110", "GO:LW", "TTC:Line 1"]);
    expect(r.trips[1].legs.map((l) => l.agency)).toEqual(["MiWay", "MiWay", "TTC"]);
  });
  it("reads the travel mode from the selected button", () => {
    const doc = new DOMParser().parseFromString(
      '<div><button aria-label="Driving" aria-checked="true"></button><button aria-label="Transit" aria-checked="false"></button></div>',
      "text/html",
    );
    expect(selectedMode(doc)).toBe("driving");
  });
});

describe("transit URL for the background read", () => {
  it("switches the mode code", () => expect(transitUrl(DRIVE_URL)).toBe(TRANSIT_URL));
  it("adds a mode to URLs without data", () =>
    expect(transitUrl("https://www.google.com/maps/dir/A/B/")).toBe("https://www.google.com/maps/dir/A/B/data=!4m2!4m1!3e3"));
  it("refuses URLs it can't rewrite safely", () => {
    expect(transitUrl("https://www.google.com/maps/dir/A/B/data=!4m2!4m1")).toBeNull();
    expect(transitUrl("https://www.google.com/maps/place/X")).toBeNull();
  });
});

describe("ride times", () => {
  it.each([
    ["2:21 PM", 14 * 60 + 21],
    ["12:05 a.m.", 5],
    ["12:30 PM from Union Station", 12 * 60 + 30],
    ["14:21", 14 * 60 + 21],
    ["2:15 PM—3:31 PM", null],
    ["Bus 110", null],
  ])("parses %s", (t, n) => expect(parseClock(t)).toBe(n));

  it("sets start offsets when every ride has its own departure", () => {
    const text = "2:21 PM\nUTM\nBus\n110\n2:44 PM\nClarkson GO\nTrain\nLW\n3:20 PM\nUnion Station\nSubway\nLine 1";
    expect(detectLegs(text, null).legs.map((l) => l.startOffsetMin)).toEqual([0, 23, 59]);
  });
  it("handles trips past midnight", () => {
    const text = "11:50 PM\nBus\n110\n12:20 AM\nTrain\nLW";
    expect(detectLegs(text, null).legs.map((l) => l.startOffsetMin)).toEqual([0, 30]);
  });
  it("leaves offsets unset on a trip card with one departure", () => {
    const text = "2:15 PM—3:31 PM\n2:21 PM from UTM\nBus\n110\nTrain\nLW";
    expect(detectLegs(text, null).legs.map((l) => l.startOffsetMin)).toEqual([undefined, undefined]);
  });
});
