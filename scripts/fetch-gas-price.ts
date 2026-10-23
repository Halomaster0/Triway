// Weekly job (.github/workflows/update-gas-price.yml): reads Ontario's weekly
// retail fuel price survey and writes the latest Toronto regular-gas price to
// data/live/gas-price.json (fetched daily by installed extensions) and to the
// bundled fallback src/data/gasPrice.json.
//
// Source: Ontario Ministry of Energy, "Fuels price survey information"
// (Open Government Licence – Ontario), https://data.ontario.ca
import { writeFileSync } from "node:fs";
import { parseCsvLine } from "./build-vehicles";

const DATASET_API = "https://data.ontario.ca/api/3/action/package_show?id=fuels-price-survey-information";
const MAX_AGE_DAYS = 21;

export interface GasReading {
  regular: number;
  date: string;
}

function isoDate(s: string): string | null {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Cents or dollars per litre → dollars. */
const toDollars = (n: number) => (n > 20 ? n / 100 : n);

const isRegular = (s: string) => /regular/i.test(s) && !/mid|premium|diesel|propane|cng|natural/i.test(s);

/**
 * Finds the latest Toronto regular-gas price in the survey CSV. Handles both
 * layouts Ontario has used: one column per market/fuel ("Toronto West
 * Regular Unleaded Gasoline", averaged with Toronto East), or long rows with
 * date, market, fuel type and price columns.
 */
export function parseGasCsv(text: string): GasReading | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;
  const header = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);
  const dateCol = header.findIndex((h) => /date|week/i.test(h));
  if (dateCol < 0) return null;

  const readings: GasReading[] = [];
  const average = (r: string[], cols: number[]) => {
    // 0 means "not surveyed that week".
    const vals = cols.map((i) => Number(r[i])).filter((n) => Number.isFinite(n) && n > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  // Current Ontario layout: one column per market ("Toronto West/Ouest", "Toronto East/Est")
  // and a "Fuel Type" column, with all fuels stacked as rows.
  const torontoCols = header.map((h, i) => (/toronto/i.test(h) && !/gas|diesel|fuel/i.test(h) ? i : -1)).filter((i) => i >= 0);
  const fuelTypeCol = header.findIndex((h) => /^fuel type/i.test(h));
  if (torontoCols.length > 0 && fuelTypeCol >= 0) {
    for (const r of rows) {
      const date = isoDate(r[dateCol] ?? "");
      const v = isRegular(r[fuelTypeCol] ?? "") ? average(r, torontoCols) : null;
      if (date && v !== null) readings.push({ date, regular: toDollars(v) });
    }
    return latest(readings);
  }

  const wide = header.map((h, i) => (/toronto/i.test(h) && isRegular(h) ? i : -1)).filter((i) => i >= 0);
  if (wide.length > 0) {
    for (const r of rows) {
      const date = isoDate(r[dateCol] ?? "");
      const vals = wide.map((i) => Number(r[i])).filter((n) => Number.isFinite(n) && n > 0);
      if (date && vals.length) readings.push({ date, regular: toDollars(vals.reduce((a, b) => a + b, 0) / vals.length) });
    }
  } else {
    const market = header.findIndex((h) => /market|region|city|location/i.test(h));
    const fuel = header.findIndex((h) => /fuel|product|grade|type/i.test(h));
    const price = header.findIndex((h) => /price|cents|value/i.test(h));
    if (market < 0 || fuel < 0 || price < 0) return null;
    const byDate = new Map<string, number[]>();
    for (const r of rows) {
      const date = isoDate(r[dateCol] ?? "");
      const v = Number(r[price]);
      if (!date || !Number.isFinite(v) || v <= 0 || !/toronto/i.test(r[market] ?? "") || !isRegular(r[fuel] ?? "")) continue;
      byDate.set(date, [...(byDate.get(date) ?? []), v]);
    }
    for (const [date, vals] of byDate) readings.push({ date, regular: toDollars(vals.reduce((a, b) => a + b, 0) / vals.length) });
  }
  return latest(readings);
}

function latest(readings: GasReading[]): GasReading | null {
  readings.sort((a, b) => a.date.localeCompare(b.date));
  const last = readings[readings.length - 1];
  return last ? { date: last.date, regular: Math.round(last.regular * 1000) / 1000 } : null;
}

async function main() {
  const pkg = (await (await fetch(DATASET_API)).json()) as { result: { resources: Array<{ url: string; format: string; name?: string }> } };
  console.log(`Resources: ${pkg.result.resources.map((r) => `${r.name ?? "?"} [${r.format}] ${r.url}`).join("\n  ")}`);
  const csvs = pkg.result.resources.filter((r) => /csv/i.test(r.format) || /\.csv$/i.test(r.url));
  const ordered = [...csvs.filter((r) => /fueltypesall/i.test(r.url)), ...csvs.filter((r) => !/fueltypesall/i.test(r.url))];
  for (const r of ordered) {
    const text = await (await fetch(r.url)).text();
    const reading = parseGasCsv(text);
    console.log(`${r.name ?? r.url}: ${reading ? `${reading.regular} $/L on ${reading.date}` : "no Toronto regular price found"}`);
    if (!reading) {
      // Show the layout so a format change is easy to adapt to.
      console.log(`  url: ${r.url}\n  ${text.split(/\r?\n/).slice(0, 4).join("\n  ").slice(0, 1500)}`);
      continue;
    }
    const age = (Date.now() - new Date(reading.date).getTime()) / 86400000;
    if (!(reading.regular > 0.8 && reading.regular < 3.5)) throw new Error(`Implausible price ${reading.regular}`);
    if (age > MAX_AGE_DAYS) throw new Error(`Latest reading ${reading.date} is ${Math.round(age)} days old`);
    const data = {
      regular: reading.regular,
      date: reading.date,
      region: "Toronto / GTA",
      source: "Ontario Ministry of Energy weekly fuel price survey (Toronto, regular)",
    };
    const json = JSON.stringify(data, null, 2) + "\n";
    writeFileSync("data/live/gas-price.json", json);
    writeFileSync("src/data/gasPrice.json", json);
    console.log(`Saved $${reading.regular}/L for ${reading.date}`);
    return;
  }
  throw new Error("No usable CSV in the Ontario fuel price dataset");
}

if (process.argv[1]?.endsWith("fetch-gas-price.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
