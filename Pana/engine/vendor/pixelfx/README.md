# pixelfx (vendored subset)

Only the effects Pana plays, copied unchanged from pixelfx (commit a841596) except
`core/index.js`, which drops the modules no vendored effect needs. Keep `LICENSE`
and `NOTICE.md` beside the code. To add an effect: copy its file (and its
category's `_lib.js`), then add it to `EFFECTS` in `engine/fx/pixelfx-bridge.js`.
