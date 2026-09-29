# orbit-shield-resources

`resources.json` for Orbit Shield, the ad blocker of the Orbit browser: uBlock Origin's scriptlets (`##+js(...)` rules) and redirect resources (`$redirect=...` rules) in the format of Brave's [adblock-rust](https://github.com/brave/adblock-rust) (`Resource`), built the same way Brave builds its own.

A GitHub Actions job ([build.yml](.github/workflows/build.yml)) runs every day. It checks out uBlock Origin's latest release, runs [build.mjs](build.mjs) and, when the result changed, uploads it to the `latest` release:

    https://github.com/Ugur-B-B/orbit-shield-resources/releases/download/latest/resources.json

Orbit downloads this file at run time, like a filter list. It isn't bundled with Orbit.

## Contents

- The scriptlets are uBlock Origin's own functions (`src/js/resources/`), taken as they are (`Function.prototype.toString`). Those whose names start with `trusted-` get permission bit 0, so only lists the browser trusts (uBlock Origin's) can use them.
- The redirect resources are the files in `src/web_accessible_resources/` listed in `src/js/redirect-resources.js`, unmodified, base64-encoded.

Build it locally:

    git clone --depth 1 --filter=blob:none --sparse https://github.com/gorhill/uBlock.git ubo
    git -C ubo sparse-checkout set --no-cone /src/js/ /src/web_accessible_resources/
    node build.mjs ubo dist/resources.json

## License

The resources are from [uBlock Origin](https://github.com/gorhill/uBlock), Copyright (C) Raymond Hill and contributors, licensed under the GNU General Public License v3.0 or later. Their source is the uBlock Origin repository at the commit named in each release's notes. This repository (the build script included) is licensed under the GPLv3 as well; see [LICENSE](LICENSE).
