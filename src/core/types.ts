export type FuelType = "X" | "Z" | "D" | "E" | "N"; // NRCan: regular, premium, diesel, E85, natural gas

export interface VehicleTrim {
  model: string;
  engine: number;
  transmission: string;
  fuel: FuelType;
  city: number; // L/100 km
  hwy: number;
  comb: number;
}

/** Compact row stored in vehicles.json: [model, engine L, transmission, fuel, city, hwy, comb]. */
export type VehicleRow = [string, number, string, FuelType, number, number, number];

export interface VehicleDb {
  source: string;
  years: Record<string, Record<string, VehicleRow[]>>;
}

export function toTrim([model, engine, transmission, fuel, city, hwy, comb]: VehicleRow): VehicleTrim {
  return { model, engine, transmission, fuel, city, hwy, comb };
}

export type DrivingMix = "combined" | "city" | "highway";

export interface VehicleSetting {
  source: "database" | "manual";
  label: string;
  city?: number;
  hwy?: number;
  comb: number;
  fuel?: FuelType;
}

export interface RiderProfile {
  age: number | null;
  postSecondary: boolean;
  fairPass: boolean;
  bramptonResident: boolean;
}

export interface Settings {
  vehicle: VehicleSetting | null;
  drivingMix: DrivingMix;
  gas: { mode: "auto" | "manual"; manualPrice: number | null };
  rider: RiderProfile;
}

export type Agency = "TTC" | "GO" | "MiWay" | "Brampton" | "YRT" | "DRT" | "HSR";

export type FareCategory = "child" | "youth" | "postSecondary" | "adult" | "senior" | "fairPass";

export interface LatLng {
  lat: number;
  lng: number;
}

export type TravelMode = "driving" | "transit" | "walking" | "cycling" | "unknown";

export interface TransitLeg {
  agency: Agency;
  label: string;
  /** Minutes after the trip starts that this leg boards, when known. */
  startOffsetMin?: number;
  /** Estimated in-vehicle distance for distance-based fares (GO). */
  km?: number;
}

export interface TripOption {
  km: number | null;
  minutes: number | null;
  legs: TransitLeg[];
  hasTolls: boolean;
  text: string;
}

export interface RouteInfo {
  mode: TravelMode;
  origin: LatLng | null;
  destination: LatLng | null;
  trips: TripOption[];
}
