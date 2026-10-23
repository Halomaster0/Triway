import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { money } from "./format";
import { CarIcon, CheckIcon, TrainIcon } from "./icons";

interface Props {
  kind: "drive" | "transit";
  price: number | null;
  /** Show "≈" with this explanation as a tooltip. */
  approx?: string | false;
  meta?: ReactNode;
  /** Shown instead of a price when there is none. */
  empty?: ReactNode;
  /** This option is cheaper by `savings`. */
  savings?: number | null;
  loading?: boolean;
  children?: ReactNode;
}

export function PriceTile({ kind, price, approx, meta, empty, savings, loading, children }: Props) {
  const best = savings !== undefined && savings !== null && savings > 0;
  return (
    <motion.div layout="position" className={`tile${best ? " best" : ""}`} data-testid={kind}>
      <div className="tile-label">
        {kind === "drive" ? <CarIcon size={16} /> : <TrainIcon size={16} />}
        {kind === "drive" ? "Drive" : "Transit"}
      </div>
      {loading ? (
        <motion.div
          aria-label="Loading"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        >
          <div className="skeleton" style={{ width: "70%", height: 22 }} />
          <div className="skeleton" style={{ width: "90%" }} />
        </motion.div>
      ) : price === null ? (
        <div className="meta" style={{ marginTop: 6 }}>
          {empty}
        </div>
      ) : (
        <>
          <div className="price">
            {approx && (
              <span className="approx" title={approx}>
                ≈
              </span>
            )}
            {money(price)}
          </div>
          {meta && <div className="meta">{meta}</div>}
        </>
      )}
      <AnimatePresence>
        {best && (
          <motion.span
            className="chip"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <CheckIcon size={12} /> Saves {money(savings!)}
          </motion.span>
        )}
      </AnimatePresence>
      {children}
    </motion.div>
  );
}
