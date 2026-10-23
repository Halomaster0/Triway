// Builds and zips the extension for release: release/triway-<browser>-v<version>.zip.
// The GitHub release workflow runs this on every v* tag.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
execFileSync("npx", ["tsx", "scripts/build.ts"], { stdio: "inherit" });
rmSync("release", { recursive: true, force: true });
mkdirSync("release");
for (const target of ["chrome", "firefox"]) {
  const out = resolve(`release/triway-${target}-v${version}.zip`);
  execFileSync("zip", ["-qr", "-X", out, "."], { cwd: `dist/${target}` });
  console.log(`Packed ${out}`);
}
