import { describe, expect, it } from "vitest";
import { currentGasPrice } from "../src/core/estimate";
import { isNewerVersion, isStale, parseLiveGas } from "../src/shared/live";
import { withDefaults } from "../src/shared/storage";
import { parseGasCsv } from "../scripts/fetch-gas-price";
import bundled from "../src/data/gasPrice.json";

describe("live gas price", () => {
  const now = Date.UTC(2026, 9, 23);
  it("validates the fetched file", () => {
    expect(parseLiveGas({ regular: 1.729, date: "2026-10-20", region: "Toronto / GTA", source: "x" }, now)).toMatchObject({
      regular: 1.729,
      fetchedAt: now,
    });
    expect(parseLiveGas({ regular: 172.9, date: "2026-10-20" }, now)).toBeNull();
    expect(parseLiveGas({ regular: 1.7, date: "Oct 20" }, now)).toBeNull();
    expect(parseLiveGas(null, now)).toBeNull();
  });
  it("refreshes at most once a day", () => {
    expect(isStale(undefined, now)).toBe(true);
    expect(isStale(now - 60_000, now)).toBe(false);
    expect(isStale(now - 25 * 3600_000, now)).toBe(true);
  });
  it("prefers your price, then a newer live price, then the bundled one", () => {
    const live = { regular: 1.699, date: "2099-01-01", region: "", source: "", fetchedAt: now };
    expect(currentGasPrice(withDefaults({}), live)).toEqual({ price: 1.699, source: "auto", date: "2099-01-01" });
    expect(currentGasPrice(withDefaults({}), { ...live, date: "2000-01-01" }).price).toBe(bundled.regular);
    expect(currentGasPrice(withDefaults({}), null).price).toBe(bundled.regular);
    expect(currentGasPrice(withDefaults({ gas: { mode: "manual", manualPrice: 1.5 } }), live).price).toBe(1.5);
  });
});

describe("update check", () => {
  it.each([
    ["v0.3.0", "0.2.0", true],
    ["0.10.0", "0.9.9", true],
    ["v0.2.0", "0.2.0", false],
    ["v0.1.9", "0.2.0", false],
    ["v0.3.0-rc1", "0.2.0", false],
    ["v1", "0.9.9", true],
  ])("%s newer than %s: %s", (a, b, want) => expect(isNewerVersion(a, b)).toBe(want));
});

describe("Ontario fuel price CSV", () => {
  it("reads Ontario's current layout (markets as columns, fuels as rows)", () => {
    const csv = [
      "Date,Ottawa,Toronto West/Ouest,Toronto East/Est,Windsor,London,Ontario Average/Moyenne provinciale,Fuel Type,Type de carburant,,,",
      "1990-01-03,55.9,49.1,48.7,45.2,50.1,50.3,Regular Unleaded Gasoline,Essence sans plomb,,,",
      "2026-10-13,170.1,176.0,177.0,169.0,171.0,172.0,Regular Unleaded Gasoline,Essence sans plomb,,,",
      "2026-10-20,168.0,172.4,0,166.0,170.0,170.5,Regular Unleaded Gasoline,Essence sans plomb,,,",
      "2026-10-20,190.0,195.0,196.0,189.0,190.0,191.0,Premium Gasoline,Essence super,,,",
      "2026-10-20,180.0,181.0,182.0,179.0,180.0,180.5,Diesel,Diesel,,,",
    ].join("\n");
    // Toronto East wasn't surveyed (0) that week, so only Toronto West counts.
    expect(parseGasCsv(csv)).toEqual({ date: "2026-10-20", regular: 1.724 });
  });
  it("reads the wide layout and averages Toronto West and East", () => {
    const csv = [
      "Date,Ottawa Regular Unleaded Gasoline,Toronto West Regular Unleaded Gasoline,Toronto East Regular Unleaded Gasoline,Toronto West Premium Gasoline",
      "2026-10-13,170.1,176.0,177.0,201.0",
      "2026-10-20,168.0,172.4,173.6,198.0",
    ].join("\n");
    expect(parseGasCsv(csv)).toEqual({ date: "2026-10-20", regular: 1.73 });
  });
  it("reads the long layout", () => {
    const csv = [
      "Week,Market,Fuel Type,Price (cents/L)",
      "2026-10-20,Toronto West,Regular Unleaded Gasoline,172.4",
      "2026-10-20,Toronto West,Diesel,180.1",
      "2026-10-20,Ottawa,Regular Unleaded Gasoline,168.0",
      "2026-10-13,Toronto West,Regular Unleaded Gasoline,176.0",
    ].join("\n");
    expect(parseGasCsv(csv)).toEqual({ date: "2026-10-20", regular: 1.724 });
  });
  it("returns null when there's no Toronto regular price", () => {
    expect(parseGasCsv("Date,Ottawa Regular Unleaded Gasoline\n2026-10-20,168.0")).toBeNull();
    expect(parseGasCsv("nothing here")).toBeNull();
  });
});
