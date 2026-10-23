import type { FareCategory, RiderProfile } from "./types";

/**
 * Picks the rider's base fare category. Age wins over flags: a 16-year-old
 * college student pays the youth fare, a 70-year-old student the senior fare.
 */
export function riderCategory(rider: RiderProfile): FareCategory {
  const age = rider.age;
  if (age !== null && age <= 12) return "child";
  if (age !== null && age >= 65) return "senior";
  if (age !== null && age <= 19) return "youth";
  if (rider.fairPass) return "fairPass";
  if (rider.postSecondary) return "postSecondary";
  return "adult";
}

export const CATEGORY_LABEL: Record<FareCategory, string> = {
  child: "Child (12 and under)",
  youth: "Youth (13–19)",
  postSecondary: "Post-secondary",
  adult: "Adult",
  senior: "Senior (65+)",
  fairPass: "Fair Pass",
};
