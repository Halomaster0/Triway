import type { Agency } from "../core/types";

/** Each agency's brand colour, used only for small route dots. */
export const AGENCY_COLOR: Record<Agency, string> = {
  TTC: "#da251d",
  GO: "#00853f",
  MiWay: "#f37021",
  Brampton: "#ef3e42",
  YRT: "#0067b1",
  DRT: "#00a3e0",
  HSR: "#ffc20e",
};

export const AGENCY_NAME: Record<Agency, string> = {
  TTC: "TTC",
  GO: "GO Transit",
  MiWay: "MiWay",
  Brampton: "Brampton Transit",
  YRT: "YRT / Viva",
  DRT: "Durham Region Transit",
  HSR: "Hamilton Street Railway",
};
