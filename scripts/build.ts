// Bundles the extension for Chrome and Firefox into dist/chrome and dist/firefox.
import { context, type BuildOptions } from "esbuild";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const TARGETS = ["chrome", "firefox"] as const;
const MAPS = ["https://www.google.com/maps/*", "https://www.google.ca/maps/*"];

function manifest(target: (typeof TARGETS)[number]) {
  return {
    manifest_version: 3,
    name: "Triway: GTA trip cost",
    short_name: "Triway",
    version: pkg.version,
    description: "Shows the fuel cost of a Google Maps route and the PRESTO transit fare for the same trip in the GTA.",
    permissions: ["storage"],
    content_scripts: [{ matches: MAPS, js: ["content.js"], run_at: "document_idle" }],
    background: target === "chrome" ? { service_worker: "background.js" } : { scripts: ["background.js"] },
    action: { default_popup: "popup.html", default_title: "Triway", default_icon: icons() },
    options_ui: { page: "options.html", open_in_tab: true },
    icons: icons(),
    // Public key only: pins the Chrome extension ID (jdcgiaefoeldnmnplhadgjfcchkpjoab) so an unpacked
    // install keeps its settings when the folder is moved or replaced on update.
    ...(target === "chrome" && { key: readFileSync("assets/extension-key.pub.txt", "utf8").trim() }),
    ...(target === "firefox" && {
      browser_specific_settings: { gecko: { id: "triway@halomaster0.github.io", strict_min_version: "115.0" } },
    }),
  };
}

const ICON_SIZES = [16, 32, 48, 128];
const icons = () => Object.fromEntries(ICON_SIZES.map((s) => [s, `icon-${s}.png`]));

const page = (title: string, script: string) => `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body><div id="root"></div><script src="${script}"></script></body>
</html>
`;

// `npm run watch` keeps rebuilding dist/ on save; reload the extension in the browser to pick it up.
const WATCH = process.argv.includes("--watch");

async function main() {
  rmSync("dist", { recursive: true, force: true });
  for (const target of TARGETS) {
    const out = `dist/${target}`;
    mkdirSync(out, { recursive: true });
    const options: BuildOptions = {
      entryPoints: {
        content: "src/content/index.tsx",
        background: "src/background.ts",
        options: "src/options/main.tsx",
        popup: "src/popup/main.tsx",
      },
      outdir: out,
      bundle: true,
      format: "iife",
      target: target === "chrome" ? "chrome110" : "firefox115",
      minify: true,
      jsx: "automatic",
      define: { "process.env.NODE_ENV": '"production"' },
      logLevel: "warning",
    };
    const ctx = await context(options);
    if (WATCH) await ctx.watch();
    else {
      await ctx.rebuild();
      await ctx.dispose();
    }
    writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest(target), null, 2));
    writeFileSync(`${out}/options.html`, page("Triway settings", "options.js"));
    writeFileSync(`${out}/popup.html`, page("Triway", "popup.js"));
    // Rendered from assets/icon.svg by `npm run icons`.
    for (const s of ICON_SIZES) copyFileSync(`assets/icon-${s}.png`, `${out}/icon-${s}.png`);
    console.log(`Built ${out}`);
  }
  if (WATCH) console.log("Watching src/ for changes. Press Ctrl+C to stop.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
