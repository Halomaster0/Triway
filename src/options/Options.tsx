import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import vehicles from "../data/vehicles.json";
import { buildEstimate, currentGasPrice, type RouteMemory } from "../core/estimate";
import { computeFare, goFare } from "../core/fares/engine";
import { FARES_EFFECTIVE, LOCAL_FARES } from "../core/fares/fares";
import { CATEGORY_LABEL, riderCategory } from "../core/rider";
import { toTrim, type Agency, type DrivingMix, type Settings, type VehicleDb, type VehicleTrim } from "../core/types";
import { DEFAULT_SETTINGS, ext, loadLive, loadSettings, onLiveChanged, requestLiveRefresh, saveSettings, type LiveState } from "../shared/storage";
import { UpdateBanner } from "../ui/UpdateBanner";
import { AGENCY_COLOR, AGENCY_NAME } from "../ui/agencyColors";
import { CostCard } from "../ui/CostCard";
import { money, shortDate } from "../ui/format";
import { CarIcon, GasIcon, InfoIcon, Logo, PersonIcon } from "../ui/icons";

const db = vehicles as unknown as VehicleDb;
const YEARS = Object.keys(db.years).sort((a, b) => Number(b) - Number(a));
const FUEL_LABEL: Record<string, string> = { X: "Regular", Z: "Premium", D: "Diesel", E: "E85", N: "Natural gas" };

/** Sample trip for the live preview: UTM → Union Station. */
const SAMPLE: RouteMemory = {
  origin: { lat: 43.5483, lng: -79.6627 },
  destination: { lat: 43.6453, lng: -79.3806 },
  driveKm: 29.2,
  driveMinutes: 32,
  transitLegs: [
    { agency: "MiWay", label: "Bus 110" },
    { agency: "GO", label: "Lakeshore West" },
  ],
  transitMinutes: 76,
};

const SECTIONS = [
  { id: "car", label: "Your car", icon: <CarIcon /> },
  { id: "fuel", label: "Fuel price", icon: <GasIcon /> },
  { id: "fares", label: "Fare profile", icon: <PersonIcon /> },
  { id: "about", label: "About", icon: <InfoIcon /> },
];

export function trimLabel(t: VehicleTrim): string {
  return `${t.model} · ${t.engine} L · ${t.transmission}`;
}

