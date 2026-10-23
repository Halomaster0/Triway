import type { Settings } from "../core/types";

// Firefox exposes promise-based `browser`; Chrome MV3's `chrome` also returns promises.
const ext: typeof chrome = (globalThis as { browser?: typeof chrome }).browser ?? globalThis.chrome;

export const DEFAULT_SETTINGS: Settings = {
  vehicle: null,
  drivingMix: "combined",
  gas: { mode: "auto", manualPrice: null },
  rider: { age: null, postSecondary: false, fairPass: false, bramptonResident: false },
};

const KEY = "settings";

export function withDefaults(stored: Partial<Settings> | undefined): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    gas: { ...DEFAULT_SETTINGS.gas, ...stored?.gas },
    rider: { ...DEFAULT_SETTINGS.rider, ...stored?.rider },
  };
}

export async function loadSettings(): Promise<Settings> {
  const got = await ext.storage.sync.get(KEY);
  return withDefaults(got[KEY] as Partial<Settings> | undefined);
}

export async function saveSettings(s: Settings): Promise<void> {
  await ext.storage.sync.set({ [KEY]: s });
}

export function onSettingsChanged(cb: (s: Settings) => void): void {
  ext.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes[KEY]) cb(withDefaults(changes[KEY].newValue as Partial<Settings>));
  });
}

export function openOptionsPage(): void {
  ext.runtime.openOptionsPage?.();
}

export { ext };

const OFFSET_KEY = "cardOffset";

/** Where the user dragged the Maps card, kept per browser profile. */
export async function loadCardOffset(): Promise<{ x: number; y: number }> {
  try {
    const got = await ext.storage.local.get(OFFSET_KEY);
    const o = got[OFFSET_KEY] as { x: number; y: number } | undefined;
    return o && Number.isFinite(o.x) && Number.isFinite(o.y) ? o : { x: 0, y: 0 };
  } catch {
    return { x: 0, y: 0 };
  }
}

export async function saveCardOffset(o: { x: number; y: number }): Promise<void> {
  await ext.storage.local.set({ [OFFSET_KEY]: o });
}

export interface LiveState {
  gas: import("./live").LiveGas | null;
  update: import("./live").UpdateInfo | null;
}

/** Fetched data kept by the background worker (see src/background.ts). */
export async function loadLive(): Promise<LiveState> {
  try {
    const got = await ext.storage.local.get(["liveGas", "update"]);
    return { gas: (got.liveGas as LiveState["gas"]) ?? null, update: (got.update as LiveState["update"]) ?? null };
  } catch {
    return { gas: null, update: null };
  }
}

export function onLiveChanged(cb: () => void): void {
  ext.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.liveGas || changes.update)) cb();
  });
}

/** Asks the background worker to refresh the gas price and release check if they're over a day old. */
export function requestLiveRefresh(): void {
  try {
    ext.runtime.sendMessage({ type: "refresh-live" })?.catch?.(() => {});
  } catch {
    // Extension context gone (e.g. after an update); the next page load retries.
  }
}
