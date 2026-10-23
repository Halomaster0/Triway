// Updates the bundled default gas price.
// Usage: npm run data:gas -- <dollars per litre> <YYYY-MM-DD> [source]
// Weekly Ontario prices: https://www.ontario.ca/page/motor-fuel-prices
import { writeFileSync } from "node:fs";

const [price, date, ...source] = process.argv.slice(2);
const regular = Number(price);
if (!(regular > 0.5 && regular < 5) || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
  console.error("Usage: npm run data:gas -- 1.779 2026-10-18 [source]");
  process.exit(1);
}
const data = {
  regular,
  date,
  region: "Toronto / GTA",
  source: source.join(" ") || "Ontario Ministry of Energy weekly motor fuel prices",
};
writeFileSync("src/data/gasPrice.json", JSON.stringify(data, null, 2) + "\n");
console.log(`Gas price set to $${regular}/L (${date})`);
