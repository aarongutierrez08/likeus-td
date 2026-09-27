import { Container, Graphics } from "pixi.js";
import { FP, TOWERS, positionAt, type Enemy, type GameState, type Tower } from "@td/sim";
import { COLORS, ENEMY_COLORS, TOWER_COLORS } from "./colors";

const ENEMY_RADIUS: Record<Enemy["kind"], number> = { normal: 0.28, fast: 0.2, tank: 0.38 };

interface EnemySprite {
  root: Container;
  body: Graphics;
  hp: Graphics;
  lastHpRatio: number;
}

/** Keeps one display object per entity id and syncs it with the state every frame. */
export interface KillEvent {
  x: number;
  y: number;
}

export class EntityLayer {
  readonly towers = new Container();
  readonly enemies = new Container();
  readonly ranges = new Graphics();
  private readonly towerSprites = new Map<number, { g: Graphics; level: number }>();
  private readonly enemySprites = new Map<number, EnemySprite>();

  private exitX = Number.MAX_SAFE_INTEGER;
  private exitY = Number.MAX_SAFE_INTEGER;

  constructor(private readonly base: number) {}

  setExit(cell: { x: number; y: number }): void {
    this.exitX = cell.x * this.base;
    this.exitY = cell.y * this.base;
  }

  /** Returns the world positions of enemies that were killed since the previous sync. */
  sync(state: GameState, showRanges: boolean): KillEvent[] {
    this.syncTowers(state.towers);
    const kills = this.syncEnemies(state);
    this.ranges.clear();
    if (showRanges) this.drawRanges(state.towers);
    return kills;
  }

  private syncTowers(towers: readonly Tower[]): void {
    const seen = new Set<number>();
    for (const t of towers) {
      seen.add(t.id);
      const existing = this.towerSprites.get(t.id);
      if (existing && existing.level === t.level) continue;
      existing?.g.destroy();
      const g = new Graphics();
      const pad = this.base * 0.15;
      g.rect(pad, pad, this.base - pad * 2, this.base - pad * 2).fill(TOWER_COLORS[t.kind]);
      if (t.kind === "aura") g.circle(this.base / 2, this.base / 2, this.base * 0.18).fill(COLORS.background);
      if (t.kind === "cannon") g.circle(this.base / 2, this.base / 2, this.base * 0.14).fill(COLORS.background);
      const pip = this.base * 0.1;
      for (let i = 1; i < t.level; i++) g.rect(pad + pip * (2 * i - 1), this.base - pad - pip * 2, pip, pip).fill(COLORS.background);
      g.position.set(t.x * this.base, t.y * this.base);
      this.towers.addChild(g);
      this.towerSprites.set(t.id, { g, level: t.level });
    }
    for (const [id, sprite] of this.towerSprites) {
      if (seen.has(id)) continue;
      sprite.g.destroy();
      this.towerSprites.delete(id);
    }
  }

  private syncEnemies(state: GameState): KillEvent[] {
    const seen = new Set<number>();
    for (const e of state.enemies) {
      seen.add(e.id);
      let sprite = this.enemySprites.get(e.id);
      if (!sprite) {
        sprite = this.createEnemySprite(e);
        this.enemySprites.set(e.id, sprite);
        this.enemies.addChild(sprite.root);
      }
      const p = positionAt(state.mapId, e.progress);
      sprite.root.position.set((p.x / FP) * this.base, (p.y / FP) * this.base);
      const ratio = Math.max(0, e.hp) / e.maxHp;
      if (ratio !== sprite.lastHpRatio) {
        sprite.lastHpRatio = ratio;
        this.drawHpBar(sprite.hp, e.kind, ratio);
      }
    }
    const kills: KillEvent[] = [];
    for (const [id, sprite] of this.enemySprites) {
      if (seen.has(id)) continue;
      if (sprite.lastHpRatio < 1 && !this.leaked(sprite)) kills.push({ x: sprite.root.position.x, y: sprite.root.position.y });
      sprite.root.destroy({ children: true });
      this.enemySprites.delete(id);
    }
    return kills;
  }

  /** An enemy that vanished near the exit cell walked out; it did not die. */
  private leaked(sprite: EnemySprite): boolean {
    return sprite.root.position.x >= this.exitX && sprite.root.position.y >= this.exitY;
  }

  private createEnemySprite(e: Enemy): EnemySprite {
    const root = new Container();
    const body = new Graphics();
    body.circle(0, 0, ENEMY_RADIUS[e.kind] * this.base).fill(ENEMY_COLORS[e.kind]);
    const hp = new Graphics();
    root.addChild(body, hp);
    return { root, body, hp, lastHpRatio: -1 };
  }

  private drawHpBar(g: Graphics, kind: Enemy["kind"], ratio: number): void {
    const r = ENEMY_RADIUS[kind] * this.base;
    const w = r * 2.2;
    const h = Math.max(2, this.base * 0.08);
    const y = -r - h - 2;
    g.clear();
    if (ratio >= 1) return;
    g.rect(-w / 2, y, w, h).fill(COLORS.hpBack);
    g.rect(-w / 2, y, w * ratio, h).fill(COLORS.hpFront);
  }

  private drawRanges(towers: readonly Tower[]): void {
    for (const t of towers) {
      const def = TOWERS[t.kind];
      const cx = (t.x + 0.5) * this.base;
      const cy = (t.y + 0.5) * this.base;
      if (def.range > 0) {
        this.ranges.circle(cx, cy, (def.range / FP) * this.base).stroke({ width: 1, color: COLORS.range, alpha: 0.6 });
      }
      if (def.auraRadius > 0) {
        const side = (def.auraRadius * 2 + 1) * this.base;
        this.ranges.rect(cx - side / 2, cy - side / 2, side, side).stroke({ width: 1, color: COLORS.aura, alpha: 0.7 });
      }
    }
  }
}