function Segmented<T extends string>({ value, options, onChange, name }: { value: T; options: [T, string][]; onChange: (v: T) => void; name: string }) {
  return (
    <div className="seg" role="group" aria-label={name}>
      {options.map(([v, label]) => (
        <button key={v} aria-pressed={value === v} onClick={() => onChange(v)}>
          {value === v && <motion.span layoutId={`seg-${name}`} className="seg-bg" transition={{ duration: 0.18 }} />}
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

function Choice({ checked, onSelect, title, sub, icon }: { checked: boolean; onSelect: () => void; title: string; sub?: ReactNode; icon?: ReactNode }) {
  return (
    <motion.button role="radio" aria-checked={checked} className="choice" onClick={onSelect} whileTap={{ scale: 0.98 }}>
      <strong>
        {icon}
        {title}
      </strong>
      {sub && <small>{sub}</small>}
    </motion.button>
  );
}

function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="switchrow">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <button role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)}>
        <motion.span layout className="knob" transition={{ duration: 0.15 }} />
      </button>
    </div>
  );
}

function Panel({ id, title, icon, desc, children }: { id: string; title: string; icon: ReactNode; desc?: string; children: ReactNode }) {
  return (
    <section id={id} className="panel">
      <h2>
        {icon}
        {title}
      </h2>
      {desc && <p className="desc">{desc}</p>}
      {children}
    </section>
  );
}

export function Options() {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [live, setLive] = useState<LiveState>({ gas: null, update: null });
  const [saved, setSaved] = useState(false);
  const [active, setActive] = useState("car");
  const [carMode, setCarMode] = useState<"database" | "manual">("database");
  const [year, setYear] = useState(YEARS[0]);
  const [make, setMake] = useState("");
  const [query, setQuery] = useState("");
  const [trimIdx, setTrimIdx] = useState(-1);
  const savedTimer = useRef<number>();

  useEffect(() => {
    loadSettings().then((v) => {
      setS(v);
      if (v.vehicle?.source === "manual") setCarMode("manual");
      setLoaded(true);
    });
    loadLive().then(setLive);
    requestLiveRefresh();
    try {
      onLiveChanged(() => loadLive().then(setLive));
    } catch {
      // Not running as an extension page (tests).
    }
  }, []);

  // Highlight the section in view.
  useEffect(() => {
    if (!loaded || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id);
      },
      { rootMargin: "-10% 0px -60% 0px" },
    );
    SECTIONS.forEach((sec) => {
      const el = document.getElementById(sec.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [loaded]);

  const update = (next: Settings) => {
    setS(next);
    saveSettings(next).then(() => {
      setSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setSaved(false), 1500);
    });
  };

  const makes = useMemo(() => Object.keys(db.years[year] ?? {}).sort(), [year]);
  const trims = useMemo(() => (make ? (db.years[year]?.[make] ?? []).map(toTrim) : []), [year, make]);
  const shownTrims = trims
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => !query || trimLabel(t).toLowerCase().includes(query.toLowerCase()));

  const pickTrim = (idx: number) => {
    setTrimIdx(idx);
    const t = trims[idx];
    if (!t) return;
    update({
      ...s,
      vehicle: { source: "database", label: `${year} ${make} ${trimLabel(t)}`, city: t.city, hwy: t.hwy, comb: t.comb, fuel: t.fuel },
    });
  };

  if (!loaded) return null;
  const category = riderCategory(s.rider);
  const preview = buildEstimate(SAMPLE, s, live.gas);
  const avg = currentGasPrice({ ...s, gas: { mode: "auto", manualPrice: null } }, live.gas);
  const setRider = (r: Partial<Settings["rider"]>) => update({ ...s, rider: { ...s.rider, ...r } });
  const version = ext?.runtime?.getManifest?.().version ?? "dev";

  return (
    <div className="tw layout">
      <aside className="sidebar">
        <div className="brand">
          <Logo size={28} />
          Triway
        </div>
        <nav className="nav">
          {SECTIONS.map((sec) => (
            <a key={sec.id} href={`#${sec.id}`} className={active === sec.id ? "active" : ""} onClick={() => setActive(sec.id)}>
              {sec.icon}
              {sec.label}
            </a>
          ))}
        </nav>
      </aside>

      <main className="content">
        <h1>Settings</h1>
        <p className="lead">Triway compares the cost of driving and taking transit for your Google Maps routes in the GTA. Changes save automatically.</p>
        <div style={{ marginBottom: live.update?.version ? 20 : 0 }}>
          <UpdateBanner update={live.update} />
        </div>

        <section className="panel preview" aria-label="Preview">
          <div>
            <h2>Live preview</h2>
            <p className="desc" style={{ margin: 0 }}>
              University of Toronto Mississauga → Union Station, priced with your settings. This is the card you'll see on Google Maps.
            </p>
          </div>
          <CostCard estimate={preview} preview />
        </section>

        <Panel id="car" title="Your car" icon={<CarIcon />} desc="Used to work out how much fuel a drive takes.">
          <Segmented
            name="car"
            value={carMode}
            options={[
              ["database", "Find my car"],
              ["manual", "Enter my own"],
            ]}
            onChange={setCarMode}
          />
          <AnimatePresence mode="wait" initial={false}>
            {carMode === "database" ? (
              <motion.div key="db" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                <div className="grid2">
                  <label className="field">
                    <span>Model year</span>
                    <select id="year" className="input" value={year} onChange={(e) => (setYear(e.target.value), setMake(""), setTrimIdx(-1))}>
                      {YEARS.map((y) => (
                        <option key={y}>{y}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Make</span>
                    <select id="make" className="input" value={make} onChange={(e) => (setMake(e.target.value), setTrimIdx(-1), setQuery(""))}>
                      <option value="">Choose…</option>
                      {makes.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid2">
                  <label className="field">
                    <span>Search models</span>
                    <input
                      id="model-search"
                      className="input"
                      placeholder={make ? `e.g. ${trims[0]?.model ?? ""}` : "Pick a make first"}
                      disabled={!make}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Model · engine · transmission ({shownTrims.length})</span>
                    <select id="model" className="input" value={trimIdx} disabled={!make} onChange={(e) => pickTrim(Number(e.target.value))}>
                      <option value={-1}>Choose…</option>
                      {shownTrims.map(({ t, i }) => (
                        <option key={i} value={i}>
                          {trimLabel(t)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="muted" style={{ marginTop: -4 }}>
                  Natural Resources Canada ratings, {YEARS[YEARS.length - 1]}–{YEARS[0]}.
                  {Number(year) < 2015 && " Ratings before 2015 are NRCan's adjusted estimates, so treat them as approximate."}
                </p>
              </motion.div>
            ) : (
              <motion.div key="manual" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                <ManualCar
                  value={s.vehicle?.source === "manual" ? s.vehicle.comb : null}
                  onChange={(comb) => update({ ...s, vehicle: comb ? { source: "manual", label: "My car", comb } : null })}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {s.vehicle ? (
            <motion.div layout className="carcard" data-testid="current-car">
              <span className="name">
                {s.vehicle.label}
                {s.vehicle.fuel && (
                  <>
                    {" "}
                    <span className={`badge${s.vehicle.fuel === "X" ? "" : " warn"}`}>{FUEL_LABEL[s.vehicle.fuel]}</span>
                  </>
                )}
                <span className="muted" style={{ display: "block" }}>
                  {s.vehicle.comb} L/100 km combined
                  {s.vehicle.fuel && s.vehicle.fuel !== "X" ? " · needs pricier fuel, consider entering your own gas price" : ""}
                </span>
              </span>
              {s.vehicle.city ? (
                <>
                  <span className="stat">
                    <b>{s.vehicle.city}</b>
                    <small>City</small>
                  </span>
                  <span className="stat">
                    <b>{s.vehicle.hwy}</b>
                    <small>Highway</small>
                  </span>
                </>
              ) : null}
              <span className="stat">
                <b>{s.vehicle.comb}</b>
                <small>Combined</small>
              </span>
            </motion.div>
          ) : (
            <div className="info" style={{ margin: "4px 0 16px" }}>
              <InfoIcon size={16} /> No car yet. The card can't show a driving cost until you pick one.
            </div>
          )}

          <div className="field">
            <span>How you usually drive</span>
            <div className="grid3" role="radiogroup" aria-label="Driving mix">
              {(
                [
                  ["city", "Mostly city", "Stop-and-go, uses the city rating"],
                  ["combined", "Mixed", "Uses the combined rating"],
                  ["highway", "Mostly highway", "401, QEW, Gardiner…"],
                ] as [DrivingMix, string, string][]
              ).map(([v, t, sub]) => (
                <Choice key={v} checked={s.drivingMix === v} onSelect={() => update({ ...s, drivingMix: v })} title={t} sub={sub} />
              ))}
            </div>
          </div>
        </Panel>

        <Panel id="fuel" title="Fuel price" icon={<GasIcon />} desc="Price per litre of regular gas.">
          <div className="grid2" role="radiogroup" aria-label="Gas price source">
            <Choice
              checked={s.gas.mode === "auto"}
              onSelect={() => update({ ...s, gas: { ...s.gas, mode: "auto" } })}
              title="GTA average"
              sub={`$${avg.price.toFixed(3)}/L · Toronto / GTA, week of ${shortDate(avg.date)} · updates weekly`}
            />
            <Choice
              checked={s.gas.mode === "manual"}
              onSelect={() => update({ ...s, gas: { ...s.gas, mode: "manual" } })}
              title="My price"
              sub={s.gas.manualPrice ? `$${s.gas.manualPrice.toFixed(3)}/L` : "Use what your station charges"}
            />
          </div>
          <AnimatePresence initial={false}>
            {s.gas.mode === "manual" && (
              <motion.label
                className="field"
                style={{ marginTop: 14, overflow: "hidden" }}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <span>Price per litre</span>
                <span className="suffix" style={{ maxWidth: 220 }}>
                  <input
                    id="gas"
                    className="input"
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder={avg.price.toFixed(3)}
                    value={s.gas.manualPrice ?? ""}
                    onChange={(e) => update({ ...s, gas: { ...s.gas, manualPrice: e.target.value ? Number(e.target.value) : null } })}
                  />
                </span>
              </motion.label>
            )}
          </AnimatePresence>
        </Panel>

        <Panel id="fares" title="Fare profile" icon={<PersonIcon />} desc="PRESTO fares depend on your age and discounts.">
          <div className="field">
            <span>Age</span>
            <div className="stepper">
              <button aria-label="Younger" onClick={() => setRider({ age: Math.max(0, (s.rider.age ?? 30) - 1) })}>
                −
              </button>
              <input
                id="age"
                type="number"
                min="0"
                max="120"
                placeholder="—"
                value={s.rider.age ?? ""}
                onChange={(e) => setRider({ age: e.target.value ? Number(e.target.value) : null })}
              />
              <button aria-label="Older" onClick={() => setRider({ age: Math.min(120, (s.rider.age ?? 29) + 1) })}>
                +
              </button>
            </div>
          </div>
          <Switch
            label="Full-time post-secondary student"
            hint="40% off GO. The TTC has no per-ride student discount."
            checked={s.rider.postSecondary}
            onChange={(v) => setRider({ postSecondary: v })}
          />
          <Switch label="TTC Fair Pass" hint="Low-income discount on TTC rides." checked={s.rider.fairPass} onChange={(v) => setRider({ fairPass: v })} />
          <Switch
            label="Brampton resident"
            hint="Brampton seniors ride Brampton Transit free."
            checked={s.rider.bramptonResident}
            onChange={(v) => setRider({ bramptonResident: v })}
          />
          <p data-testid="category" style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 4px" }}>
            Fare type: <span className="badge">{CATEGORY_LABEL[category]}</span>
          </p>
          <p className="muted">Your PRESTO card needs to be set to this fare type to get the discount.</p>
          <FareTable settings={s} />
        </Panel>

        <Panel id="about" title="About" icon={<InfoIcon />}>
          <div className="about">
            <p>
              Fares effective {FARES_EFFECTIVE}, from each agency's fare page. GO fares are estimated from distance, and HSR fares
              aren't verified yet.
            </p>
            <p>
              Car ratings: <a href="https://open.canada.ca/data/en/dataset/98f1a129-f628-4ce4-b24d-6f16bf24dd64">Natural Resources Canada</a>,
              updated monthly. Gas price: Ontario's weekly Toronto average (currently {shortDate(avg.date)}), refreshed daily from GitHub.
            </p>
            <p className="muted">
              Triway {version}. Your settings stay in your browser. The only network requests are a daily check for the gas
              price and for new versions on GitHub; neither sends anything about you.
            </p>
          </div>
        </Panel>
      </main>

      <AnimatePresence>
        {saved && (
          <motion.div
            className="toast"
            role="status"
            initial={{ opacity: 0, y: 12, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 12, x: "-50%" }}
            transition={{ duration: 0.18 }}
          >
            Saved
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const TABLE_AGENCIES: Agency[] = ["TTC", "GO", "MiWay", "Brampton", "YRT", "DRT", "HSR"];

/** What one ride costs on each agency for this fare profile. */
function FareTable({ settings }: { settings: Settings }) {
  const category = riderCategory(settings.rider);
  return (
    <table className="faretable">
      <tbody>
        {TABLE_AGENCIES.map((a) => {
          const price = a === "GO" ? goFare(10, category) : computeFare([{ agency: a, label: a }], settings.rider).total;
          return (
            <tr key={a}>
              <td>
                <span className="dotname">
                  <i style={{ background: AGENCY_COLOR[a] }} />
                  {AGENCY_NAME[a]}
                  {a === "GO" && <span className="muted">from, short trips</span>}
                  {a !== "GO" && LOCAL_FARES[a].unverified && <span className="muted">unverified</span>}
                </span>
              </td>
              <td>{price === 0 ? "Free" : money(price)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ManualCar({ value, onChange }: { value: number | null; onChange: (lPer100: number | null) => void }) {
  const [mpg, setMpg] = useState("");
  return (
    <div className="grid2">
      <label className="field">
        <span>L/100 km</span>
        <input
          id="l100"
          className="input"
          type="number"
          step="0.1"
          min="0"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        />
      </label>
      <label className="field">
        <span>or MPG (US)</span>
        <input
          id="mpg"
          className="input"
          type="number"
          step="0.1"
          min="0"
          value={mpg}
          onChange={(e) => {
            setMpg(e.target.value);
            const n = Number(e.target.value);
            if (n > 0) onChange(Math.round((235.215 / n) * 10) / 10);
          }}
        />
      </label>
    </div>
  );
}
