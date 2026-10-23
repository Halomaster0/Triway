import { createRoot } from "react-dom/client";
import { buildEstimate, type RouteMemory } from "../core/estimate";
import { inGta } from "../core/geo";
import type { Settings } from "../core/types";
import type { LiveGas } from "../shared/live";
import {
  loadCardOffset,
  loadLive,
  loadSettings,
  onLiveChanged,
  onSettingsChanged,
  openOptionsPage,
  requestLiveRefresh,
  saveCardOffset,
} from "../shared/storage";
import { CostCard } from "../ui/CostCard";
import { BASE_CSS } from "../ui/styles";
import { debugInfo, readRoute, routeKey, transitUrl } from "./mapsReader";
import { probeTransit } from "./transitProbe";

const memory = new Map<string, RouteMemory>();
const hidden = new Set<string>();
let settings: Settings | null = null;
let offset = { x: 0, y: 0 };
let liveGas: LiveGas | null = null;

const host = document.createElement("div");
host.id = "triway-root";
// Right side of the map, above Maps' location / zoom / Street View controls.
host.style.cssText = "position:fixed;right:16px;bottom:200px;z-index:2147483000;";
const shadow = host.attachShadow({ mode: "open" });
const style = document.createElement("style");
style.textContent = BASE_CSS;
const mount = document.createElement("div");
shadow.append(style, mount);
const root = createRoot(mount);

function update() {
  if (!settings || !location.pathname.includes("/maps/dir/")) {
    root.render(null);
    return;
  }
  const route = readRoute(document, location.href);
  if ((route.origin && !inGta(route.origin)) || (route.destination && !inGta(route.destination))) {
    root.render(null);
    return;
  }
  const key = routeKey(route) ?? "current";
  if (hidden.has(key)) {
    root.render(null);
    return;
  }
  const mem: RouteMemory = memory.get(key) ?? { origin: route.origin, destination: route.destination };
  const trip = route.trips[0];
  if (trip && route.mode === "driving" && trip.km) {
    mem.driveKm = trip.km;
    mem.driveMinutes = trip.minutes;
    mem.hasTolls = trip.hasTolls;
  }
  if (trip && route.mode === "transit" && trip.legs.length > 0) {
    mem.transitLegs = trip.legs;
    mem.transitMinutes = trip.minutes;
    mem.transitStatus = "done";
  }
  memory.set(key, mem);
  if (route.mode !== "transit" && !mem.transitLegs && !mem.transitStatus) startProbe(key, mem);
  if (!mem.driveKm && !mem.transitLegs && !mem.origin) {
    root.render(null);
    return;
  }
  root.render(
    <CostCard
      estimate={buildEstimate(mem, settings, liveGas)}
      onSettings={openSettings}
      onOpenTransit={openTransitTab}
      onCopyDebug={() => navigator.clipboard.writeText(debugInfo(document, location.href))}
      onHide={() => {
        hidden.add(key);
        update();
      }}
      offset={offset}
      onOffsetChange={(o) => {
        offset = o;
        saveCardOffset(o);
        update();
      }}
    />,
  );
}

function startProbe(key: string, mem: RouteMemory) {
  mem.transitStatus = "pending";
  probeTransit(location.href).then((trip) => {
    if (trip) {
      mem.transitLegs = trip.legs;
      mem.transitMinutes = trip.minutes;
      mem.transitStatus = "done";
    } else mem.transitStatus = "failed";
    if (memory.get(key) === mem) update();
  });
}

function openTransitTab() {
  // Prefer Maps' own transit button so the page doesn't reload.
  const button = document.querySelector<HTMLElement>('[data-travel_mode="3"] button, [data-travel_mode="3"], button[aria-label^="Transit"]');
  if (button) button.click();
  else {
    const url = transitUrl(location.href);
    if (url) location.href = url;
  }
}

function openSettings() {
  // Content scripts cannot open the options page directly; ask the background worker.
  try {
    chrome.runtime.sendMessage({ type: "open-options" });
  } catch {
    openOptionsPage();
  }
}

let timer: number | undefined;
function schedule() {
  clearTimeout(timer);
  timer = window.setTimeout(update, 300);
}

async function start() {
  document.documentElement.append(host);
  let live;
  [settings, offset, live] = await Promise.all([loadSettings(), loadCardOffset(), loadLive()]);
  liveGas = live.gas;
  requestLiveRefresh();
  onLiveChanged(async () => {
    liveGas = (await loadLive()).gas;
    update();
  });
  onSettingsChanged((s) => {
    settings = s;
    update();
  });
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
  // Maps changes routes with pushState; the observer usually fires too, but poll the URL as a backstop.
  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      schedule();
    }
  }, 1000);
  update();
}

// Only the top window draws the card; the transit probe's iframe stays silent.
if (window.top === window) start();
