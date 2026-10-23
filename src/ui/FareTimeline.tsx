import type { FareLine } from "../core/fares/engine";
import { AGENCY_COLOR, AGENCY_NAME } from "./agencyColors";
import { money } from "./format";

/** Rides in order, one dot per tap, with GO refunds as their own indented row. */
export function FareTimeline({ lines }: { lines: FareLine[] }) {
  return (
    <ul className="timeline">
      {lines.flatMap((l, i) => {
        const rows = [
          <li key={i}>
            <i className="dot" style={{ background: AGENCY_COLOR[l.agency] }} />
            <span className="ride">
              <span>{l.label}</span>
              <small>
                {AGENCY_NAME[l.agency]}
                {l.note ? ` · ${l.note}` : ""}
              </small>
            </span>
            <span className="amt">{money(l.amount)}</span>
          </li>,
        ];
        if (l.refund) {
          rows.push(
            <li key={`${i}-refund`} className="refund">
              <span>↳ {l.refundFrom?.join(" + ")} fare refunded at GO tap</span>
              <span className="amt">−{money(l.refund)}</span>
            </li>,
          );
        }
        return rows;
      })}
    </ul>
  );
}
