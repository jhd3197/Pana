# ¡Embuste! · ¿Quién es la momia?

Social deduction at the expedition camp, at `/g/embuste/`: Reliquia's sequel.
Panas keep the camp running until dawn; one mummy (4–6 players) or two (7–8)
wrap them one by one. Plan: `docs/plans/54_embuste.md`. No production
dependency or build step was added.

## How a night plays

Roles are dealt at the start and shown privately (the camera closes in on
your pana for five seconds). Everyone gets five chores from nine; a mummy's
list is only for pretending. Doing a chore opens a panel that covers the
world, which is when mummies strike. Completed chores fill the dawn bar; a
full bar is a pana win. Momiitas (wrapped panas) float through walls and keep
working; their chores still count.

Mummies wrap a living pana within 2.2 m (25 s cooldown, 12 s at night start
and after meetings). The victim becomes a bandaged statue. A pana within 4 m
with a clear line reports it; anyone alive can ring the bell at the fogata
once per night (not during an alarm, not for 15 s after a meeting). Meetings
pull everyone to the fire: 30 s to talk (quick phrases always, free text if
the room allows), 30 s to vote, then the curiara carries the most-voted pana
down the river. Ties and skips send nobody. The room can reveal what the
ejected pana was.

Hiding: mummies enter hollow logs and temple tunnels (linked pairs; nearby
viewers see the spot shake), disguise as a barrel, crate, cava or planter
(3 a night, 10 s, broken by walking) and leave sandy footprints for 6 s after
a wrap. Anyone alive can hide in the sleeping tent, the cava, the crates,
the barrel or behind the waterfall: no wraps, no chores, out after 10 s.

Sabotage shares one cooldown (30 s): apagar la reliquia (pana vision 2.8 m;
two panas hold E at the relic), ¡Un, dos, tres, momia! (15 s; panas who move
while the guardian looks freeze for 3 s; the saboteur sees the timing), the
vine snare (invisible to panas, one catch, two at most), cutting the bridge
(the long way round is through the mine and tunnel; hold E at either end),
jamming the radio (no meetings, task list hidden; hold E at the antenna) and
the critical flood (45 s; one pana at each dam lever at once, or the mummies
win). A meeting clears every alarm; traps stay.

Wins: mummies ≥ living panas, or the flood. Panas: full bar or no mummies
left. A mummy who leaves (after the kit's 20 s reconnection window) counts as
voted out.

## Networking: the room runs the night

Social deduction is the secret, so `games/embuste/server/room.js` owns the
whole `Night` (pure `public/rules.js`) at 20 Hz and sends each seat its own
`view` message. Nothing about other roles or out-of-sight positions is ever
sent: a pana's view of a mummy is `role: null`, players beyond the lantern
(7.5 m, 10 m for mummies, +5 m in the fogata's light) and behind walls are
not in the list at all, a disguised mummy arrives as `{ seat: null, key,
prop }`, and events carry a `to` list (a wrap reaches the victim, the mummies
and real witnesses only). The Colyseus state carries only the roster, the
phase and the host's three options. Clients send `input` (`x`, `z`, `hold`)
and `act` (`{ action, ...data }`); the rules ignore anything out of place.

Practice runs the same `Night` and `Brains` in the browser
(`network.js` `PracticeNight`), stepping by real elapsed time so a busy page
does not slow the night down. Bots fill a room to six when the host leaves
"bots" on; they only use what their seat could see.

Event payloads must not use `id` or `kind` (those are the event's own);
`emit` puts its own fields last so a payload can't shadow them. Use `spot`,
`sabotage`, `seat`.

## Files

`layout.js` zones, stations, vents, hides, fix spots, collision, sight lines
and a 1 m navigation grid (one per bridge state). `rules.js` the Night.
`bots.js` practice brains. `tasks.js` the nine chore panels (DOM/canvas,
pointer and keyboard). `ui.js` the meeting card. `scene.js` the world from
shared factories. Shared models added in `engine/models/props/embuste.js`
(bell, radio, dam, tent, bandage wrap, vine snare), all in Studio, plus the
map entry in `web/studio/catalog/maps.js`.

## Verification

```powershell
node --test Pana/games/embuste/tests/rules.test.js   # also layout, meetings, hiding, sabotage
node Pana/games/embuste/tests/browser.mjs <playwright-package>
```

The browser suite opens four real clients on one room (bots off), checks
that roles stay private and far players are never sent, plays a wrap, a
report, chat and a vote to a pana win, fixes one sabotage and lets the flood
win, adds a late spectator, closes the host and the mummy, and drives a
390 × 844 touch client in practice. Rooms opened with `?quick` use short
timers and accept a `debug` message (place yourself, clear cooldowns); other
rooms ignore it. `?norender` skips drawing so several pages fit a software
renderer. `?debug` exposes `window.embuste` (`net`, `view`, `use()`,
`solve()` for the open chore, `debug()`).

## Notes for agents

Keep `rules.js` free of DOM, Three.js and absolute `/engine/` imports: the
server room imports it (with `layout.js` and `bots.js`) from Node. Anything a
screen should not know must be filtered in `Night.view()`, never in the
client. Panels and menus that update every view must update in place (a
rebuilt button can't be clicked). Bots are for practice, not balance.
