// Turns NRCan "Fuel Consumption Ratings" CSVs (data/raw/nrcan/*.csv) into the
// compact src/data/vehicles.json the extension ships with.
//
// Source: Natural Resources Canada, Fuel consumption ratings (Open Government
// Licence - Canada). To add a new model year, drop the official CSV into
// data/raw/nrcan/ and run `npm run data:vehicles`.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { VehicleDb, VehicleRow, VehicleTrim } from "../src/core/types";

const RAW_DIR = "data/raw/nrcan";
const OUT = "src/data/vehicles.json";
export const FIRST_YEAR = 2000;

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

// Column order is stable across NRCan releases even though header text is not:
// year, make, model, class, engine L, cylinders, transmission, fuel type,
// city L/100km, hwy L/100km, combined L/100km, ...
export function parseNrcanCsv(text: string): Array<VehicleTrim & { year: number; make: string }> {
  const rows: Array<VehicleTrim & { year: number; make: string }> = [];
  for (const line of text.split(/\r?\n/)) {
    const c = parseCsvLine(line);
    const year = Number(c[0]);
    if (!/^\d{4}$/.test(c[0] ?? "") || year < FIRST_YEAR) continue;
    const city = Number(c[8]);
    const hwy = Number(c[9]);
    const comb = Number(c[10]);
    if (![city, hwy, comb].every((n) => Number.isFinite(n) && n > 0)) continue;
    rows.push({
      year,
      make: titleCase(c[1]),
      model: c[2],
      engine: Number(c[4]) || 0,
      transmission: c[6],
      fuel: c[7] as VehicleTrim["fuel"],
      city,
      hwy,
      comb,
    });
  }
  return rows;
}

export function titleCase(s: string): string {
  // Older NRCan files are all caps ("ALFA ROMEO"); newer ones mixed case. Keep
  // short acronyms like BMW, GMC and KIA as they are.
  return s.replace(/[A-Z]{4,}/g, (w) => w[0] + w.slice(1).toLowerCase());
}

/** NRCan files are UTF-8 or Windows-1252 depending on the year. */
export function decodeCsv(buf: Buffer): string {
  const utf8 = buf.toString("utf8");
  return utf8.includes("\uFFFD") ? new TextDecoder("windows-1252").decode(buf) : utf8;
}

function main() {
  const db: VehicleDb = { source: "Natural Resources Canada - Fuel Consumption Ratings", years: {} };
  const files = readdirSync(RAW_DIR).filter((f) => f.endsWith(".csv"));
  // Multi-year and single-year NRCan files overlap; keep each row once.
  const seen = new Set<string>();
  let count = 0;
  for (const f of files) {
    for (const r of parseNrcanCsv(decodeCsv(readFileSync(join(RAW_DIR, f))))) {
      const row: VehicleRow = [r.model, r.engine, r.transmission, r.fuel, r.city, r.hwy, r.comb];
      const key = `${r.year}|${r.make.toLowerCase()}|${row.join("|").toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      ((db.years[r.year] ??= {})[r.make] ??= []).push(row);
      count++;
    }
  }
  for (const makes of Object.values(db.years)) {
    for (const list of Object.values(makes)) list.sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1]);
  }
  writeFileSync(OUT, JSON.stringify(db));
  console.log(`Wrote ${count} vehicles across ${Object.keys(db.years).length} model years to ${OUT}`);
}

if (process.argv[1]?.endsWith("build-vehicles.ts")) main();
