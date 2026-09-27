import {
  ENEMIES,
  FP,
  GAME,
  TOWERS,
  createBot,
  createInitialState,
  pathCells,
  step,
  type Bot,
  type Command,
  type Enemy,
  type EnemyKind,
  type GameState,
  type GameStatus,
  type Tower,
  type TowerKind,
} from "../../src/index";

const WAVES_OFF = Number.MAX_SAFE_INTEGER;
const DEFAULT_PLAYER = 0;

export interface ScenarioOptions {
  seed: number;
  /** Gold each player has once the scenario towers are placed. */
  gold?: number;
  /** Player ids present from the start. Default: just player 0. */
  players?: number[];
  /** Let waves spawn as in a real game. Off by default so only scenario enemies exist. */
  waves?: boolean;
  /** Let the reference bot issue commands on every tick. */
  bot?: boolean;
  /** 1-based wave to start at (requires waves). */
  startWave?: number;
  /** Explicitly mark the game as not eligible for records. */
  ranked?: boolean;
}

export interface Cell {
  x: number;
  y: number;
}

export interface TowerCell extends Cell {
  owner?: number;
}

export interface BuildCell extends Cell {
  player?: number;
}

export interface EnemyPlacement extends Cell {
  hp?: number;
  /** Extra distance along the path from the cell center, in FP units. */
  offset?: number;
}

interface TowerPlacement extends Cell {
  kind: TowerKind;
  owner: number;
}

interface EnemySpec extends EnemyPlacement {
  kind: EnemyKind;
}

/**
 * Black-box game builder for tests. Everything goes through `step()` and the public API,
 * except two setup writes that no command covers: spawning scenario enemies and turning waves off.
 * Gold is a shared pool in this phase, so `gold(player)` ignores the player.
 */
export class Scenario {
  private current: GameState;
  private readonly pendingTowers: TowerPlacement[] = [];
  private readonly pendingEnemies: EnemySpec[] = [];
  private readonly enemyIds: number[] = [];
  private queued: Command[] = [];
  private materialized = false;
  private readonly bot: Bot | undefined;
  private readonly wavesOn: boolean;
  private readonly goldAfterSetup: number | undefined;
  private readonly startWave: number | undefined;
  private readonly rankedOption: boolean | undefined;
  private readonly players: number[];

  constructor(opts: ScenarioOptions) {
    this.current = createInitialState({ seed: opts.seed });
    this.goldAfterSetup = opts.gold;
    this.startWave = opts.startWave;
    this.rankedOption = opts.ranked;
    this.players = opts.players ?? [DEFAULT_PLAYER];
    this.wavesOn = opts.waves ?? false;
    this.bot = opts.bot ? createBot("trivial") : undefined;
  }

  /** Builder form: places a tower for free before the scenario starts (owner defaults to player 0). */
  tower(kind: TowerKind, at: TowerCell): this;
  /** Query form: the index-th tower in the game. */
  tower(index: number): Tower;
  tower(kindOrIndex: TowerKind | number, at?: TowerCell): this | Tower {
    if (typeof kindOrIndex === "number") return this.towerAt(kindOrIndex);
    this.assertNotStarted("tower");
    const { owner = DEFAULT_PLAYER, x, y } = at!;
    this.pendingTowers.push({ kind: kindOrIndex, owner, x, y });
    return this;
  }

  /** Builder form: spawns an enemy on a path cell before the scenario starts. */
  enemy(kind: EnemyKind, at: EnemyPlacement): this;
  /** Query form: the index-th enemy added to the scenario. Throws once it is dead or leaked. */
  enemy(index: number): Enemy;
  enemy(kindOrIndex: EnemyKind | number, at?: EnemyPlacement): this | Enemy {
    if (typeof kindOrIndex === "number") return this.enemyAt(kindOrIndex);
    this.assertNotStarted("enemy");
    this.pendingEnemies.push({ kind: kindOrIndex, ...at! });
    return this;
  }

  /** A real build command: paid, validated by the sim, applied on the next tick that runs. */
  build(kind: TowerKind, at: BuildCell): this {
    this.queued.push({ type: "build", tick: 0, playerId: at.player ?? DEFAULT_PLAYER, tower: kind, x: at.x, y: at.y });
    return this;
  }

  /** Queues a real join command for the next tick that runs. */
  join(playerId: number): this {
    this.queued.push({ type: "join", tick: 0, playerId });
    return this;
  }

  callWave(player: number = DEFAULT_PLAYER): this {
    this.queued.push({ type: "callWave", tick: 0, playerId: player });
    return this;
  }

  gift(from: number, to: number, amount: number): this {
    this.queued.push({ type: "gift", tick: 0, playerId: from, to, amount });
    return this;
  }

  sell(towerId: number, player: number = DEFAULT_PLAYER): this {
    this.queued.push({ type: "sell", tick: 0, playerId: player, towerId });
    return this;
  }

