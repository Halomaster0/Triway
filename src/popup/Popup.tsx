import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { currentGasPrice } from "../core/estimate";
import { computeFare } from "../core/fares/engine";
import { fuelCost, litresPer100 } from "../core/fuel";
import { CATEGORY_LABEL } from "../core/rider";
import type { Agency, Settings } from "../core/types";
import { loadLive, loadSettings, openOptionsPage, requestLiveRefresh, type LiveState } from "../shared/storage";
import { UpdateBanner } from "../ui/UpdateBanner";
import { AGENCY_NAME } from "../ui/agencyColors";
import { FareTimeline } from "../ui/FareTimeline";
import { GearIcon, Logo } from "../ui/icons";
import { PriceTile } from "../ui/PriceTile";

const AGENCIES: Agency[] = ["TTC", "GO", "MiWay", "Brampton", "YRT", "DRT", "HSR"];

/** Quick calculator for when you are not on Google Maps. */
export function Popup() {
  const [s, setS] = useState<Settings | null>(null);
  const [live, setLive] = useState<LiveState>({ gas: null, update: null });
  const [km, setKm] = useState("20");
  const [first, setFirst] = useState<Agency>("TTC");
  const [second, setSecond] = useState<Agency | "">("");

  useEffect(() => {
    loadSettings().then(setS);
    loadLive().then(setLive);
    requestLiveRefresh();
  }, []);
  if (!s) return null;

  const dist = Number(km) || 0;
  const gas = currentGasPrice(s, live.gas);
  const drive = s.vehicle ? fuelCost(dist, litresPer100(s.vehicle, s.drivingMix), gas.price) : null;
  const legs = [first, second].filter(Boolean).map((a) => ({ agency: a as Agency, label: AGENCY_NAME[a as Agency] }));
  const fare = computeFare(legs, s.rider, { goKmFallback: dist });
  const diff = drive ? Math.round((drive.cost - fare.total) * 100) / 100 : null;

  return (
    <div className="tw popup">
      <div className="popup-head">
        <span className="brand">
          <Logo size={22} />
          Triway
        </span>
        <button className="iconbtn" aria-label="Settings" onClick={openOptionsPage}>
          <GearIcon />
        </button>
      </div>
      <div className="popup-body">
        <div style={{ marginBottom: live.update?.version ? 12 : 0 }}>
          <UpdateBanner update={live.update} />
        </div>
        <label className="field">
          <span>Trip distance (km)</span>
          <input id="km" className="input" type="number" min="0" value={km} onChange={(e) => setKm(e.target.value)} />
        </label>
        <div className="grid2">
          <label className="field">
            <span>Transit</span>
            <select id="a1" className="input" value={first} onChange={(e) => setFirst(e.target.value as Agency)}>
              {AGENCIES.map((a) => (
                <option key={a} value={a}>
                  {AGENCY_NAME[a]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Then</span>
            <select id="a2" className="input" value={second} onChange={(e) => setSecond(e.target.value as Agency | "")}>
              <option value="">Nothing</option>
              {AGENCIES.map((a) => (
                <option key={a} value={a}>
                  {AGENCY_NAME[a]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="tiles">
          <PriceTile
            kind="drive"
            price={drive?.cost ?? null}
            empty="Add your car in settings"
            savings={diff !== null && diff < 0 ? -diff : null}
            meta={drive && `${drive.litres.toFixed(1)} L at $${gas.price.toFixed(3)}/L`}
          />
          <PriceTile
            kind="transit"
            price={fare.total}
            approx={fare.estimated && "GO fares are estimated from distance"}
            savings={diff !== null && diff > 0 ? diff : null}
            meta={`PRESTO · ${CATEGORY_LABEL[fare.category]}`}
          />
        </div>
        {legs.length > 1 && <FareTimeline lines={fare.lines} />}
        <p className="muted" style={{ margin: "12px 0" }}>
          On Google Maps, open directions in the GTA and Triway prices that route for you.
        </p>
        <motion.button className="btn" whileTap={{ scale: 0.97 }} onClick={openOptionsPage} style={{ width: "100%", boxSizing: "border-box" }}>
          <GearIcon size={18} /> Open settings
        </motion.button>
      </div>
    </div>
  );
}
