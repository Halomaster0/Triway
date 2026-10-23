import type { Agency, FareCategory } from "../types";

/**
 * Single-ride PRESTO fares in dollars. `null` means we have no reliable
 * figure for that category: the engine falls back to the adult fare and
 * says so in its warnings.
 *
 * Update this file whenever an agency changes its fares, and bump
 * `FARES_EFFECTIVE`. Sources are listed per agency.
 */
export const FARES_EFFECTIVE = "2026-07-01";

export interface AgencyFares {
  name: string;
  /** Minutes in which transfers within the same agency are free. */
  transferWindowMin: number;
  /** Part of the Ontario One Fare program (free transfers between members). */
  oneFare: boolean;
  fares: Record<Exclude<FareCategory, "child">, number | null>;
  /** True when we could not confirm the figures from the agency itself. */
  unverified?: boolean;
  source: string;
}

export const LOCAL_FARES: Record<Exclude<Agency, "GO">, AgencyFares> = {
  TTC: {
    name: "TTC",
    transferWindowMin: 120,
    oneFare: true,
    // The TTC has no per-ride post-secondary discount (only the monthly pass).
    fares: { adult: 3.3, youth: 2.35, senior: 2.25, postSecondary: 3.3, fairPass: 2.1 },
    source: "https://www.ttc.ca/Fares-and-passes",
  },
  MiWay: {
    name: "MiWay",
    transferWindowMin: 120,
    oneFare: true,
    // Seniors 65+ ride free with a PRESTO card set to the senior fare type.
    fares: { adult: 3.5, youth: 2.9, senior: 0, postSecondary: 3.5, fairPass: 3.5 },
    source: "https://www.mississauga.ca/miway-transit/announcements/miway-fares-will-change-on-thursday-january-1/",
  },
  Brampton: {
    name: "Brampton Transit",
    transferWindowMin: 120,
    oneFare: true,
    // Seniors: $1.85 for non-residents; Brampton residents ride free (handled in the engine).
    fares: { adult: 3.55, youth: 2.95, senior: 1.85, postSecondary: 3.55, fairPass: 3.55 },
    source: "https://www.brampton.ca/EN/residents/transit/Fares/",
  },
  YRT: {
    name: "YRT / Viva",
    transferWindowMin: 120,
    oneFare: true,
    fares: { adult: 4.24, youth: 3.29, senior: 2.6, postSecondary: 4.24, fairPass: 4.24 },
    source: "https://www.yrt.ca/en/fares-and-passes/fare-chart.aspx",
  },
  DRT: {
    name: "Durham Region Transit",
    transferWindowMin: 120,
    oneFare: true,
    fares: { adult: 3.84, youth: 3.46, senior: 2.53, postSecondary: 3.84, fairPass: 3.84 },
    source: "https://www.durhamregiontransit.com/en/fares-and-passes/fares.aspx",
  },
  HSR: {
    name: "Hamilton Street Railway",
    transferWindowMin: 120,
    // HSR is not part of One Fare.
    oneFare: false,
    fares: { adult: 2.85, youth: null, senior: null, postSecondary: null, fairPass: null },
    unverified: true,
    source: "https://www.hamilton.ca/home-neighbourhood/hsr/fares/fares-photo-ids",
  },
};

/**
 * GO Transit fares are set per station pair, mostly by distance. Until a
 * station-pair table is bundled we estimate from distance using two
 * published points: the $3.70 PRESTO fare for trips of 10 km or less, and
 * Oakville–Union (~34 km by rail) at $8.16 PRESTO.
 */
export const GO_FARES = {
  name: "GO Transit",
  transferWindowMin: 180,
  shortTripKm: 10,
  shortTripFare: 3.7,
  perKmTo40: 0.186,
  /** GO's fare curve flattens on long trips; this taper is an estimate. */
  perKmAfter40: 0.11,
  discount: { adult: 0, youth: 0.4, postSecondary: 0.4, senior: 0.55, fairPass: 0 } as Record<
    Exclude<FareCategory, "child">,
    number
  >,
  source: "https://www.gotransit.com/en/ways-to-pay/fare-information",
};
