# Large runtime asset packs

Runtime audio, plus images and textures of at least 100 KiB, ship as deterministic ZIP release
assets, grouped by game. Small icons, thumbnails and documentation screenshots
stay in Git. Launcher hero art belongs to its game's pack; character reference
art belongs to `shared-character`. Shared engine textures can use `shared-world`.
Existing URLs and image bytes are unchanged. Historical Git blobs remain; this
workflow does not rewrite repository history.

## Runtime

`Pana/server/src/asset-packs.json` pins each immutable release URL, archive size,
SHA-256 and the exact original URL, size and checksum of each file. The server's
`packed-assets.js` intercepts only those exact URLs. All other routes keep normal
static serving. There is no browser ZIP parsing and no application build step.

The first request downloads only the relevant game's pack; concurrent requests
share one install. `asset-pack.js` verifies the archive and every image, rejects
unsafe/extra/missing paths, and publishes a complete cache directory. The same
installer handles QQSMP voice packs, retaining its existing cache settings.
Normal MIME types, ETags and 304 responses apply to cached files.

Image cache: `PANA_ASSET_CACHE`, otherwise `DATA_ROOT/pana-asset-packs`, otherwise
the system temp directory. Mount this writable path persistently in production.
Cached packs work offline. First-install failures return a retryable 503 only for
that asset; other games, icons and room APIs remain available.

## Updating assets

1. On a fresh checkout, restore the pack's missing originals for editing:
   `node Pana/scripts/asset-packs.js --restore carreritas`. Existing local edits
   are never overwritten. Omit the id to restore all packs.
2. Export artwork at its existing URL using the usual launcher-art/shots workflow.
3. Run `python Pana/scripts/asset-packs.py --game carreritas` (omit the id for all).
   This produces ignored `dist/asset-packs/<game>-<hash>.zip`, updates the catalog
   and exact ignore paths. It refuses a rebuild with missing enrolled originals.
4. Upload new ZIPs to the `asset-packs` release before pushing the catalog:
   `gh release upload asset-packs dist/asset-packs/<filename>.zip`.
   Keep old archives for old deployments; never replace an archive in place.
5. Run `node Pana/scripts/asset-packs.js carreritas` to download and verify the
   published pack. For newly enrolled assets, use `git rm --cached -- <path>`
   to stop tracking the original while retaining the local editing copy.
6. Commit the code, catalog and ignore entries, not the binary files or ZIPs.

Both generation tools use only Python/Node standard libraries. Asset generation
is contributor tooling; running Pana requires only Node and the existing server
dependencies. The full catalog is included in browser-suite fingerprints through
`server/src`, so a new pack invalidates affected cached checks.

## Proof

`server/tests/asset-pack.test.js` covers verification, traversal, concurrent
requests, offline reuse, retry, damaged caches and pack/URL ownership.
`web/tests/asset-packs.browser.js` fetches every enrolled URL, verifies exact
bytes, decodes every image in Chromium and checks ETags. Image size conventions
also check the catalog, so clean checkouts retain the same budget checks.
