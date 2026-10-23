import { describe, expect, it } from "vitest";
import { computeFare, goAdultFare, goFare } from "../src/core/fares/engine";
import type { Agency, RiderProfile, TransitLeg } from "../src/core/types";

const rider = (p: Partial<RiderProfile> = {}): RiderProfile => ({
  age: 30,
  postSecondary: false,
  fairPass: false,
  bramptonResident: false,
  ...p,
});
const legs = (...agencies: Agency[]): TransitLeg[] => agencies.map((agency) => ({ agency, label: agency }));
const total = (l: TransitLeg[], r: RiderProfile, opts = {}) => computeFare(l, r, opts).total;

describe("TTC single agency", () => {
  it("adult pays $3.30", () => expect(total(legs("TTC"), rider())).toBe(3.3));
  it("youth pays $2.35", () => expect(total(legs("TTC"), rider({ age: 16 }))).toBe(2.35));
  it("senior pays $2.25", () => expect(total(legs("TTC"), rider({ age: 70 }))).toBe(2.25));
  it("post-secondary pays adult fare per ride", () => expect(total(legs("TTC"), rider({ age: 21, postSecondary: true }))).toBe(3.3));
  it("Fair Pass pays $2.10", () => expect(total(legs("TTC"), rider({ fairPass: true }))).toBe(2.1));
  it("transfers within TTC are free", () => {
    const r = computeFare(legs("TTC", "TTC"), rider());
    expect(r.total).toBe(3.3);
    expect(r.lines[1].note).toBe("Free transfer");
  });
});

describe("children", () => {
  it("ride free on every agency", () => {
    const r = computeFare(legs("MiWay", "GO", "TTC", "HSR"), rider({ age: 8 }));
    expect(r.total).toBe(0);
    expect(r.category).toBe("child");
  });
});

describe("One Fare between local agencies", () => {
  it("TTC then MiWay: pay TTC, then top up to the MiWay fare", () => {
    const r = computeFare(legs("TTC", "MiWay"), rider());
    expect(r.total).toBe(3.5);
    expect(r.lines.map((l) => l.amount)).toEqual([3.3, 0.2]);
    expect(r.lines[1].note).toBe("One Fare top-up");
  });
  it("order matters: TTC then YRT tops up, YRT then TTC is free", () => {
    expect(computeFare(legs("TTC", "YRT"), rider()).lines.map((l) => l.amount)).toEqual([3.3, 0.94]);
    const r = computeFare(legs("YRT", "TTC"), rider());
    expect(r.lines.map((l) => l.amount)).toEqual([4.24, 0]);
    expect(r.lines[1].note).toBe("One Fare transfer");
  });
  it("MiWay, TTC, YRT pays the YRT fare once", () => expect(total(legs("MiWay", "TTC", "YRT"), rider())).toBe(4.24));
  it("youth DRT to TTC pays DRT youth fare", () => expect(total(legs("DRT", "TTC"), rider({ age: 15 }))).toBe(3.46));
});

describe("GO Transit", () => {
  it("short trips cost the $3.70 base fare", () => expect(goAdultFare(8)).toBe(3.7));
  it("matches the published Oakville–Union PRESTO fare at ~34 km", () => expect(goAdultFare(34)).toBe(8.16));
  it("tapers on long trips", () => expect(goAdultFare(60)).toBe(11.48));
  it("youth and post-secondary get 40% off", () => {
    expect(goFare(34, "youth")).toBe(4.9);
    expect(goFare(34, "postSecondary")).toBe(4.9);
  });
  it("seniors get 55% off", () => expect(goFare(34, "senior")).toBe(3.67));
  it("TTC connection is free with GO under One Fare", () => {
    const r = computeFare([{ agency: "TTC", label: "Line 1" }, { agency: "GO", label: "LW", km: 34 }], rider());
    expect(r.total).toBe(8.16);
    expect(r.estimated).toBe(true);
  });
  it("uses the fallback distance when legs carry none", () => {
    expect(total(legs("GO"), rider(), { goKmFallback: 8 })).toBe(3.7);
  });
  it("warns when no distance is known", () => {
    const r = computeFare(legs("GO"), rider());
    expect(r.warnings.join(" ")).toMatch(/assumed 30 km/);
  });
});

