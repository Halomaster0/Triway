// Dev-only: rasterises assets/icon.svg (and the simplified icon-16.svg) to the
// PNG sizes browsers need. The PNGs are committed, so `npm run build` needs no
// browser. Run with `npm run icons` after editing the SVGs.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const SIZES = [16, 32, 48, 128];

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
  const page = await browser.newPage();
  for (const size of SIZES) {
    const svg = readFileSync(size <= 16 ? "assets/icon-16.svg" : "assets/icon.svg", "utf8");
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`,
    );
    await page.screenshot({ path: `assets/icon-${size}.png`, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    console.log(`assets/icon-${size}.png`);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
