// Shared styles. Injected into the Maps shadow root and the extension pages.
// Visual language follows Google Maps (surfaces, radii, elevation, type) so
// the card reads as part of the page; the teal→blue accent is used sparingly.
export const BASE_CSS = `
:host, :root {
  --surface: #ffffff;
  --tile: #f1f3f4;
  --tile-hover: #e8eaed;
  --fg: #202124;
  --muted: #5f6368;
  --line: #dadce0;
  --accent: #1a73e8;
  --accent-2: #12b5b0;
  --accent-soft: #e8f0fe;
  --good: #188038;
  --good-soft: #e6f4ea;
  --warn: #b06000;
  --warn-soft: #fef7e0;
  --shadow: 0 1px 2px rgba(60,64,67,.3), 0 2px 6px 2px rgba(60,64,67,.15);
  --shadow-lg: 0 1px 3px rgba(60,64,67,.3), 0 4px 8px 3px rgba(60,64,67,.15);
  --font: "Google Sans", "Google Sans Text", Roboto, system-ui, -apple-system, "Segoe UI", sans-serif;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :host, :root {
    --surface: #202124;
    --tile: #2d2e31;
    --tile-hover: #35363a;
    --fg: #e8eaed;
    --muted: #9aa0a6;
    --line: #3c4043;
    --accent: #8ab4f8;
    --accent-2: #4fd1c5;
    --accent-soft: #283142;
    --good: #81c995;
    --good-soft: #1e3a2a;
    --warn: #fdd663;
    --warn-soft: #3b3420;
    --shadow: 0 1px 2px rgba(0,0,0,.5), 0 2px 6px 2px rgba(0,0,0,.3);
    --shadow-lg: 0 1px 3px rgba(0,0,0,.5), 0 4px 8px 3px rgba(0,0,0,.3);
  }
}
* { box-sizing: border-box; }
.tw { font: 14px/1.43 var(--font); color: var(--fg); -webkit-font-smoothing: antialiased; }
.tw button { font: inherit; color: inherit; }
.tw svg { flex: none; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px; }

/* Card on Google Maps */
.card {
  width: 340px; background: var(--surface); border-radius: 16px; box-shadow: var(--shadow-lg);
  max-height: calc(100vh - 280px); overflow: auto; overscroll-behavior: contain;
}
.card-head {
  display: flex; align-items: center; gap: 8px; padding: 10px 8px 6px 14px;
  cursor: grab; user-select: none; touch-action: none;
}
.card-head:active { cursor: grabbing; }
.brand { display: flex; align-items: center; gap: 8px; font-weight: 500; font-size: 14px; flex: 1; }
.iconbtn {
  all: unset; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%;
  color: var(--muted); cursor: pointer;
}
.iconbtn:hover { background: var(--tile); }
.card-body { padding: 4px 12px 12px; }
.tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.tile {
  position: relative; background: var(--tile); border-radius: 12px; padding: 10px 12px;
  border: 1.5px solid transparent; min-height: 96px;
}
.tile.best { background: var(--good-soft); border-color: color-mix(in srgb, var(--good) 45%, transparent); }
.tile-label { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 12px; font-weight: 500; }
.price { font-size: 24px; font-weight: 500; letter-spacing: -0.3px; margin-top: 2px; display: flex; align-items: baseline; gap: 2px; }
.approx { font-size: 16px; color: var(--muted); }
.meta { color: var(--muted); font-size: 12px; line-height: 1.35; }
.chip {
  display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; padding: 2px 8px; border-radius: 999px;
  font-size: 11px; font-weight: 500; background: var(--surface); color: var(--good); white-space: nowrap;
}
.chip.neutral { color: var(--muted); }
.textbtn { all: unset; color: var(--accent); cursor: pointer; font-size: 12px; font-weight: 500; }
.textbtn:hover { text-decoration: underline; }
.skeleton { height: 12px; border-radius: 6px; background: var(--tile-hover); margin-top: 8px; }
.notes { margin-top: 8px; display: grid; gap: 6px; }
.info {
  display: flex; gap: 8px; align-items: flex-start; font-size: 12px; color: var(--muted);
  background: var(--tile); border-radius: 10px; padding: 8px 10px;
}
.info.warn { background: var(--warn-soft); color: var(--warn); }
.info.update { background: var(--accent-soft); color: var(--fg); }
.info.update a { color: var(--accent); font-weight: 500; }
.section-toggle {
  all: unset; display: flex; align-items: center; justify-content: space-between; width: 100%;
  margin-top: 10px; padding: 6px 2px; color: var(--fg); font-size: 13px; font-weight: 500; cursor: pointer;
}
.timeline { list-style: none; margin: 4px 0 0; padding: 0; }
.timeline li { position: relative; display: flex; justify-content: space-between; gap: 8px; padding: 5px 0 5px 22px; font-size: 13px; }
.timeline li::before { content: ""; position: absolute; left: 6px; top: 0; bottom: 0; width: 2px; background: var(--line); }
.timeline li:first-child::before { top: 50%; }
.timeline li:last-child::before { bottom: 50%; }
.timeline .dot { position: absolute; left: 1px; top: 50%; width: 12px; height: 12px; margin-top: -6px; border-radius: 50%; border: 2px solid var(--surface); }
.timeline li.refund { color: var(--good); font-size: 12px; padding-left: 34px; }
.timeline .ride { display: flex; flex-direction: column; min-width: 0; }
.timeline .ride small { color: var(--muted); font-size: 11px; }
.timeline .amt { font-variant-numeric: tabular-nums; white-space: nowrap; }
.card-foot {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px;
}
.menu {
  position: absolute; right: 8px; top: 40px; z-index: 2; min-width: 180px; padding: 6px 0;
  background: var(--surface); border-radius: 8px; box-shadow: var(--shadow-lg);
}
.menu button { all: unset; display: block; width: 100%; box-sizing: border-box; padding: 8px 16px; font-size: 13px; cursor: pointer; }
.menu button:hover { background: var(--tile); }
.pill {
  all: unset; display: inline-flex; align-items: center; gap: 10px; padding: 8px 14px 8px 10px;
  background: var(--surface); border-radius: 999px; box-shadow: var(--shadow); cursor: pointer; font: 500 13px var(--font); color: var(--fg);
}
.pill span { display: inline-flex; align-items: center; gap: 4px; }
.logo { display: block; border-radius: 6px; }
`;