  upgrade(towerId: number, player: number = DEFAULT_PLAYER): this {
    this.queued.push({ type: "upgrade", tick: 0, playerId: player, towerId });
    return this;
  }

  leave(playerId: number): this {
    this.queued.push({ type: "leave", tick: 0, playerId });
    return this;
  }

  run(ticks: number): this {
    this.materialize();
    for (let i = 0; i < ticks; i++) this.tick();
    return this;
  }

  runUntil(done: (state: GameState) => boolean, maxTicks: number): this {
    this.materialize();
    for (let i = 0; i < maxTicks && this.current.status === "playing" && !done(this.current); i++) this.tick();
    return this;
  }

  state(): GameState {
    this.materialize();
    return this.current;
  }

  status(): GameStatus {
    return this.state().status;
  }

  enemies(): readonly Enemy[] {
    return this.state().enemies;
  }

  alive(index: number): boolean {
    return this.findEnemy(index) !== undefined;
  }

  private enemyAt(index: number): Enemy {
    const found = this.findEnemy(index);
    if (!found) throw new Error(`scenario enemy #${index} is no longer alive`);
    return found;
  }

  towers(): readonly Tower[] {
    return this.state().towers;
  }

  private towerAt(index: number): Tower {
    const found = this.towers()[index];
    if (!found) throw new Error(`scenario has no tower #${index}`);
    return found;
  }

  gold(player: number = DEFAULT_PLAYER): number {
    const found = this.state().players.find((p) => p.id === player);
    if (!found) throw new Error(`player ${player} is not in the game`);
    return found.gold;
  }

  playerIds(): number[] {
    return this.state().players.map((p) => p.id);
  }

  lives(): number {
    return this.state().lives;
  }

  ranked(): boolean {
    return this.state().ranked;
  }

  private findEnemy(index: number): Enemy | undefined {
    const id = this.enemyIds[index];
    if (id === undefined) throw new Error(`scenario has no enemy #${index}`);
    return this.state().enemies.find((e) => e.id === id);
  }

  private tick(): void {
    const commands = this.queued.map((c) => ({ ...c, tick: this.current.tick }));
    this.queued = [];
    if (this.bot) commands.push(...this.bot.decide(this.current));
    this.current = step(this.current, commands);
  }

  private assertNotStarted(what: string): void {
    if (this.materialized) throw new Error(`scenario.${what}() must be called before run()`);
  }

  private materialize(): void {
    if (this.materialized) return;
    this.materialized = true;
    const owners = new Set([...this.players, ...this.pendingTowers.map((t) => t.owner)]);
    const anySetup = this.goldAfterSetup !== undefined || this.pendingTowers.length > 0;
    const players = [...owners]
      .sort((a, b) => a - b)
      .map((id) => {
        const setupCost = this.pendingTowers.filter((t) => t.owner === id).reduce((sum, t) => sum + TOWERS[t.kind].cost, 0);
        return anySetup ? { id, gold: (this.goldAfterSetup ?? GAME.startGold) + setupCost } : { id };
      });
    this.current = createInitialState({ seed: this.current.seed, players, startWave: this.startWave, ranked: this.rankedOption });
    if (!this.wavesOn) this.current = { ...this.current, nextWaveTick: WAVES_OFF };
    if (this.pendingTowers.length > 0) this.placeTowers();
    if (this.pendingEnemies.length > 0) this.spawnEnemies();
  }

  private placeTowers(): void {
    const commands: Command[] = this.pendingTowers.map((t) => ({
      type: "build",
      tick: this.current.tick,
      playerId: t.owner,
      tower: t.kind,
      x: t.x,
      y: t.y,
    }));
    const before = this.current.towers.length;
    this.current = step(this.current, commands);
    const placed = this.current.towers.length - before;
    if (placed !== commands.length) throw new Error(`scenario could not place ${commands.length - placed} tower(s)`);
  }

  private spawnEnemies(): void {
    const cells = pathCells(this.current.mapId);
    const enemies = this.current.enemies.slice();
    let nextId = this.current.nextId;
    for (const spec of this.pendingEnemies) {
      const index = cells.findIndex((c) => c.x === spec.x && c.y === spec.y);
      if (index < 0) throw new Error(`(${spec.x},${spec.y}) is not a path cell`);
      const hp = spec.hp ?? ENEMIES[spec.kind].hp;
      const id = nextId++;
      enemies.push({ id, kind: spec.kind, hp, maxHp: hp, progress: index * FP + (spec.offset ?? 0), lastHitBy: 0, wave: 0 });
      this.enemyIds.push(id);
    }
    this.current = { ...this.current, enemies, nextId };
  }
}

export function scenario(opts: ScenarioOptions): Scenario {
  return new Scenario(opts);
}
