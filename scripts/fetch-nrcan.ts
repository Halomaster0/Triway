// Downloads the official NRCan "Fuel consumption ratings" CSVs for
// conventional vehicles into data/raw/nrcan/, using the Open Government
// Portal (CKAN) API so new model-year files are picked up automatically.
// Run by .github/workflows/update-vehicles.yml; needs internet access to
// open.canada.ca and natural-resources.canada.ca.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { decodeCsv, parseNrcanCsv } from "./build-vehicles";

const DATASET = "98f1a129-f628-4ce4-b24d-6f16bf24dd64";
const API = `https://open.canada.ca/data/api/3/action/package_show?id=${DATASET}`;
const OUT = "data/raw/nrcan";

interface Resource {
  name: string | Record<string, string>;
  url: string;
  format: string;
  language?: string[];
}

const nameOf = (r: Resource) => (typeof r.name === "string" ? r.name : (r.name.en ?? Object.values(r.name)[0] ?? ""));

export function pickResources(resources: Resource[]): Resource[] {
  return resources.filter((r) => {
    const name = nameOf(r);
    return (
      r.format?.toUpperCase() === "CSV" &&
      !(r.language?.length === 1 && r.language[0] === "fr") &&
      !/electric|hybrid|BEV|PHEV|électrique|hybride/i.test(`${name} ${r.url}`) &&
      // NRCan also republishes 1995–2014 under the old 2-cycle test; keep only the 5-cycle version.
      !/2-cycle|original/i.test(`${name} ${r.url}`)
    );
  });
}

async function main() {
  const res = await fetch(API);
  if (!res.ok) throw new Error(`CKAN API ${res.status}`);
  const pkg = (await res.json()) as { result: { resources: Resource[] } };
  const picked = pickResources(pkg.result.resources);
  if (picked.length === 0) throw new Error("No conventional-vehicle CSV resources found");

  const files: Array<[string, Buffer]> = [];
  for (const r of picked) {
    const buf = Buffer.from(await (await fetch(r.url)).arrayBuffer());
    const rows = parseNrcanCsv(decodeCsv(buf));
    // Skip anything that doesn't look like a ratings table (notes, French copies with other layouts).
    const sane = rows.filter((x) => x.comb >= 2 && x.comb <= 30).length;
    console.log(`${nameOf(r)}: ${rows.length} rows (${sane} plausible) <- ${r.url}`);
    if (rows.length < 50 || sane / rows.length < 0.95) continue;
    const slug = decodeURIComponent(r.url.split("/").pop() ?? "file.csv").replace(/[^\w.-]+/g, "_");
    files.push([slug.endsWith(".csv") ? slug : `${slug}.csv`, buf]);
  }
  if (files.length === 0) throw new Error("Downloaded files had no usable rows; refusing to replace data");

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  for (const [name, buf] of files) writeFileSync(`${OUT}/${name}`, buf);
  console.log(`Saved ${files.length} files to ${OUT}`);
}

if (process.argv[1]?.endsWith("fetch-nrcan.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
