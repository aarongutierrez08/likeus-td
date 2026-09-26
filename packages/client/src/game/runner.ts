import { TICKS_PER_SECOND, hashState, step, type Bot, type Command, type GameState } from "@td/sim";

const TICK_MS = 1000 / TICKS_PER_SECOND;
/** Never simulate more than this many ticks in a single frame (tab was hidden, etc). */
const MAX_TICKS_PER_FRAME = 200;

export interface RunnerOptions {
  speed: number;
  bot?: Bot | undefined;
  onState: (state: GameState) => void;
  /** Remote: the sim only advances on server ticks (ADR 006); the local clock is off. */
  remote?: boolean;
  onDesync?: (tick: number, localHash: string) => void;
}

/**
 * Drives the pure sim. Local mode steps at wall-clock speed and queues player commands;
 * remote mode replays the commands the server broadcasts, one `tick` message per step.
 */
export class GameRunner {
  state: GameState;
  speed: number;
  paused = false;
  readonly remote: boolean;
  private queue: Command[] = [];
  private accumulator = 0;
  private lastFrame = 0;
  private readonly bot: Bot | undefined;
  private readonly onState: (state: GameState) => void;
  private readonly onDesync: ((tick: number, localHash: string) => void) | undefined;

  constructor(initial: GameState, opts: RunnerOptions) {
    this.state = initial;
    this.speed = opts.speed;
    this.bot = opts.bot;
    this.onState = opts.onState;
    this.remote = opts.remote ?? false;
    this.onDesync = opts.onDesync;
  }

  /** Remote only: applies one server tick and checks the hash when the server sent one. */
  applyTick(tick: number, commands: readonly Command[], hash?: string): void {
    if (tick !== this.state.tick) return this.onDesync?.(tick, hashState(this.state));
    this.state = step(this.state, commands);
    this.onState(this.state);
    if (hash !== undefined) {
      const local = hashState(this.state);
      if (local !== hash) this.onDesync?.(tick, local);
    }
  }

  /** Remote only: adopts a full state from a server snapshot. */
  replaceState(state: GameState): void {
    this.state = state;
    this.onState(state);
  }

  enqueue(cmd: Command): void {
    this.queue.push({ ...cmd, tick: this.state.tick });
  }

  stepOnce(): void {
    const commands = this.bot ? this.queue.concat(this.bot.decide(this.state)) : this.queue;
    this.queue = [];
    this.state = step(this.state, commands);
  }

  /** Simulates synchronously up to the given tick, without rendering in between. */
  fastForward(toTick: number): void {
    while (this.state.tick < toTick && this.state.status === "playing") this.stepOnce();
    this.onState(this.state);
  }

  stepAndPublish(): void {
    this.stepOnce();
    this.onState(this.state);
  }

  start(): void {
    if (this.remote) return;
    this.lastFrame = performance.now();
    const frame = (now: number): void => {
      const dt = Math.min(now - this.lastFrame, 250);
      this.lastFrame = now;
      if (!this.paused && this.speed > 0 && this.state.status === "playing") {
        this.accumulator += dt * this.speed;
        let ticks = 0;
        while (this.accumulator >= TICK_MS && ticks < MAX_TICKS_PER_FRAME) {
          this.stepOnce();
          this.accumulator -= TICK_MS;
          ticks++;
        }
        if (ticks > 0) this.onState(this.state);
      } else {
        this.accumulator = 0;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}
