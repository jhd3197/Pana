// Wiring only: the plot (engine/plot/plot.js) → the page (ui.js) and the 3D plot
// (scene.js). There is no room and no round: the page opens on your plot, and
// what grew while it was closed comes from the timestamps.
import { createGameMenu } from '/engine/ui.js';
import { sound, popCounter } from '/engine/fx.js';
import { sfx } from '/engine/sfx.js';
import { bootGame } from '/engine/game-shell.js';
import { createMangoWallet } from '/engine/mangos.js';
import { createProgress } from '/engine/progress.js';
import { createRankChip, rankUpToast } from '/engine/progress-ui.js';
import { createFeats } from '/engine/feats.js';
import { createPlot } from '/engine/plot/plot.js';
import { loc } from '/engine/i18n.js';
import { CROPS, DECOR, RANKS, SHOP, TIERS } from './rules.js';
import { createConucoUi } from './ui.js';

const $ = id => document.getElementById(id), params = new URLSearchParams(location.search);
// A debug page can move its own clock; the plot only ever asks this function.
let warp = 0;
const now = () => Date.now() + warp;

const wallet = createMangoWallet(undefined, { source: 'conuco' });
const progress = createProgress({ game: 'conuco', ranks: RANKS });
const plot = createPlot({ game: 'conuco', crops: CROPS, tiers: TIERS, decor: DECOR, shop: SHOP, wallet, progress, now });

const menu = createGameMenu({ title: 'Conuco · Pana', sound, orientation: 'libre', // i18n-ignore: the game's name
  note: () => loc('Tu conuco sigue creciendo.'), resumeLabel: loc('Volver al conuco'),
  pad: { playing: () => false, menu: () => menu.open() } });
$('game-nav').append(menu.createButton({ id: 'menu', className: 'pk-btn' }));
const chip = createRankChip(progress);
$('rank').append(chip.el);
const feat = createFeats($('toast'));

let ui = null, scene = null;
// What every action comes back through: the sound, the counter and the sheet.
function act(result, kind) {
  if (!result.ok) { sfx.back(); return; }
  sound.unlock();
  if (kind === 'harvest' || kind === 'harvest-all') {
    sfx.chime(); popCounter($('mangos'));
    rankUpToast(result, text => feat(`rank:${result.rank?.id}`, text));
  } else if (kind === 'upgrade') {
    sfx.sting(true); popCounter($('mangos'));
  } else sfx.confirm();
  ui.refresh(kind === 'plant');
}

export const { sceneReady } = bootGame({
  load: async () => (await import('./scene.js')).createConucoScene($('world')),
  ready(world) {
    scene = world;
    ui = createConucoUi({ plot, wallet, act, world, now });
    ui.render();
    plot.onChange(() => ui.render());
    wallet.onChange(() => ui.render());
    wallet.ready.then(() => ui.render());
    // Back from another tab: what grew meanwhile shows at once.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) ui.tick(); });
  },
  tickMs: 1000,
  tick: () => ui?.tick(),
  frame: (dt, world) => world.frame(dt),
});

if (params.has('debug')) window.conucoDebug = { plot, wallet, progress, menu, get ui() { return ui; }, get world() { return scene; }, warp(ms) { warp += ms; ui?.tick(); return warp; } };
