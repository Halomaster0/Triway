import type { Agency, LatLng } from "./types";

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rail and road routes run longer than the straight line; 1.25 is a typical GTA detour factor. */
export const DETOUR_FACTOR = 1.25;

// Rough service-area boxes, checked in order. Only used when Google Maps does not
// name the agency for a leg, so they favour simplicity over precise borders.
const REGIONS: Array<{ agency: Exclude<Agency, "GO">; lat: [number, number]; lng: [number, number] }> = [
  { agency: "TTC", lat: [43.58, 43.86], lng: [-79.58, -79.11] },
  { agency: "MiWay", lat: [43.47, 43.74], lng: [-79.82, -79.52] },
  { agency: "Brampton", lat: [43.62, 43.86], lng: [-79.92, -79.58] },
  { agency: "YRT", lat: [43.84, 44.42], lng: [-79.85, -79.15] },
  { agency: "DRT", lat: [43.8, 44.5], lng: [-79.17, -78.6] },
  { agency: "HSR", lat: [43.05, 43.47], lng: [-80.25, -79.62] },
];

export function regionAgency(p: LatLng | null): Exclude<Agency, "GO"> | null {
  if (!p) return null;
  const r = REGIONS.find((r) => p.lat >= r.lat[0] && p.lat <= r.lat[1] && p.lng >= r.lng[0] && p.lng <= r.lng[1]);
  return r?.agency ?? null;
}

export function inGta(p: LatLng | null): boolean {
  return regionAgency(p) !== null;
}
