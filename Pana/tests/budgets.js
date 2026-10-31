// The size budgets the conventions test enforces and `npm run budget` reports.
// Without a bundler every static import is a request, and each level waits for
// the one above it, so a game's first load stays under FIRST_LOAD_MODULES.
// game.js is wiring only: at most GAME_JS_LIMIT lines; the files in
// GAME_JS_ALLOWED predate the limit and may shrink, never grow, and when one
// shrinks by more than GAME_JS_SLACK its cap comes down with it.
// 161: every page loads engine/i18n.js (its language) before anything shows.
export const FIRST_LOAD_MODULES = 161;
export const GAME_JS_LIMIT = 600, GAME_JS_SLACK = 25;
export const GAME_JS_ALLOWED = { carreritas: 2297, bululu: 1248, embuste: 650 };
export const gameJsCap = (id) => GAME_JS_ALLOWED[id] ?? GAME_JS_LIMIT;
