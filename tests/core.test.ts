import { describe, expect, it } from "vitest";
import { buildEstimate, goKmEstimate } from "../src/core/estimate";
import { fuelCost, litresPer100 } from "../src/core/fuel";
import { haversineKm, regionAgency } from "../src/core/geo";
import { riderCategory } from "../src/core/rider";
import type { Settings } from "../src/core/types";
import { withDefaults } from "../src/shared/storage";
import { decodeCsv, parseNrcanCsv, titleCase } from "../scripts/build-vehicles";
import { pickResources } from "../scripts/fetch-nrcan";

const UNION = { lat: 43.6453, lng: -79.3806 };
const SQUARE_ONE = { lat: 43.5931, lng: -79.6424 };

describe("fuel", () => {
  it("computes litres and cost", () => {
    expect(fuelCost(100, 8, 1.5)).toEqual({ litres: 8, cost: 12 });
    expect(fuelCost(27.6, 8.6, 1.779).cost).toBe(4.22);
  });
  it("uses the rating matching the driving mix", () => {
    const v = { source: "database" as const, label: "x", city: 10, hwy: 7, comb: 8.6 };
    expect(litresPer100(v, "city")).toBe(10);
    expect(litresPer100(v, "highway")).toBe(7);
    expect(litresPer100(v, "combined")).toBe(8.6);
    expect(litresPer100({ source: "manual", label: "m", comb: 6 }, "city")).toBe(6);
  });
});

describe("rider category", () => {
  const base = { age: null, postSecondary: false, fairPass: false, bramptonResident: false };
  it.each([
    [{ age: 5 }, "child"],
    [{ age: 12 }, "child"],
    [{ age: 13 }, "youth"],
    [{ age: 19, postSecondary: true }, "youth"],
    [{ age: 20, postSecondary: true }, "postSecondary"],
    [{ age: 40, fairPass: true }, "fairPass"],
    [{ age: 65 }, "senior"],
    [{ age: 70, postSecondary: true }, "senior"],
    [{}, "adult"],
  ])("%o → %s", (p, cat) => expect(riderCategory({ ...base, ...p })).toBe(cat));
});

describe("geo", () => {
  it("measures Union to Square One", () => expect(haversineKm(UNION, SQUARE_ONE)).toBeCloseTo(21.8, 0));
  it("maps start points to local agencies", () => {
    expect(regionAgency(UNION)).toBe("TTC");
    expect(regionAgency(SQUARE_ONE)).toBe("MiWay");
    expect(regionAgency({ lat: 43.2557, lng: -79.8711 })).toBe("HSR");
    expect(regionAgency({ lat: 43.8971, lng: -78.8658 })).toBe("DRT");
    expect(regionAgency({ lat: 45.42, lng: -75.69 })).toBeNull();
  });
});