describe("ride order with GO", () => {
  const at = (agency: Agency, startOffsetMin: number, km?: number): TransitLeg => ({ agency, label: agency, startOffsetMin, km });

  it("bus then GO: the bus fare is charged, then refunded at the GO tap", () => {
    const r = computeFare([at("MiWay", 0), at("GO", 15, 26)], rider({ age: 17 }));
    expect(r.lines[0].amount).toBe(2.9);
    expect(r.lines[1]).toMatchObject({ amount: goFare(26, "youth"), refund: 2.9, refundFrom: ["MiWay"] });
    expect(r.total).toBe(goFare(26, "youth"));
  });
  it("bus then GO more than 2 hours later: no refund", () => {
    const r = computeFare([at("MiWay", 0), at("GO", 130, 26)], rider());
    expect(r.lines[1].refund).toBeUndefined();
    expect(r.total).toBe(3.5 + goAdultFare(26));
  });
  it("GO then bus within 3 hours: the bus is free", () => {
    const r = computeFare([at("GO", 0, 40), at("MiWay", 170)], rider());
    expect(r.lines[1]).toMatchObject({ amount: 0, note: "Free with GO (One Fare)" });
  });
  it("GO then bus after 3 hours: the bus is full fare", () => {
    expect(computeFare([at("GO", 0, 40), at("MiWay", 200)], rider()).lines[1].amount).toBe(3.5);
  });
  it("bus, GO, subway: one GO fare in total", () => {
    const r = computeFare([at("MiWay", 0), at("GO", 10, 26), at("TTC", 50)], rider());
    expect(r.lines.map((l) => l.amount)).toEqual([3.5, goAdultFare(26), 0]);
    expect(r.total).toBe(goAdultFare(26));
  });
  it("refunds a top-up too", () => {
    const r = computeFare([at("TTC", 0), at("YRT", 20), at("GO", 40, 30)], rider());
    expect(r.lines[2].refund).toBe(4.24);
    expect(r.lines[2].refundFrom).toEqual(["TTC", "YRT"]);
    expect(r.total).toBe(goAdultFare(30));
  });
});

describe("agency-specific rules", () => {
  it("MiWay seniors ride free", () => expect(total(legs("MiWay"), rider({ age: 66 }))).toBe(0));
  it("Brampton seniors pay $1.85 unless they live in Brampton", () => {
    expect(total(legs("Brampton"), rider({ age: 66 }))).toBe(1.85);
    expect(total(legs("Brampton"), rider({ age: 66, bramptonResident: true }))).toBe(0);
  });
  it("Fair Pass only discounts the TTC", () => expect(total(legs("YRT"), rider({ fairPass: true }))).toBe(4.24));
  it("HSR is charged on its own and flagged as unverified", () => {
    const r = computeFare([{ agency: "GO", label: "LW", km: 34 }, { agency: "HSR", label: "HSR 1" }], rider());
    expect(r.total).toBe(11.01);
    expect(r.warnings.join(" ")).toMatch(/HSR/);
  });
  it("falls back to the adult fare when a category is missing", () => {
    const r = computeFare(legs("HSR"), rider({ age: 16 }));
    expect(r.total).toBe(2.85);
    expect(r.warnings[0]).toMatch(/No youth fare/);
  });
});

describe("transfer windows", () => {
  it("charges again after the 2-hour window", () => {
    const l: TransitLeg[] = [
      { agency: "TTC", label: "a", startOffsetMin: 0 },
      { agency: "TTC", label: "b", startOffsetMin: 150 },
    ];
    expect(total(l, rider())).toBe(6.6);
  });
  it("GO's 3-hour window covers a late local connection", () => {
    const l: TransitLeg[] = [
      { agency: "GO", label: "LE", startOffsetMin: 0, km: 50 },
      { agency: "DRT", label: "DRT", startOffsetMin: 150 },
    ];
    expect(total(l, rider())).toBe(goAdultFare(50));
  });
  it("warns on long trips without leg times", () => {
    const r = computeFare(legs("TTC"), rider(), { tripMinutes: 150 });
    expect(r.warnings.join(" ")).toMatch(/transfer window/);
  });
});

it("handles an empty trip", () => {
  expect(computeFare([], rider()).total).toBe(0);
});
