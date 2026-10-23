import { isNewerVersion, isStale, LATEST_RELEASE_URL, LIVE_GAS_URL, parseLiveGas, type LiveGas, type UpdateInfo } from "./shared/live";

const ext: typeof chrome = (globalThis as { browser?: typeof chrome }).browser ?? globalThis.chrome;

ext.runtime.onMessage.addListener((msg: { type?: string }) => {
  if (msg?.type === "open-options") ext.runtime.openOptionsPage();
  if (msg?.type === "refresh-live") refreshLive();
});

ext.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") ext.runtime.openOptionsPage();
  refreshLive(true);
});
ext.runtime.onStartup.addListener(() => refreshLive());

/** Refreshes the gas price and the release check, at most once a day each. */
async function refreshLive(force = false) {
  const { liveGas, update } = (await ext.storage.local.get(["liveGas", "update"])) as { liveGas?: LiveGas; update?: UpdateInfo };

  if (force || isStale(liveGas?.fetchedAt)) {
    try {
      const res = await fetch(LIVE_GAS_URL, { cache: "no-cache" });
      const gas = res.ok ? parseLiveGas(await res.json()) : null;
      if (gas) await ext.storage.local.set({ liveGas: gas });
    } catch {
      // Offline or GitHub unreachable: keep the last good price (or the bundled one).
    }
  }

  if (force || isStale(update?.checkedAt)) {
    try {
      const res = await fetch(LATEST_RELEASE_URL, { headers: { Accept: "application/vnd.github+json" } });
      if (res.ok) {
        const rel = (await res.json()) as { tag_name?: string; html_url?: string };
        const current = ext.runtime.getManifest().version;
        const next: UpdateInfo = {
          version: rel.tag_name && isNewerVersion(rel.tag_name, current) ? rel.tag_name.replace(/^v/, "") : "",
          url: rel.html_url ?? "",
          checkedAt: Date.now(),
        };
        await ext.storage.local.set({ update: next });
        await ext.action.setBadgeText({ text: next.version ? "NEW" : "" });
        if (next.version) await ext.action.setBadgeBackgroundColor({ color: "#1a73e8" });
      }
    } catch {
      // No release published yet, or offline.
    }
  }
}
