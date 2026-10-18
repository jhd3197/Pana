import { FIELDS, cleanOptions, maxPip, groupOf, CHAT } from './options.js';
import { applyRoomOptions } from '../../../engine/room-options-rules.js';
import { validTableArena } from '../../../engine/arena-layouts.js';
import { swapSeats, canMoveSeats } from '../../../engine/seat-rules.js';
// House rules are explicit in the UI: team block dominoes, opponents' pips score.
// Pure data and deterministic shuffling keep host migration lossless.
export const TARGET = 100;
export const BOT_NAMES = ['Coco', 'Lola', 'Tito', 'Nina', 'Beto', 'Luz'];
export const deck = (max=6) => Array.from({ length: max+1 }, (_, a) =>
  Array.from({ length: max+1 - a }, (_, b) => ({ id: `${a}-${a + b}`, a, b: a + b }))).flat();
export const pips = hand => hand.reduce((sum, t) => sum + t.a + t.b, 0);
const copy = value => JSON.parse(JSON.stringify(value));

export function legalEnds(state, tile) {
  if (!tile || state.phase !== 'playing') return [];
  if (!state.chain.length) return !(state.openingTile || (state.round===1&&state.options?.opener!=='random'?'6-6':null)) || tile.id === (state.openingTile || '6-6') ? ['right'] : [];
  const left = state.chain[0].a, right = state.chain.at(-1).b;
  return [tile.a === left || tile.b === left ? 'left' : null,
    tile.a === right || tile.b === right ? 'right' : null].filter(Boolean);
}

export function legalMoves(state, seat = state.turn) {
  if (state.phase !== 'playing' || !state.players[seat]) return [];
  return state.players[seat].hand.flatMap(t => legalEnds(state, t).map(end => ({ tile: t.id, end })));
}

// Only this seat's hand and the public chain affect the bot's choice.
export function chooseMove(state, seat = state.turn) {
  const hand = state.players[seat].hand;
  const frequency = Array(13).fill(0);
  hand.forEach(t => { frequency[t.a]++; frequency[t.b]++; });
  const score = move => {
    const tile = hand.find(t => t.id === move.tile);
    const end = state.chain.length ? (move.end === 'left' ? state.chain[0].a : state.chain.at(-1).b) : tile.a;
    const exposed = tile.a === end ? tile.b : tile.a;
    return tile.a + tile.b + (tile.a === tile.b ? 3 : 0) + frequency[exposed] * 1.6;
  };
  return legalMoves(state, seat).sort((a, b) => score(b) - score(a))[0] || null;
}

export class DominoGame {
  constructor(seed = 1) {
    this.options=cleanOptions();this.reserve=[];this.openingTile=null;this.turnRemaining=0;this.chat=[];
    this.rng = seed >>> 0 || 1;
    this.mapId = 'plaza'; this.phase = 'lobby'; this.round = 0; this.scores = [0, 0];
    this.players = BOT_NAMES.slice(0,4).map((name, seat) => ({ id: null, name, avatar: {}, seat, hand: [] }));
    this.chain = []; this.turn = 0; this.starter = 0; this.passes = 0;
    this.revision = 0; this.ledger = {}; this.history = []; this.result = null;
  }

  random() {
    let n = this.rng; n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
    this.rng = n >>> 0; return this.rng / 4294967296;
  }

  addPlayer(id, name, avatar = {}) {
    if(this.phase==='lobby'&&!this.players.some(p=>p.id===id||p.id===null)&&this.players.length<6)this.configure({seats:6});
    const player = this.players.find(p => p.id === id) || this.players.find(p => p.id === null);
    if (!player) return false; // Arrivals beyond the current table watch, never reset the round.
    const changed = player.id !== id || player.name !== name || JSON.stringify(player.avatar) !== JSON.stringify(avatar);
    Object.assign(player, { id, name: String(name).slice(0, 16), avatar });
    if (changed) this.revision++;
    return true;
  }

  removePlayer(id) {
    const player = this.players.find(p => p.id === id);
    if (!player) return;
    Object.assign(player, { id: null, name: BOT_NAMES[player.seat], avatar: {} });
    this.revision++;
  }

