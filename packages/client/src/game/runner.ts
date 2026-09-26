import { TICKS_PER_SECOND, step, type Bot, type Command, type GameState } from "@td/sim";

const TICK_MS = 1000 / TICKS_PER_SECOND;
/** Never simulate more than this many ticks in a single frame (tab was hidden, etc). */
const MAX_TICKS_PER_FRAME = 200;

export interface RunnerOptions {
  speed: number;
  bot?: Bot | undefined;
  onState: (state: GameState) => void;
}

/** Drives the pure sim at wall-clock speed and queues player commands for the next tick. */
export class GameRunner {
  state: GameState;
  speed: number;
  paused = false;
  private queue: Command[] = [];
  private accumulator = 0;
  private lastFrame = 0;
  private readonly bot: Bot | undefined;
  private readonly onState: (state: GameState) => void;

  constructor(initial: GameState, opts: RunnerOptions) {
    this.state = initial;
    this.speed = opts.speed;
    this.bot = opts.bot;
    this.onState = opts.onState;
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
