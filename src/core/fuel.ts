import type { DrivingMix, VehicleSetting } from "./types";

export function litresPer100(vehicle: VehicleSetting, mix: DrivingMix): number {
  if (mix === "city" && vehicle.city) return vehicle.city;
  if (mix === "highway" && vehicle.hwy) return vehicle.hwy;
  return vehicle.comb;
}

export interface FuelCost {
  litres: number;
  cost: number;
}

export function fuelCost(km: number, lPer100: number, pricePerLitre: number): FuelCost {
  const litres = (km * lPer100) / 100;
  return { litres, cost: round2(litres * pricePerLitre) };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
