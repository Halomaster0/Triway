export const money = (n: number) => `$${n.toFixed(2)}`;

export function minutes(n: number | null | undefined): string {
  if (!n) return "";
  const h = Math.floor(n / 60);
  const m = n % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}

/** "2026-10-18" → "Oct 18". */
export function shortDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}
