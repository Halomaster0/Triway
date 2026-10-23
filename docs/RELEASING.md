# Releasing Triway

Releases are built by GitHub Actions. You only bump the version and push a tag.

1. Set the new version in `package.json` (e.g. `0.3.0`). The manifest reads it from there.
2. Commit, then tag and push:
   ```sh
   git tag v0.3.0
   git push origin main v0.3.0
   ```
3. The **Release** workflow runs typecheck and tests, builds both browsers, and publishes a GitHub Release with
   `triway-chrome-v0.3.0.zip` and `triway-firefox-v0.3.0.zip`. A tag containing `-` (e.g. `v0.3.0-rc1`) becomes a
   pre-release, which installed copies ignore when checking for updates.
4. Within a day, installed copies see the new release and show a **NEW** badge with a link to it.

The tag must match `package.json` or the workflow stops.

## Signed Firefox builds (optional)

Firefox only keeps signed add-ons after a restart. Mozilla signs self-distributed add-ons for free without listing them:

1. Sign in at <https://addons.mozilla.org/developers/> and create API credentials (Tools → Manage API Keys).
2. In this repo: Settings → Secrets and variables → Actions → add `AMO_JWT_ISSUER` (the JWT issuer) and
   `AMO_JWT_SECRET` (the JWT secret).
3. From the next tag on, the release also includes a signed `triway-firefox-vX.Y.Z.xpi` that installs permanently.

## Data that updates without a release

- **Gas price**: the *Update gas price* workflow commits `data/live/gas-price.json` each Tuesday from Ontario's
  weekly survey. Installed copies fetch it from the default branch daily.
- **Car ratings**: the *Update vehicle database* workflow refreshes `src/data/vehicles.json` monthly. New cars reach
  users with the next release.
- **Fares**: edit `src/core/fares/fares.ts` when an agency changes its fares, bump `FARES_EFFECTIVE`, and release.

## Extension ID

`assets/extension-key.pub.txt` pins the Chrome extension ID to `jdcgiaefoeldnmnplhadgjfcchkpjoab` so unpacked installs keep
their settings across updates. Don't change it.
