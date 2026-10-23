// End-to-end check: loads dist/chrome into Chromium, fills in the settings page,
// then opens Google Maps directions (served from local fixtures, since the
// real Maps page needs network access) and checks the cost card.
//
// Run with `npm run e2e`. Screenshots go to test-results/.
import { chromium, type Page } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const EXT = resolve("dist/chrome");
const OUT = "test-results";
const DRIVE_URL =
  "https://www.google.com/maps/dir/Union+Station,+Toronto,+ON/Square+One,+Mississauga,+ON/@43.62,-79.51,12z/data=!3m1!4b1!4m14!4m13!1m5!1m1!1s0x0:0x1!2m2!1d-79.3806!2d43.6453!1m5!1m1!1s0x0:0x2!2m2!1d-79.6424!2d43.5931!3e0";
// A second route whose fixtures use id-less markup and unnamed buses.
const UTM_URL =
  "https://www.google.com/maps/dir/University+of+Toronto+Mississauga/Union+Station/@43.6,-79.5,12z/data=!4m14!4m13!1m5!1m1!1s0x0:0x1!2m2!1d-79.6627!2d43.5483!1m5!1m1!1s0x0:0x2!2m2!1d-79.3806!2d43.6453!3e0";

function check(cond: unknown, msg: string) {
  if (!cond) throw new Error(`E2E failed: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

const cardText = (page: Page) =>
  page.evaluate(() => document.getElementById("triway-root")?.shadowRoot?.querySelector("div")?.innerText ?? "");

const waitForCard = (page: Page, re: RegExp) =>
  page.waitForFunction(
    (src) => new RegExp(src).test(document.getElementById("triway-root")?.shadowRoot?.textContent ?? ""),
    re.source,
    { timeout: 25000 },
  );

async function openDetails(page: Page) {
  await page.evaluate(() => {
    const toggle = document.getElementById("triway-root")!.shadowRoot!.querySelector<HTMLElement>("button.section-toggle");
    if (toggle?.getAttribute("aria-expanded") !== "true") toggle?.click();
  });
  await page.waitForTimeout(400);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const ctx = await chromium.launchPersistentContext("", {
    executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
    headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, "--headless=new"],
    viewport: { width: 1200, height: 760 },
  });

  await ctx.route("https://www.google.com/maps/**", (route) => {
    const url = route.request().url();
    const transit = url.includes("!3e3");
    const fixture = url.includes("University")
      ? transit ? "maps-transit-utm.html" : "maps-driving-noid.html"
      : transit ? "maps-transit.html" : "maps-driving.html";
    return route.fulfill({ contentType: "text/html", body: readFileSync(`tests/fixtures/${fixture}`, "utf8") });
  });

  const worker = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
  const extId = new URL(worker.url()).host;
  console.log(`Extension loaded: ${extId}`);
  check(extId === "jdcgiaefoeldnmnplhadgjfcchkpjoab", "fixed extension ID from the manifest key");

  // Settings: pick a real car from the NRCan database and a youth rider.
  // On install the extension opens its settings page itself, which can land
  // on this same tab mid-navigation; tolerate that and wait for the form.
  const options = await ctx.newPage();
  await options.goto(`chrome-extension://${extId}/options.html`).catch((e: Error) => {
    if (!/interrupted by another navigation/.test(e.message)) throw e;
  });
  await options.waitForSelector("#year");
  await options.selectOption("#year", "2022");
  await options.selectOption("#make", "Toyota");
  const corolla = await options.$$eval("#model option", (opts) =>
    opts.find((o) => o.textContent?.startsWith("Corolla "))?.getAttribute("value"),
  );
  check(corolla, "NRCan database lists a 2022 Toyota Corolla");
  await options.selectOption("#model", corolla!);
  await options.fill("#age", "17");
  await options.getByText("Saved").first().waitFor();
  const car = await options.textContent('[data-testid="current-car"]');
  check(car?.includes("L/100 km"), `car saved: ${car?.trim()}`);
  check((await options.textContent('[data-testid="category"]'))?.includes("Youth"), "age 17 maps to the youth fare");

  // Driving directions. The transit fare should fill in from the hidden
  // background read of the transit tab, without switching tabs.
  const maps = await ctx.newPage();
  await maps.goto(DRIVE_URL);
  await waitForCard(maps, /57 min/);
  let text = await cardText(maps);
  check(/27\.6 km/.test(text), "drive distance read from the route (27.6 km)");
  check(/Drive[\s\S]*\$\d+\.\d\d/.test(text), "drive cost shown");
  check(/tolls/.test(text), "toll warning shown");
  check(/Youth/.test(text), "transit priced for a youth rider");
  check(!/Rough guess/.test(text), "transit legs came from the background read, not a guess");
  check(await maps.evaluate(() => document.querySelectorAll("iframe").length === 0), "background iframe removed");
  await openDetails(maps);
  text = await cardText(maps);
  check(/TTC fare refunded at GO tap/.test(text) && /Free with GO/.test(text), "TTC → GO → MiWay: TTC refunded at GO, MiWay free after GO");
  check(/Saves \$\d/.test(text), "cheaper option shown");
  const box = await maps.locator("#triway-root").boundingBox();
  check(box && box.x > 600 && box.y + box.height <= 760 - 200 + 1, "card sits on the right, above the map controls");
  await maps.screenshot({ path: `${OUT}/maps-driving.png` });
  await maps.emulateMedia({ colorScheme: "dark" });
  await maps.waitForTimeout(200);
  await maps.screenshot({ path: `${OUT}/maps-driving-dark.png` });
  await maps.emulateMedia({ colorScheme: "light" });

  // Drag the card by its header; the new spot survives a reload.
  const head = maps.locator(".card-head");
  const before = (await maps.locator(".card").boundingBox())!;
  const hb = (await head.boundingBox())!;
  await maps.mouse.move(hb.x + 60, hb.y + 15);
  await maps.mouse.down();
  await maps.mouse.move(hb.x - 140, hb.y - 60, { steps: 8 });
  await maps.mouse.up();
  await maps.waitForTimeout(300);
  const after = (await maps.locator(".card").boundingBox())!;
  check(Math.abs(after.x - before.x + 200) < 4 && Math.abs(after.y - before.y + 75) < 4, "card can be dragged by its header");
  await maps.reload();
  await waitForCard(maps, /57 min/);
  await maps.waitForTimeout(300);
  const reloaded = (await maps.locator(".card").boundingBox())!;
  check(Math.abs(reloaded.x - after.x) < 4 && Math.abs(reloaded.y + reloaded.height - (after.y + after.height)) < 4, "dragged position remembered after reload");
  await maps.screenshot({ path: `${OUT}/maps-dragged.png` });

  // Markup without trip ids, and buses Maps shows only by number.
  const utm = await ctx.newPage();
  await utm.goto(UTM_URL);
  await waitForCard(utm, /1 h 16 min/);
  await openDetails(utm);
  text = await cardText(utm);
  check(/29\.2 km/.test(text), "driving distance read from id-less trip cards (29.2 km)");
  check(/Bus 110[\s\S]*LW[\s\S]*Line 1/.test(text), "legs: MiWay bus 110 → GO LW → TTC Line 1");
  check(/Bus 110[\s\S]*\$2\.90[\s\S]*MiWay fare refunded at GO tap[\s\S]*−\$2\.90/.test(text), "bus fare charged first, then refunded at the GO tap");
  await utm.screenshot({ path: `${OUT}/maps-utm.png` });

  // Settings page (wide and phone width, light and dark) and the popup.
  await options.reload();
  await options.waitForSelector("#year");
  await options.screenshot({ path: `${OUT}/options.png`, fullPage: true });
  await options.emulateMedia({ colorScheme: "dark" });
  await options.screenshot({ path: `${OUT}/options-dark.png`, fullPage: true });
  await options.emulateMedia({ colorScheme: "light" });
  await options.setViewportSize({ width: 400, height: 800 });
  await options.screenshot({ path: `${OUT}/options-narrow.png`, fullPage: true });
  const popup = await ctx.newPage();
  await popup.setViewportSize({ width: 340, height: 560 });
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.waitForSelector("#km");
  check((await popup.textContent('[data-testid="drive"]'))?.includes("$"), "popup prices a drive");
  await popup.screenshot({ path: `${OUT}/popup.png` });
  console.log(`\nCard text (UTM → Union):\n${text}`);

  await ctx.close();
  console.log("\nE2E passed. Screenshots in test-results/.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
