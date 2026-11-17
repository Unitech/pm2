# blessed (vendored, trimmed)

Vendored copy of [`@pm2/blessed`](https://www.npmjs.com/package/@pm2/blessed)
`0.1.81` — the keymetrics fork of [chjj/blessed](https://github.com/chjj/blessed)
(MIT, see `LICENSE`).

Its only consumer in PM2 is `lib/API/Dashboard.js` (`pm2 monit`), which uses
`blessed.screen`, `blessed.list`, `blessed.box`, `blessed.text` and
`blessed.escape`.

Upstream documentation: https://github.com/chjj/blessed#readme

## Local patches

- **`lib/unicode.js`** — emoji width support. Adds `wideEmojiTable` /
  `isWideEmoji()` and folds the emoji ranges into the generated
  `chars.wide` / `chars.swide` regexes, so emoji in process names and log
  lines are measured as double-width and no longer shift the columns.

- **Trimmed widget set.** Only the widgets `pm2 monit` needs are kept:
  `node`, `screen`, `element`, `box`, `text`, `list`, plus `scrollablebox`
  (scrollable elements, lazy-required by `element.js`), `scrollabletext`
  and `log` (the screen's F12 debug log). Everything else — form and input
  widgets, table/listtable/listbar, progressbar, prompt/question/message/
  loading, filemanager, bigtext, layout, line, terminal, video and the
  image widgets — has been removed, along with `vendor/tng.js` (image
  decoder) and `usr/fonts/` (bigtext fonts). `lib/widget.js` carries the
  matching trimmed class registry.

- **Trimmed `usr/`.** Kept as terminfo fallbacks for `lib/tput.js` when the
  system terminfo database is missing or unparsable: `xterm`,
  `xterm-256color`, `linux`, `windows-ansi` (the default `TERM` on Windows)
  and `xterm.termcap`. The unreferenced `xterm.terminfo` source file was
  dropped.