  configure(patch) {
    if(this.phase!=='lobby')return false;
    const next=applyRoomOptions(FIELDS,this.options,patch);if(!next)return false;
    if(this.players.slice(next.seats).some(p=>p.id!==null))return false;
    this.options=next;this.players=this.players.slice(0,next.seats);
    while(this.players.length<next.seats){const seat=this.players.length;this.players.push({id:null,name:BOT_NAMES[seat],avatar:{},seat,hand:[]});}
    this.scores=Array(next.mode==='teams'?2:next.seats).fill(0);this.revision++;return true;
  }
  nextTurn(seat){this.turn=(seat+1)%this.players.length;this.turnRemaining=this.options.turnSeconds;}
  clock(dt){
    if(this.phase!=='playing'||!this.options.turnSeconds)return false;
    const before=Math.ceil(this.turnRemaining);this.turnRemaining=Math.max(0,this.turnRemaining-Math.min(1,Math.max(0,dt)));
    if(this.turnRemaining<=0){const move=chooseMove(this);move?this.play(this.turn,move.tile,move.end):this.pass(this.turn);return true;}
    return Math.ceil(this.turnRemaining)!==before;
  }
  say(seat,message){
    if(!this.options.quickChat||!Number.isInteger(message)||!CHAT[message]||seat<0)return false;
    this.chat.push({seat,name:this.players[seat].name,message,id:(this.chat.at(-1)?.id||0)+1});this.chat=this.chat.slice(-4);this.revision++;return true;
  }

