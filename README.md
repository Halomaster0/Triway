# Triway

A Chrome and Firefox extension for the Greater Toronto Area. When you open directions on Google Maps, it shows:

- **Drive**: fuel cost for the route, from your car's L/100 km rating and the current GTA gas price.
- **Transit**: the PRESTO fare for the same trip, priced for your fare type (child, youth, post-secondary, adult, senior, Fair Pass), including One Fare transfers and transfer windows.

Supported agencies: TTC, GO Transit, MiWay, Brampton Transit, YRT/Viva, Durham Region Transit, HSR.

## Install

Triway isn't in the browser stores; you install it from the [latest release](https://github.com/Halomaster0/Triway/releases/latest).

**Chrome, Edge, Brave, Arc**
1. Download `triway-chrome-v….zip` from the release and unzip it somewhere you'll keep it (e.g. `Documents/Triway`).
2. Open `chrome://extensions` (Edge: `edge://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and pick the unzipped folder. The settings page opens. Pick your car and enter your age.
4. Open directions in Google Maps for any trip in the GTA.

**Firefox**: if the release has a `.xpi`, open it and confirm. Otherwise use `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* with the Firefox zip; Firefox removes temporary add-ons when it restarts.

**Updating**: unpacked extensions don't update themselves. When a new version is out, Triway shows a **NEW** badge and a banner. Unzip the new release over the same folder, then click ↻ on Triway in `chrome://extensions`. Your settings are kept.

## Privacy

Your car, age and discounts are stored only in your browser. Triway reads the Google Maps page you're on to get the route; nothing from it leaves your computer. It makes two requests a day to this GitHub repo: one for the current GTA gas price and one to check for a new version. Neither sends anything about you.

## Disclaimer

Costs are estimates. Fares and gas prices change, GO fares are approximated from distance, and Google Maps' page can change in ways that break reading it. Triway isn't affiliated with Google, Metrolinx, PRESTO or any transit agency.

## Development

```sh
npm install
npm run build        # outputs dist/chrome and dist/firefox
```

- **Chrome / Edge**: open `chrome://extensions`, turn on Developer mode, click *Load unpacked* and pick `dist/chrome`.
- **Firefox**: open `about:debugging#/runtime/this-firefox`, click *Load Temporary Add-on* and pick `dist/firefox/manifest.json`.

**Updating after a `git pull`:** run `npm run build` (or keep `npm run watch` running while you work), then click the ↻ reload icon on Triway in `chrome://extensions` and refresh the Maps tab. There's no need to remove it or click *Load unpacked* again, since `dist/chrome` is rebuilt in place.

The settings page opens on install. Pick your car (or enter your own L/100 km or MPG), choose the gas price source, and enter your age and discounts.

See [docs/RELEASING.md](docs/RELEASING.md) for publishing a new version.

## Scripts

| Command | What it does |
|---|---|
| `npm test` | Unit and component tests (Vitest) |
| `npm run typecheck` | TypeScript check |
| `npm run package` | Builds and zips both browsers into `release/` (what the release workflow uploads) |
| `npm run e2e` | Builds, loads the extension in Chromium, fills in the settings and checks the cost card on Maps-like pages. Screenshots go to `test-results/` |
| `npm run data:vehicles` | Rebuilds `src/data/vehicles.json` from the NRCan CSVs in `data/raw/nrcan/` |
| `npm run data:fetch-vehicles` | Downloads the latest NRCan CSVs (needs access to open.canada.ca), then rebuilds |
| `npm run data:gas -- 1.779 2026-10-18 "source"` | Updates the bundled GTA gas price |
| `npm run icons` | Re-renders `assets/icon-*.png` from `assets/icon.svg` (needs Chromium; only after editing the icon) |

## How it works

- `src/content/mapsReader.ts` reads Google Maps. Origin, destination and travel mode come from the `/maps/dir/` URL. Distance, time and transit lines come from the directions panel. Google has no API for this, so if Maps changes its page, this is the file to fix.
- When you're on the driving tab, the extension quietly loads the same route's **transit tab in a hidden frame**, reads its trip list, then removes the frame. That gives the real rides (e.g. MiWay bus → GO → TTC) without you switching tabs. If that fails, the card says so and offers a button to open the Transit tab.
- Maps often shows buses only by number. A bus before the first named ride (GO, subway, or a named agency) is assigned to the start area's agency, and one after the last named ride to the destination area's.
- What it reads is remembered per origin and destination, so both costs stay on the card when you switch tabs. Without a driving route it estimates distance from the straight line × 1.25 and marks the figure with "≈".
- If the card misreads a route, click **Debug** on the card and paste what it copies into a bug report.
- `src/core/fares/` is the fare engine. `fares.ts` holds every fare and its source; `engine.ts` applies the rules:
  - Children 12 and under ride free.
  - Fares are worked out **tap by tap, in ride order**, because what you've already paid in the current transfer window changes what the next tap costs:
    - **Local → local** (TTC, MiWay, Brampton, YRT, DRT) within 2 hours of the first tap: no new fare, or a top-up if the next agency's fare is higher (TTC $3.30 → YRT tops up $0.94).
    - **Local → GO** within 2 hours of the first tap: the local fare is refunded when you tap onto GO, and you pay the GO fare. The card shows the charge and the refund as separate lines.
    - **GO → local** within 3 hours of boarding GO: the local ride is free.
    - When Maps' detailed view shows each ride's departure time, those times decide whether a transfer is inside the window; otherwise all rides are assumed to be.
  - HSR is outside One Fare and is charged separately.

## Data sources and accuracy

| Data | Source | Notes |
|---|---|---|
| Car fuel use | [NRCan Fuel Consumption Ratings](https://open.canada.ca/data/en/dataset/98f1a129-f628-4ce4-b24d-6f16bf24dd64) (Open Government Licence – Canada), model years 2000 onward | The **Update vehicle database** GitHub Action refreshes it monthly (or on demand from the Actions tab). Ratings before 2015 are NRCan's adjusted approximations |
| Gas price | Ontario's weekly fuel price survey, Toronto regular | The **Update gas price** Action refreshes `data/live/gas-price.json` every Tuesday; installed copies fetch it daily, falling back to the bundled `src/data/gasPrice.json`. Users can enter their own price. `npm run data:gas` sets it by hand |
| Local fares | Agency fare pages, effective 2026 (links in `fares.ts`) | HSR is marked **unverified** and has no youth or senior figures yet. The card says when it falls back to the adult fare |
| GO fares | Estimated from distance using two published points ($3.70 for ≤10 km; Oakville–Union $8.16) | GO actually prices per station pair, so GO fares always show "≈" |

Known gaps:
- Maps doesn't give per-ride distances, so the GO ride is priced on the trip distance minus about 3 km for each local connection.
- Tolls (407 ETR) and parking aren't included; the card shows a note when the route has tolls.
- Monthly passes and the TTC's 47-trip monthly cap aren't modelled; prices are single-trip.
