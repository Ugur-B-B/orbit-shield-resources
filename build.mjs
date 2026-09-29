// Builds resources.json for Orbit Shield (adblock-rust's `Resource` format)
// from a checkout of uBlock Origin, the way Brave does it: the scriptlets
// (`##+js(...)`) and the redirect resources (`$redirect=...`), unmodified.
//
//     node build.mjs <uBlock checkout> <output file>

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [uboDir, outFile] = process.argv.slice(2);
if (!uboDir || !outFile) {
    console.error('usage: node build.mjs <uBlock checkout> <output file>');
    process.exit(2);
}

const importFrom = file => import(pathToFileURL(path.resolve(uboDir, file)).href);

// adblock-rust's MIME types by file extension (MimeType::from_extension).
const MIME_TYPES = {
    css: 'text/css', gif: 'image/gif', html: 'text/html', js: 'application/javascript',
    json: 'application/json', mp3: 'audio/mp3', mp4: 'video/mp4', png: 'image/png',
    txt: 'text/plain', xml: 'text/xml',
};
const TEXT_TYPES = new Set(['text/css', 'text/html', 'application/javascript', 'application/json', 'text/plain', 'text/xml']);

// In adblock-rust, bit 0 is the permission Orbit gives uBlock Origin's own
// lists: only they may use the "trusted-" scriptlets (as in uBO and Brave).
const TRUSTED = 1;

// Redirect resources (src/web_accessible_resources, indexed by redirect-resources.js).
const { default: redirects } = await importFrom('src/js/redirect-resources.js');
const redirectResources = [];
for (const [name, details] of redirects) {
    // Others (such as the extensionless "empty") are "application/octet-stream" there too.
    const dot = name.lastIndexOf('.');
    const mime = (dot >= 0 && MIME_TYPES[name.slice(dot + 1)]) || 'application/octet-stream';
    let bytes = fs.readFileSync(path.join(uboDir, 'src/web_accessible_resources', name));
    if (TEXT_TYPES.has(mime)) {
        bytes = Buffer.from(bytes.toString('utf8').replaceAll('\r', ''), 'utf8');
    }
    const alias = details.alias ?? [];
    redirectResources.push({
        name,
        aliases: Array.isArray(alias) ? alias : [alias],
        kind: { mime },
        content: bytes.toString('base64'),
    });
}

// Scriptlets: each is a function whose source is injected, plus the helper
// functions it depends on.
const { builtinScriptlets } = await importFrom('src/js/resources/scriptlets.js');
const names = new Set(builtinScriptlets.map(s => s.name));
const scriptlets = builtinScriptlets.map(s => {
    for (const dependency of s.dependencies ?? []) {
        if (!names.has(dependency)) {
            throw new Error(`scriptlet ${s.name} depends on missing ${dependency}`);
        }
    }
    return {
        name: s.name,
        aliases: s.aliases ?? [],
        kind: { mime: 'application/javascript' },
        content: Buffer.from(s.fn.toString()).toString('base64'),
        dependencies: s.dependencies ?? [],
        permission: s.name.startsWith('trusted-') ? TRUSTED : 0,
    };
});

// A sanity check: a changed uBO layout must fail the build, not publish an
// empty or partial file.
for (const needed of ['json-prune.js', 'set-constant.js', 'trusted-replace-xhr-response.js', 'noop.js']) {
    if (!names.has(needed) && !redirectResources.some(r => r.name === needed)) {
        throw new Error(`${needed} is missing`);
    }
}
if (scriptlets.length < 50 || redirectResources.length < 30) {
    throw new Error(`too few resources: ${scriptlets.length} scriptlets, ${redirectResources.length} redirects`);
}

const resources = [...redirectResources, ...scriptlets].sort((a, b) => a.name.localeCompare(b.name));
fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(resources));
console.log(`${scriptlets.length} scriptlets, ${redirectResources.length} redirect resources -> ${outFile}`);
