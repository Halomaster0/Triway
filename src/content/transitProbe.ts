// Reads Maps' transit tab without the user opening it: loads the same route in
// transit mode in a hidden same-origin iframe, reads the trip list with the
// normal reader, then removes the iframe.
import type { TripOption } from "../core/types";
import { readRoute, transitUrl } from "./mapsReader";

const TIMEOUT_MS = 20000;
const POLL_MS = 500;

export function probeTransit(href: string): Promise<TripOption | null> {
  const url = transitUrl(href);
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    // Off-screen but laid out: Maps may not render the list in a display:none frame.
    frame.style.cssText = "position:fixed;left:-10000px;top:0;width:1024px;height:800px;visibility:hidden;pointer-events:none;border:0;";
    frame.src = url;
    const started = Date.now();
    let timer: number | undefined;
    const finish = (trip: TripOption | null) => {
      clearInterval(timer);
      frame.remove();
      resolve(trip);
    };
    const poll = () => {
      try {
        const doc = frame.contentDocument;
        const href = frame.contentWindow?.location.href;
        if (doc && href && href !== "about:blank") {
          const route = readRoute(doc, href);
          const trip = route.mode === "transit" ? route.trips.find((t) => t.legs.length > 0) : undefined;
          if (trip) return finish(trip);
        }
      } catch {
        // Cross-origin (e.g. a consent redirect): reading is impossible.
        return finish(null);
      }
      if (Date.now() - started > TIMEOUT_MS) finish(null);
    };
    document.documentElement.append(frame);
    timer = window.setInterval(poll, POLL_MS);
  });
}
