import { HostRoom } from '/engine/net.js';
import { acceptsChoice, cleanInput, IDLE_INPUT } from './online-rules.js';

export class BululuRoom extends HostRoom {
  constructor(options) {
    super({ ...options, game: 'bululu', protocol: 'bululu-v1',
      texts: { full: 'Sala llena: ya hay cuatro panas. Puedes jugar con bots.' } });
    this.events = options.events;
    this.inputs = new Map();
    this.history = [];
    this.state = null;
  }
  entered(alone) { if (alone) this.state = null; }
  takeOver() { this.events.host(this.state); }
  memberJoined() { this.events.members(); this.publish(); }
  memberLeft(id) { this.inputs.delete(id); this.events.members(); }
  memberHello() { this.events.members(); this.publish(); }
  statusText() { return `Sala ${this.code} · ${this.members.size}/4 panas`; }
  publish(state = this.state) {
    if (!this.isHost || !state) return;
    this.state = state;
    this.send({ kind: 'state', state });
  }
  receive(id, v) {
    if (v.kind === 'state' && id === this.hostId && !this.isHost) {
      this.state = v.state;
      this.events.state(v.state);
    } else if (v.kind === 'input' && this.isHost && v.serial === this.state?.mini?.serial) {
      this.input(id, v.input);
    } else if (v.kind === 'choice' && this.isHost && acceptsChoice(this.prompt, id, v)) {
      this.events.choice(v.choice);
    } else if (v.kind === 'frames' && id === this.hostId && !this.isHost && (v.to == null || v.to === this.id)) {
      this.events.frames(v);
    } else if (v.kind === 'catchup' && this.isHost && v.serial === this.state?.mini?.serial && Number.isInteger(v.from) && v.from >= 0) {
      // One short history, cleared at the next minigame. Stay below 256 KB.
      for (let from = v.from; from < this.history.length; from += 60)
        this.send({ kind: 'frames', to: id, serial: v.serial, from, frames: this.history.slice(from, from + 60) });
    }
  }
  choose(prompt, choice) {
    const message = { kind: 'choice', prompt, choice };
    if (this.isHost) { if (acceptsChoice(this.prompt, this.id, message)) this.events.choice(choice); }
    else this.send(message);
  }
  input(id, value) {
    const next = cleanInput(value), previous = this.inputs.get(id);
    // Do not lose a tap between two simulation ticks, or repeat it on every tick.
    next.jump ||= !!previous?.jump;
    next.fire ||= !!previous?.fire;
    this.inputs.set(id, { ...next, at: performance.now() });
  }
  controls(value) {
    if (this.isHost) this.input(this.id, value);
    else this.send({ kind: 'input', serial: this.state?.mini?.serial, input: cleanInput(value) });
  }
  takeInputs(players) {
    return players.map(p => {
      const input = this.inputs.get(p.seat);
      if (!input || performance.now() - input.at > 600) return cleanInput(IDLE_INPUT);
      const next = cleanInput(input);
      input.jump = input.fire = false;
      return next;
    });
  }
  frame(serial, frame) {
    const from = this.history.length;
    this.history.push(frame);
    this.send({ kind: 'frames', serial, from, frames: [frame] });
  }
  catchup(serial, from) { this.send({ kind: 'catchup', serial, from }); }
}
