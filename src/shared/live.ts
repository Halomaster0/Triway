// Small pieces of data fetched from the public GitHub repo after install:
// the weekly GTA gas price and the latest release version. Both are plain GETs
// that send nothing about the user.

export const REPO = "Halomaster0/Triway";
export const LIVE_GAS_URL = `https://raw.githubusercontent.com/${REPO}/HEAD/data/live/gas-price.json`;
export const LATEST_RELEASE_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
export const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface LiveGas {
  regular: number;
  date: string;
  region: string;
  source: string;
  fetchedAt: number;
}

export interface UpdateInfo {
  version: string;
  url: string;
  checkedAt: number;
}

export const isStale = (fetchedAt: number | undefined, now = Date.now()) => !fetchedAt || now - fetchedAt > DAY_MS;

/** Validates the gas file; returns null if anything looks off. */
export function parseLiveGas(raw: unknown, now = Date.now()): LiveGas | null {
  const r = raw as Partial<LiveGas> | null;
  if (!r || typeof r.regular !== "number" || !(r.regular > 0.8 && r.regular < 3.5)) return null;
  if (typeof r.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return null;
  return { regular: r.regular, date: r.date, region: r.region ?? "Toronto / GTA", source: r.source ?? "", fetchedAt: now };
}

/** "v0.10.1" > "0.9.3"; pre-releases ("0.3.0-rc1") never count as newer. */
export function isNewerVersion(candidate: string, current: string): boolean {
  if (/-/.test(candidate)) return false;
  const parse = (v: string) => v.replace(/^v/, "").split(".").map((n) => Number.parseInt(n, 10) || 0);
  const [a, b] = [parse(candidate), parse(current)];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}
