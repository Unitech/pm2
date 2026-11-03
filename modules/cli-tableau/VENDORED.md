# cli-tableau (vendored)

- Upstream: [cli-tableau](https://github.com/Keymetrics/cli-table) **2.0.1**, MIT (`LICENSE`)
- Tarball: `https://registry.npmjs.org/cli-tableau/-/cli-tableau-2.0.1.tgz`
- Integrity: `sha512-he+WTicka9cl0Fg/y+YyxcN6/bfQ/1O3QmgxRXDhABKqLzvoOSM4fMzp39uMyLBulAFuywD2N7UaoQE7WaADxQ==`
- Vendored: 2026-11-03, used by `lib/API/UX/pm2-ls.js`, `lib/API/UX/pm2-describe.js`
  and `lib/API/pm2-plus/PM2IO.js`

## Why

`utils.options()` merges the `new Table(options)` argument into the defaults
without filtering keys: an own `__proto__` key (from `JSON.parse`) makes it
recurse into `Object.prototype` (prototype pollution, keymetrics/cli-tableau#13).
cli-table fixed the same function in 0.3.6. pm2 only passes literal options,
the fix is for the package itself.

## Files

| File | State |
|---|---|
| `LICENSE` | byte-identical to 2.0.1 |
| `index.js` | upstream `lib/index.js`, patched, see below |
| `utils.js` | upstream `lib/utils.js`, patched, see below |

Dropped: `package.json` (so SBOM / SCA scanners don't report a `cli-tableau@2.0.1`),
`README.md`, `CHANGELOG.md`.

## Local changes

1. `index.js`: `require('chalk')` -> `require('ansis')`, the color library of
   the rest of pm2 (drops chalk 3.0.0 and its 5 dependencies)
2. `index.js`: default border style `grey` -> `gray` (same SGR code, ansis has no `grey`)
3. `utils.js`: `options()` skips the `__proto__`, `constructor` and `prototype` keys

Checked by `test/programmatic/cli_tableau_vendored.mocha.js` against upstream
2.0.1 (devDependency, test reference only).
