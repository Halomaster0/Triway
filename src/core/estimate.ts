import gasPrice from "../data/gasPrice.json";
import type { LiveGas } from "../shared/live";
import { computeFare, type FareResult } from "./fares/engine";
import { fuelCost, litresPer100 } from "./fuel";
import { DETOUR_FACTOR, haversineKm, regionAgency } from "./geo";
import type { LatLng, Settings, TransitLeg } from "./types";

/** What we have learned about one origin→destination pair, across mode switches. */
export interface RouteMemory {
  origin: LatLng | null;
  destination: LatLng | null;
  driveKm?: number;
  driveMinutes?: number | null;
  hasTolls?: boolean;
  transitLegs?: TransitLeg[];
  transitMinutes?: number | null;
  /** Background read of Maps' transit tab: running, failed, or finished. */
  transitStatus?: "pending" | "failed" | "done";
}

export interface GasPrice {
  price: number;
  source: "manual" | "auto";
  date?: string;
}

export interface DriveEstimate {
  km: number;
  kmEstimated: boolean;
  minutes: number | null;
  lPer100: number;
  litres: number;
  cost: number;
  hasTolls: boolean;
}

export interface TransitEstimate extends FareResult {
  minutes: number | null;
  legsAssumed: boolean;
}

export interface Estimate {
  gas: GasPrice;
  drive: DriveEstimate | null;
  driveNote?: string;
  transit: TransitEstimate | null;
  transitNote?: string;
  /** Transit legs are a guess; Maps' transit tab would give the real ones. */
  transitNeedsTab: boolean;
  /** The background read of Maps' transit tab is still running. */
  transitPending: boolean;
}

/** The rider's own price, else the weekly price fetched from GitHub, else the one bundled at build time. */
export function currentGasPrice(settings: Settings, live?: LiveGas | null): GasPrice {
  if (settings.gas.mode === "manual" && settings.gas.manualPrice && settings.gas.manualPrice > 0) {
    return { price: settings.gas.manualPrice, source: "manual" };
  }
  if (live && live.date >= gasPrice.date) return { price: live.regular, source: "auto", date: live.date };
  return { price: gasPrice.regular, source: "auto", date: gasPrice.date };
}

function straightLineKm(m: RouteMemory): number | null {
  return m.origin && m.destination ? haversineKm(m.origin, m.destination) * DETOUR_FACTOR : null;
}

export function buildEstimate(m: RouteMemory, settings: Settings, live?: LiveGas | null): Estimate {
  const gas = currentGasPrice(settings, live);
  const est: Estimate = { gas, drive: null, transit: null, transitNeedsTab: false, transitPending: false };

  const lineKm = straightLineKm(m);
  const km = m.driveKm ?? lineKm;
  if (!settings.vehicle) est.driveNote = "Add your car in settings to see fuel cost.";
  else if (!km) est.driveNote = "Pick a driving route to see fuel cost.";
  else {
    const l100 = litresPer100(settings.vehicle, settings.drivingMix);
    const f = fuelCost(km, l100, gas.price);
    est.drive = {
      km,
      kmEstimated: m.driveKm === undefined,
      minutes: m.driveMinutes ?? null,
      lPer100: l100,
      litres: f.litres,
      cost: f.cost,
      hasTolls: m.hasTolls ?? false,
    };
  }

  let legs = m.transitLegs;
  let legsAssumed = false;
  if ((!legs || legs.length === 0) && m.transitStatus === "pending") {
    est.transitNote = "Checking transit options…";
    est.transitPending = true;
    return est;
  }
  if (!legs || legs.length === 0) {
    const local = regionAgency(m.origin);
    if (local) {
      legs = [{ agency: local, label: local }];
      legsAssumed = true;
    }
  }
  if (!legs || legs.length === 0) est.transitNote = "Transit pricing covers GTA agencies only.";
  else {
    const fare = computeFare(legs, settings.rider, {
      tripMinutes: m.transitMinutes,
      goKmFallback: goKmEstimate(m.driveKm ?? lineKm, legs),
    });
    est.transit = { ...fare, minutes: m.transitMinutes ?? null, legsAssumed };
    est.transitNeedsTab = legsAssumed;
  }
  return est;
}

/**
 * GO legs are priced by distance but Maps doesn't give per-leg km. Use the
 * whole trip less about 3 km for each local connection, never under GO's
 * 10 km base fare band.
 */
export function goKmEstimate(tripKm: number | null | undefined, legs: TransitLeg[]): number | null {
  if (!tripKm) return null;
  const local = legs.filter((l) => l.agency !== "GO").length;
  return Math.max(10, tripKm - 3 * local);
}
