# chokidar (vendored)

- Upstream: [chokidar](https://github.com/paulmillr/chokidar) **3.6.0**, MIT (`LICENSE`)
- Tarball: `https://registry.npmjs.org/chokidar/-/chokidar-3.6.0.tgz`
- Integrity: `sha512-7VT13fmjotKpGipCW9JEQAusEPE+Ei8nl6/g4FBAmIm0GOOLMua9NDDo/DWp0ZAxCr3cPq5ZpBqmPAQgDda2Pw==`
- Vendored: 2026-10-20, used by `lib/Watcher.js` (`pm2 start --watch`)

## Why

chokidar 3.x depends on `braces`, affected by GHSA-vfj7-8cjw-p6xm (uncontrolled
recursion / unbounded expansion, no patched release). chokidar 4+ drops glob
support, which `watch` / `ignore_watch` rely on. Its only `braces` call expands
the watched glob to prune directory traversal.

## Files

| File | State |
|---|---|
| `lib/constants.js`, `lib/nodefs-handler.js`, `lib/fsevents-handler.js`, `LICENSE` | byte-identical to 3.6.0 |
| `index.js` | patched, see below |
| `lib/brace-expand.js` | new, bounded brace expansion |

Dropped: `package.json` (so SBOM / SCA scanners don't report a `chokidar@3.6.0`
with its `braces` dependency), `README.md`, `types/`.
The remaining dependencies (`anymatch`, `glob-parent`, `is-binary-path`, `is-glob`,
`normalize-path`, `readdirp`, optional `fsevents`) are pinned in pm2's `package.json`.

## Local changes (`index.js`)

1. `require('braces')` -> `require('./lib/brace-expand')`
2. `WatchHelper#getDirParts` returns `null` when `expandBraces()` returns `null`
3. constructor: `this.dirParts = this.getDirParts(path) || [[GLOBSTAR]]`
4. `filterDir`: entry path falls back to a plain split when it can't be expanded

## brace-expand.js

Supports `{a,b}` alternatives (nested, empty items) and `{x..y[..step]}`
numeric (zero padded, signed) and letter ranges, with the same results as
`braces.expand`: checked against braces 3.0.3 by
`test/programmatic/brace_expansion.mocha.js` (generated grammar: identical,
random input: null or identical).

Brace-free `[...]` / `(...)` chunks (`*.[jt]s`, `*.@(js|ts)`, `Program Files (x86)`,
`Dropbox (Personal)`, Next.js `app/(group)`) and a plain `$` are literal text.

Returns `null`, never throws, on: `\`, quotes (`'` `"` `` ` ``), NBSP / BOM,
`${`, any other bracket or paren (nested, unbalanced, holding `{ } , .` or
wrapping braces: `[{a,b}]`, `(a|{b,c})`, `[[:alpha:]]`), single item or
unbalanced braces, `..` inside an alternation, or past a limit:
`MAX_PATTERN_LENGTH` 10000, `MAX_DEPTH` 10, `MAX_EXPANSIONS` 256,
`MAX_OUTPUT_CHARS` 1e6.
The glob is resolved against `cwd` first, so these characters in `pm_cwd`
also return `null` for any brace glob.

On `null` the glob gets `[[GLOBSTAR]]` dir parts: no directory pruning, more
directories scanned and watched. Events are a **superset** of upstream, never
fewer: regular files are still filtered by the glob matcher (anymatch) and
`ignored`, but symlinks under the glob parent are no longer filtered by the
glob (upstream `filterPath` sends them to `filterDir`, which only checks
`ignored` against `[[GLOBSTAR]]`), so they can emit events (and restarts)
upstream would drop.

## Security maintenance

npm audit / Dependabot no longer see chokidar: **future chokidar 3.x advisories
won't be reported**. Watch https://github.com/paulmillr/chokidar/security and
the 3.x branch.

## Re-sync

1. `npm pack chokidar@3.x.y` and check the integrity against `npm view chokidar@3.x.y dist.integrity`
2. copy `lib/constants.js`, `lib/nodefs-handler.js`, `lib/fsevents-handler.js`, `LICENSE`
3. take the new `index.js`, re-apply the 4 changes above and the header
4. align the pinned dependency versions in pm2's `package.json`
5. bump the `chokidar` devDependency (differential and byte-identity tests) and update this file
6. `npx mocha test/programmatic/brace_expansion.mocha.js test/programmatic/chokidar_vendored.mocha.js`