export const PAGE_CSS = `
body { margin: 0; background: var(--page, #f8f9fa); }
@media (prefers-color-scheme: dark) { body { background: #17181b; } }
.layout { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
.sidebar { position: sticky; top: 0; height: 100vh; padding: 24px 12px; border-right: 1px solid var(--line); background: var(--surface); }
.sidebar .brand { padding: 0 12px 20px; font-size: 18px; }
.nav { display: grid; gap: 2px; }
.nav a {
  display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 999px;
  color: var(--fg); text-decoration: none; font-weight: 500; font-size: 14px;
}
.nav a:hover { background: var(--tile); }
.nav a.active { background: var(--accent-soft); color: var(--accent); }
.content { padding: 32px 40px 80px; max-width: 760px; width: 100%; }
.content h1 { font-size: 24px; font-weight: 400; margin: 0 0 4px; }
.lead { color: var(--muted); margin: 0 0 24px; }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 20px 24px; margin-bottom: 20px; scroll-margin-top: 24px; }
.panel h2 { display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 500; margin: 0 0 4px; }
.panel .desc { color: var(--muted); font-size: 13px; margin: 0 0 16px; }
.preview { display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: center; background: linear-gradient(135deg, color-mix(in srgb, var(--accent-2) 14%, var(--surface)), color-mix(in srgb, var(--accent) 14%, var(--surface))); }
.preview .card { box-shadow: var(--shadow); max-height: none; }
.field { display: grid; gap: 6px; margin-bottom: 14px; }
.field > span { font-size: 12px; font-weight: 500; color: var(--muted); }
.input, select.input {
  width: 100%; height: 40px; padding: 0 12px; border: 1px solid var(--line); border-radius: 8px;
  background: var(--surface); color: var(--fg); font: inherit;
}
.input:focus { outline: 2px solid var(--accent); outline-offset: -1px; border-color: transparent; }
.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.seg { display: inline-flex; padding: 3px; gap: 2px; background: var(--tile); border-radius: 999px; margin-bottom: 16px; }
.seg button { all: unset; padding: 6px 16px; border-radius: 999px; cursor: pointer; font-size: 13px; font-weight: 500; color: var(--muted); position: relative; }
.seg button[aria-pressed=true] { color: var(--fg); }
.seg .seg-bg { position: absolute; inset: 0; background: var(--surface); border-radius: 999px; box-shadow: 0 1px 2px rgba(60,64,67,.3); z-index: 0; }
.seg button span { position: relative; z-index: 1; }
.choice {
  all: unset; box-sizing: border-box; display: grid; gap: 4px; padding: 14px; border: 1.5px solid var(--line); border-radius: 12px; cursor: pointer;
}
.choice:hover { background: var(--tile); }
.choice[aria-checked=true] { border-color: var(--accent); background: var(--accent-soft); }
.choice strong { font-weight: 500; display: flex; align-items: center; gap: 8px; }
.choice small { color: var(--muted); }
.carcard { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 12px; background: var(--tile); margin: 4px 0 16px; }
.carcard .name { flex: 1 1 200px; font-weight: 500; }
.stat { display: grid; padding: 4px 12px; border-radius: 8px; background: var(--surface); text-align: center; min-width: 64px; }
.stat b { font-size: 16px; font-weight: 500; }
.stat small { color: var(--muted); font-size: 11px; }
.badge { display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 500; background: var(--accent-soft); color: var(--accent); }
.badge.warn { background: var(--warn-soft); color: var(--warn); }
.switchrow { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 0; border-top: 1px solid var(--line); }
.switchrow:first-of-type { border-top: 0; }
.switchrow small { display: block; color: var(--muted); font-size: 12px; }
.switch { all: unset; width: 36px; height: 20px; border-radius: 999px; background: var(--line); display: flex; padding: 2px; cursor: pointer; flex: none; }
.switch[aria-checked=true] { background: var(--accent); justify-content: flex-end; }
.switch .knob { width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.3); }
.stepper { justify-self: start; display: inline-flex; align-items: center; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.stepper button { all: unset; width: 40px; height: 40px; display: grid; place-items: center; cursor: pointer; font-size: 18px; color: var(--muted); }
.stepper button:hover { background: var(--tile); }
.stepper input { width: 64px; height: 40px; border: 0; text-align: center; font: inherit; background: transparent; color: var(--fg); }
.faretable { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 12px; }
.faretable td { padding: 8px 4px; border-top: 1px solid var(--line); }
.faretable td:last-child { text-align: right; font-variant-numeric: tabular-nums; font-weight: 500; }
.faretable .dotname { display: inline-flex; align-items: center; gap: 8px; }
.faretable .dotname i { width: 10px; height: 10px; border-radius: 50%; }
.suffix { position: relative; }
.suffix .input { padding-left: 24px; padding-right: 40px; }
.suffix::before { content: "$"; position: absolute; left: 12px; top: 10px; color: var(--muted); }
.suffix::after { content: "/L"; position: absolute; right: 12px; top: 10px; color: var(--muted); }
.muted { color: var(--muted); font-size: 12px; }
.about p { margin: 0 0 8px; font-size: 13px; }
.about a { color: var(--accent); }
.toast {
  position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); padding: 10px 20px; border-radius: 8px;
  background: #323232; color: #fff; font-size: 14px; box-shadow: var(--shadow-lg);
}
@media (max-width: 760px) {
  .layout { grid-template-columns: 1fr; }
  .sidebar { position: sticky; height: auto; padding: 12px; border-right: 0; border-bottom: 1px solid var(--line); z-index: 5; }
  .sidebar .brand { padding: 0 4px 8px; }
  .nav { grid-auto-flow: column; overflow-x: auto; }
  .nav a { padding: 8px 12px; white-space: nowrap; font-size: 13px; }
  .content { padding: 20px 16px 80px; }
  .preview { grid-template-columns: 1fr; }
  .grid3, .grid2 { grid-template-columns: 1fr; }
}

/* Popup */
.popup { width: 340px; background: var(--surface); }
.popup .grid2 { grid-template-columns: 1fr 1fr; }
.popup-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--line); }
.popup-body { padding: 14px; }
.btn {
  all: unset; display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 36px; padding: 0 16px;
  border-radius: 999px; font-weight: 500; font-size: 14px; cursor: pointer; color: var(--accent); border: 1px solid var(--line);
}
.btn:hover { background: var(--accent-soft); }
`;
