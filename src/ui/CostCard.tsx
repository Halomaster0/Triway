import { AnimatePresence, motion, useDragControls, useMotionValue } from "motion/react";
import { useEffect, useState, type PointerEvent } from "react";
import type { Estimate } from "../core/estimate";
import { CATEGORY_LABEL } from "../core/rider";
import { FareTimeline } from "./FareTimeline";
import { minutes, money, shortDate } from "./format";
import { CarIcon, ChevronIcon, GasIcon, GearIcon, InfoIcon, Logo, MinimizeIcon, MoreIcon, TrainIcon } from "./icons";
import { PriceTile } from "./PriceTile";

export interface Offset {
  x: number;
  y: number;
}

interface Props {
  estimate: Estimate;
  onSettings?: () => void;
  onOpenTransit?: () => void;
  onCopyDebug?: () => Promise<void> | void;
  onHide?: () => void;
  /** Where the user dragged the card to, relative to its default spot. */
  offset?: Offset;
  onOffsetChange?: (o: Offset) => void;
  /** Static rendering for the settings preview: no drag, menu or minimise. */
  preview?: boolean;
}

const fade = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 8 }, transition: { duration: 0.18 } };

export function CostCard({ estimate, onSettings, onOpenTransit, onCopyDebug, onHide, offset, onOffsetChange, preview }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [showLegs, setShowLegs] = useState(false);
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const drag = useDragControls();
  const x = useMotionValue(offset?.x ?? 0);
  const y = useMotionValue(offset?.y ?? 0);
  useEffect(() => {
    x.set(offset?.x ?? 0);
    y.set(offset?.y ?? 0);
  }, [offset?.x, offset?.y, x, y]);

  const { drive, transit, gas } = estimate;
  const refunded = transit?.lines.reduce((sum, l) => sum + (l.refund ?? 0), 0) ?? 0;
  const diff = drive && transit ? Math.round((drive.cost - transit.total) * 100) / 100 : null;

  const startDrag = (e: PointerEvent) => {
    if (preview || (e.target as Element).closest("button")) return;
    drag.start(e);
  };

  const notes: Array<{ text: string; warn?: boolean }> = [];
  if (drive?.hasTolls) notes.push({ text: "This route has tolls (e.g. 407 ETR); they aren't included." });
  if (drive?.kmEstimated) notes.push({ text: "Driving distance is estimated. Open driving directions for the exact figure." });
  if (showLegs && refunded > 0)
    notes.push({ text: `You're charged ${money(refunded)} at your first tap; it comes back when you tap onto GO within 2 hours.` });
  if (showLegs) transit?.warnings.forEach((w) => notes.push({ text: w, warn: true }));

  return (
    <motion.div
      className="tw"
      drag={!preview}
      dragControls={drag}
      dragListener={false}
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={
        preview ? undefined : { left: -(window.innerWidth - 380), right: 8, top: -(window.innerHeight - 300), bottom: 180 }
      }
      onDragEnd={() => onOffsetChange?.({ x: Math.round(x.get()), y: Math.round(y.get()) })}
      style={{ x, y, display: "flex", justifyContent: "flex-end" }}
    >
      <AnimatePresence mode="wait" initial>
        {collapsed ? (
          <motion.button key="pill" className="pill" onClick={() => setCollapsed(false)} aria-label="Show trip cost" {...fade}>
            <Logo size={20} />
            {drive && (
              <span>
                <CarIcon size={16} /> {money(drive.cost)}
              </span>
            )}
            {transit && (
              <span>
                <TrainIcon size={16} /> {money(transit.total)}
              </span>
            )}
          </motion.button>
        ) : (
          <motion.div key="card" className="card" role="region" aria-label="Trip cost" {...fade} style={{ position: "relative" }}>
            <div className="card-head" onPointerDown={startDrag}>
              <span className="brand">
                <Logo size={20} />
                Trip cost
              </span>
              {!preview && (
                <>
                  <button className="iconbtn" aria-label="More options" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
                    <MoreIcon />
                  </button>
                  <button className="iconbtn" aria-label="Minimise" onClick={() => setCollapsed(true)}>
                    <MinimizeIcon />
                  </button>
                </>
              )}
            </div>

            <AnimatePresence>
              {menu && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 1 }} onClick={() => setMenu(false)} />
                  <motion.div
                    className="menu"
                    role="menu"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    style={{ transformOrigin: "top right" }}
                  >
                    {onSettings && (
                      <button role="menuitem" onClick={() => (setMenu(false), onSettings())}>
                        Settings
                      </button>
                    )}
                    {(offset?.x || offset?.y) && onOffsetChange ? (
                      <button role="menuitem" onClick={() => (setMenu(false), onOffsetChange({ x: 0, y: 0 }))}>
                        Reset position
                      </button>
                    ) : null}
                    {onCopyDebug && (
                      <button
                        role="menuitem"
                        title="Copies what Triway read from this page, for bug reports"
                        onClick={async () => {
                          await onCopyDebug();
                          setCopied(true);
                          setTimeout(() => (setCopied(false), setMenu(false)), 900);
                        }}
                      >
                        {copied ? "Copied" : "Copy debug info"}
                      </button>
                    )}
                    {onHide && (
                      <button role="menuitem" onClick={() => (setMenu(false), onHide())}>
                        Hide on this route
                      </button>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            <div className="card-body">
              <div className="tiles">
                <PriceTile
                  kind="drive"
                  price={drive?.cost ?? null}
                  approx={drive?.kmEstimated && "Distance estimated from a straight line"}
                  empty={estimate.driveNote}
                  savings={diff !== null && diff < 0 ? -diff : null}
                  meta={
                    drive && (
                      <>
                        {drive.km.toFixed(1)} km{drive.minutes ? ` · ${minutes(drive.minutes)}` : ""}
                        <br />
                        {drive.litres.toFixed(1)} L of gas
                      </>
                    )
                  }
                />
                <PriceTile
                  kind="transit"
                  price={transit?.total ?? null}
                  approx={transit?.estimated && "GO fares are estimated from distance"}
                  empty={estimate.transitNote}
                  loading={estimate.transitPending}
                  savings={diff !== null && diff > 0 ? diff : null}
                  meta={
                    transit && (
                      <>
                        {transit.minutes ? `${minutes(transit.minutes)} · ` : ""}PRESTO
                        <br />
                        {CATEGORY_LABEL[transit.category]}
                      </>
                    )
                  }
                >
                  {estimate.transitNeedsTab && onOpenTransit && (
                    <div className="meta" style={{ marginTop: 6 }}>
                      Rough guess.{" "}
                      <button className="textbtn" onClick={onOpenTransit}>
                        Open the Transit tab
                      </button>
                    </div>
                  )}
                </PriceTile>
              </div>

              {transit && transit.lines.length > 0 && (
                <button className="section-toggle" aria-expanded={showLegs} onClick={() => setShowLegs((v) => !v)}>
                  Fare breakdown
                  <ChevronIcon up={showLegs} />
                </button>
              )}
              <AnimatePresence initial={false}>
                {transit && showLegs && (
                  <motion.div
                    key="legs"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    style={{ overflow: "hidden" }}
                  >
                    <FareTimeline lines={transit.lines} />
                  </motion.div>
                )}
              </AnimatePresence>

              {notes.length > 0 && (
                <div className="notes">
                  {notes.map((n) => (
                    <div key={n.text} className={`info${n.warn ? " warn" : ""}`}>
                      <InfoIcon size={16} />
                      <span>{n.text}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="card-foot">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <GasIcon size={16} />${gas.price.toFixed(3)}/L · {gas.source === "manual" ? "your price" : `GTA avg, ${shortDate(gas.date)}`}
                </span>
                {onSettings && !preview && (
                  <button className="iconbtn" aria-label="Settings" onClick={onSettings} style={{ width: 28, height: 28 }}>
                    <GearIcon size={18} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