  start() {
    if (this.phase === 'playing') return false;
    if (this.phase === 'finished') { this.round = 0; this.scores = Array(this.options.mode==='teams'?2:this.players.length).fill(0); this.starter = 0; }
    this.round++; this.chain = []; this.passes = 0; this.result = null; this.history = [];
    const tiles = deck(maxPip(this.options));
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1)); [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    const count=this.options.handSize,total=count*this.players.length;
    this.openingTile=this.options.opener==='double6'||(this.options.opener==='winner'&&this.round===1)?'6-6':null;
    if(this.openingTile){const index=tiles.findIndex(t=>t.id==='6-6');if(index>=total)[tiles[0],tiles[index]]=[tiles[index],tiles[0]];}
    this.reserve=tiles.slice(total);
    this.players.forEach((p, i) => { p.hand = tiles.slice(i * count, i * count + count).sort((a, b) => a.a - b.a || a.b - b.b); });
    if (this.openingTile) this.starter = this.players.findIndex(p => p.hand.some(t => t.id === '6-6'));
    if(this.options.opener==='random')this.starter=Math.floor(this.random()*this.players.length);
    this.turnRemaining=this.options.turnSeconds;this.turn = this.starter; this.phase = 'playing'; this.revision++;
    return true;
  }

  reseat(from, to) {
    if (this.phase !== 'lobby' || !swapSeats(this.players, from, to)) return false;
    this.revision++; return true;
  }

  setup() {
    if (!['round-over', 'finished'].includes(this.phase)) return false;
    const players = this.players.map(p => ({ ...p, hand: [] }));
    Object.assign(this, new DominoGame(this.rng), { players, options:this.options,scores:Array(this.options.mode==='teams'?2:players.length).fill(0),mapId: this.mapId, revision: this.revision + 1, ledger: this.ledger });
    return true;
  }

  play(seat, tileId, end) {
    if (this.phase !== 'playing' || seat !== this.turn || !this.players[seat]) return false;
    const hand = this.players[seat].hand, index = hand.findIndex(t => t.id === tileId), tile = hand[index];
    if (!legalEnds(this, tile).includes(end)) return false;
    const capicua=hand.length===1&&legalEnds(this,tile).length===2;
    const placed = { ...tile, seat };
    if (this.chain.length) {
      if (end === 'left' && placed.b !== this.chain[0].a || end === 'right' && placed.a !== this.chain.at(-1).b)
        [placed.a, placed.b] = [placed.b, placed.a];
    }
    end === 'left' ? this.chain.unshift(placed) : this.chain.push(placed);
    hand.splice(index, 1); this.passes = 0;
    this.record({ kind: 'play', seat, name: this.players[seat].name, tile: { ...tile }, end });
    this.revision++;
    if (!hand.length) this.finish(groupOf(this,seat), 'out', seat,capicua);
    else this.nextTurn(seat);
    return true;
  }

  pass(seat) {
    if (this.phase !== 'playing' || seat !== this.turn || legalMoves(this, seat).length) return false;
    this.passes++; this.revision++;
    this.record({ kind: 'pass', seat, name: this.players[seat].name });
    if(this.options.passScore)this.scores[groupOf(this,(seat+this.players.length-1)%this.players.length)]+=10;
    if (this.passes === this.players.length) {
      const sums = this.teamPips();
      const minimum=Math.min(...sums),winners=sums.map((n,i)=>n===minimum?i:-1).filter(i=>i>=0);
      const winner=this.options.blocked==='redeal'||winners.length!==1?null:winners[0];
      const opener = winner === null ? (this.starter + 1) % this.players.length :
        this.players.filter(p => groupOf(this,p.seat) === winner).sort((a, b) => pips(a.hand) - pips(b.hand))[0].seat;
      this.finish(winner, this.options.blocked==='redeal'?'redeal':'blocked', opener);
    } else this.nextTurn(seat);
    return true;
  }

  teamPips() { return this.scores.map((_,team) => this.players.filter(p => groupOf(this,p.seat) === team).reduce((sum, p) => sum + pips(p.hand), 0)); }

  finish(winner, reason, starter,capicua=false) {
    const remaining = this.teamPips();let points=winner===null?0:remaining.reduce((sum,n,i)=>sum+(i===winner?0:n),0);
    if(capicua&&this.options.capicua==='25')points+=25;else if(capicua&&this.options.capicua==='double')points*=2;
    if (winner !== null) this.scores[winner] += points;
    this.result = { winner, reason, points, remaining, seat: starter,capicua };
    this.starter = starter; this.phase = this.scores.some(s => s >= this.options.target) ? 'finished' : 'round-over';
    if(this.phase==='finished'){const best=Math.max(...this.scores),leaders=this.scores.map((score,i)=>score===best?i:-1).filter(i=>i>=0);this.result.matchWinner=leaders.length===1?leaders[0]:null;}
  }

  record(event) { this.history.push(event); if (this.history.length > 32) this.history.shift(); }

  accept(id, data, hostId) {
    if (!Number.isSafeInteger(data.seq) || data.seq <= (this.ledger[id] || 0) || data.revision !== this.revision) return false;
    const seat = this.players.findIndex(p => p.id === id);
    let accepted = false;
    if (data.action === 'start' && id === hostId) accepted = this.start();
    else if(data.action==='options'&&id===hostId){accepted=this.configure(data.patch);if(accepted&&data.resetMap===true)this.mapId='plaza';}
    else if(data.action==='chat'&&seat>=0)accepted=this.say(seat,data.message);
    else if (data.action === 'seat' && canMoveSeats(this.players, data.from, data.to, id, hostId)) accepted = this.reseat(data.from, data.to);
    else if (data.action === 'setup' && id === hostId) accepted = this.setup();
    else if (data.action === 'map' && id === hostId && this.phase === 'lobby' && validTableArena(data.mapId)) {
      this.mapId = data.mapId; this.revision++; accepted = true;
    }
    else if (seat >= 0 && data.action === 'play') accepted = this.play(seat, data.tile, data.end);
    else if (seat >= 0 && data.action === 'pass') accepted = this.pass(seat);
    if (accepted) this.ledger[id] = data.seq;
    return accepted;
  }

  snapshot() { return copy({ ...this }); }

  static restore(snapshot, members) {
    const game = Object.assign(new DominoGame(), copy(snapshot));
    game.options=cleanOptions({...game.options,seats:game.players.length});
    for (const p of game.players) if (p.id !== null && !members.has(p.id)) game.removePlayer(p.id);
    for (const m of members.values()) game.addPlayer(m.id, m.name, m.avatar || game.players.find(p => p.id === m.id)?.avatar || {});
    return game;
  }
}
