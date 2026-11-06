# UI rules

## Simple people don't like reading

Players look, they don't read. Every screen, card and menu says as little as
it can and lets pictures carry the rest.

- **Minimal text.** If a word can go, it goes.
- **Icons and images over words.** A person icon and `1-8` beats "up to 8
  friends"; use `engine/icons.js`, never emoji.
- **No long description lines.** A card tagline is a few words, about 25
  characters at most (`game.json` `description`; the conventions test caps it
  at 30). Tooltips and labels are one or two words.
- **Stats go in stats panels**, not in sentences.
- **Instructions live on the Instrucciones page** (`engine/controls-page.js`),
  never on screen during play.
- **No persistent hints.** A prompt that reacts to the game's state ("E abrir"
  at a door) may show while it applies, then goes.
- Square corners (`border-radius: 0`) and nothing overlaps.

Bad: `Paint artillery between capybaras. Aim the bazooka, read the wind and knock the rival capys into the river.`
Good: `Paint artillery`

### Checklist

- [ ] Every new line of player text is a few words, or it is gone.
- [ ] Could an icon, an image or a number say it instead?
- [ ] Taglines and `game.json` descriptions fit in ~25 characters.
- [ ] No how-to text on the HUD; it is in `public/instructions.js`.
- [ ] Nothing stays on screen as a hint once it no longer applies.
- [ ] Checked at 1280x720 and 390x844: no overflow, no overlap, square corners.