describe("estimate", () => {
  const settings: Settings = withDefaults({
    vehicle: { source: "manual", label: "My car", comb: 8 },
    gas: { mode: "manual", manualPrice: 1.5 },
    rider: { age: 30, postSecondary: false, fairPass: false, bramptonResident: false },
  });

  it("prices both modes from remembered route data", () => {
    const e = buildEstimate(
      { origin: UNION, destination: SQUARE_ONE, driveKm: 25, driveMinutes: 30, transitLegs: [{ agency: "TTC", label: "Line 2" }, { agency: "MiWay", label: "MiWay" }] },
      settings,
    );
    expect(e.drive?.cost).toBe(3);
    expect(e.drive?.kmEstimated).toBe(false);
    expect(e.transit?.total).toBe(3.5);
    expect(e.gas.source).toBe("manual");
  });

  it("falls back to straight-line distance and the local agency", () => {
    const e = buildEstimate({ origin: UNION, destination: SQUARE_ONE }, settings);
    expect(e.drive?.kmEstimated).toBe(true);
    expect(e.drive?.km).toBeCloseTo(27.3, 0);
    expect(e.transit?.legsAssumed).toBe(true);
    expect(e.transit?.total).toBe(3.3);
  });

  it("shows a pending state while transit is being checked", () => {
    const e = buildEstimate({ origin: UNION, destination: SQUARE_ONE, driveKm: 25, transitStatus: "pending" }, settings);
    expect(e.transit).toBeNull();
    expect(e.transitNote).toMatch(/Checking/);
  });

  it("prices GO on trip distance less local connections", () => {
    const legs = [
      { agency: "MiWay" as const, label: "Bus 110" },
      { agency: "GO" as const, label: "LW" },
      { agency: "TTC" as const, label: "Line 1" },
    ];
    expect(goKmEstimate(29.2, legs)).toBeCloseTo(23.2);
    expect(goKmEstimate(12, legs)).toBe(10);
    expect(goKmEstimate(null, legs)).toBeNull();
    const e = buildEstimate({ origin: UNION, destination: SQUARE_ONE, driveKm: 29.2, transitLegs: legs }, settings);
    expect(e.transit?.lines.map((l) => l.amount)).toEqual([3.5, 6.16, 0]);
    expect(e.transit?.lines[1].refund).toBe(3.5);
    expect(e.transit?.total).toBe(6.16);
    expect(e.transitNeedsTab).toBe(false);
  });

  it("asks for a car when none is set", () => {
    const e = buildEstimate({ origin: UNION, destination: SQUARE_ONE, driveKm: 10 }, withDefaults({}));
    expect(e.drive).toBeNull();
    expect(e.driveNote).toMatch(/Add your car/);
    expect(e.gas.source).toBe("auto");
  });
});

describe("NRCan CSV parsing", () => {
  it("reads data rows and skips headers and notes", () => {
    const csv = [
      "Model,Make,Model,Vehicle Class,Engine Size,Cylinders,Transmission,Fuel,Fuel Consumption,,,,CO2",
      "Year,,,,(L),,,Type,City (L/100 km),Hwy (L/100 km),Comb (L/100 km),Comb (mpg),(g/km)",
      '2022,Toyota,"Corolla, LE",Compact,1.8,4,AV,X,7.1,5.8,6.5,43,152',
      "Understanding the table,,,",
    ].join("\n");
    expect(parseNrcanCsv(csv)).toEqual([
      { year: 2022, make: "Toyota", model: "Corolla, LE", engine: 1.8, transmission: "AV", fuel: "X", city: 7.1, hwy: 5.8, comb: 6.5 },
    ]);
  });
});

describe("NRCan data refresh", () => {
  it("normalises all-caps makes but keeps acronyms", () => {
    expect(titleCase("ALFA ROMEO")).toBe("Alfa Romeo");
    expect(titleCase("MERCEDES-BENZ")).toBe("Mercedes-Benz");
    expect(titleCase("BMW")).toBe("BMW");
    expect(titleCase("Toyota")).toBe("Toyota");
  });
  it("reads Windows-1252 files", () => {
    expect(decodeCsv(Buffer.from([0x43, 0x69, 0x74, 0x72, 0x6f, 0xeb, 0x6e]))).toBe("Citroën");
  });
  it("keeps only conventional-vehicle CSVs", () => {
    const r = (name: string, format = "CSV", language = ["en"]) => ({ name, url: `https://x/${name}.csv`, format, language });
    const picked = pickResources([
      r("1995-2014 Fuel Consumption Ratings"),
      r("Original 1995-2014 Fuel Consumption Ratings (2-cycle)"),
      r("2025 Fuel Consumption Ratings"),
      r("2025 Fuel Consumption Ratings", "XLSX"),
      r("Battery-electric vehicles 2012-2025"),
      r("Plug-in hybrid electric vehicles 2012-2025"),
      r("Cotes de consommation 2025", "CSV", ["fr"]),
    ]);
    expect(picked.map((p) => p.name)).toEqual(["1995-2014 Fuel Consumption Ratings", "2025 Fuel Consumption Ratings"]);
  });
});
