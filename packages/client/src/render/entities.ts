import { Container, Graphics } from "pixi.js";
import {
  ENEMIES,
  FP,
  PLAYER_COLORS,
  TEAM_OWNER,
  towerDef,
  currentSpeed,
  isRevealed,
  hasAttack,
  hasAura,
  hasControl,
  hasIncome,
  hasReveal,
  hasWall,
  positionAt,
  type Enemy,
  type EnemyKind,
  type GameState,
  type Tower,
  type TowerDef,
} from "@td/sim";
import { COLORS } from "./colors";

interface EnemySprite {
  root: Container;
  body: Graphics;
  hp: Graphics;
  shield: Graphics;
  kind: EnemyKind;
  lastHpRatio: number;
  lastShield: number;
  lastHitBy: number;
}

/** Keeps one display object per entity id and syncs it with the state every frame. */
export interface KillEvent {
  x: number;
  y: number;
  kind: EnemyKind;
  /** Player who owns the tower that landed the kill; null for the team or when unknown. */
  owner: number | null;
}

/** Hidden stealth enemies are ghosts, stunned enemies fade the most, slowed ones a little: readable without text. */
function statusAlpha(state: GameState, enemy: Enemy): number {
  if (!isRevealed(state, enemy)) return 0.25;
  const speed = currentSpeed(state, enemy);
  if (speed === 0) return 0.35;
  return speed < ENEMIES[enemy.kind].speed ? 0.65 : 1;
}

const AFFIX_COLORS = { fast: 0xf4c542, shielded: 0xffffff, regenerating: 0x7fe0a0 } as const;

const TEAM_RING = 0x8a8f9a;

function ownerColor(state: GameState, owner: number): number {
  const player = state.players.find((p) => p.id === owner);
  return player ? (PLAYER_COLORS[player.color] ?? TEAM_RING) : TEAM_RING;
}

export class EntityLayer {
  readonly towers = new Container();
  readonly enemies = new Container();
  readonly ranges = new Graphics();
  private readonly towerSprites = new Map<number, { g: Graphics; level: number; hp: number; color: number }>();
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
    this.syncTowers(state);
    const kills = this.syncEnemies(state);
    this.ranges.clear();
    if (showRanges) this.drawRanges(state.towers);
    return kills;
  }

  /**
   * Family = silhouette, owner = ring color, kind = fill color and glyph, level = pips.
   * Five shapes are learnable; eleven are not. Sprites will replace the shapes but keep this rule.
   */
  private drawTower(g: Graphics, t: Tower, ownerColor: number): void {
    const def = towerDef(t);
    const b = this.base;
    const c = b / 2;
    const r = b * 0.36;
    const outline = (): Graphics => {
      if (hasAttack(def)) return g.rect(c - r, c - r, r * 2, r * 2);
      if (hasControl(def)) return g.poly([c, c - r, c + r, c, c, c + r, c - r, c]);
      if (hasAura(def)) return g.circle(c, c, r);
      if (hasIncome(def)) return g.poly([c, c - r, c + r, c + r * 0.8, c - r, c + r * 0.8]);
      return g.poly([c - r * 0.5, c - r, c + r * 0.5, c - r, c + r, c, c + r * 0.5, c + r, c - r * 0.5, c + r, c - r, c]);
    };
    outline().fill(def.color);
    outline().stroke({ width: 3, color: ownerColor });
    this.drawGlyph(g, def, c);
    const pip = b * 0.08;
    for (let i = 1; i < t.level; i++) g.rect(c - r + pip * (2 * i - 1), c + r - pip * 2.2, pip, pip).fill(COLORS.background);
    if (hasWall(def) && t.hp < def.wallHp) {
      const w = r * 2;
      const h = Math.max(2, b * 0.08);
      g.rect(c - r, c - r - h - 2, w, h).fill(COLORS.hpBack);
      g.rect(c - r, c - r - h - 2, (w * t.hp) / def.wallHp, h).fill(COLORS.hpFront);
    }
  }

  /** Tells kinds apart inside a family with one primitive each. */
  private drawGlyph(g: Graphics, def: TowerDef, c: number): void {
    const s = this.base * 0.1;
    const ink = COLORS.background;
    switch (def.attackType) {
      case "pierce":
        g.rect(c - s * 0.3, c - s * 1.4, s * 0.6, s * 2.8).fill(ink);
        return;
      case "blunt":
        g.rect(c - s, c - s, s * 2, s * 2).fill(ink);
        return;
      case "magic":
        g.circle(c, c, s).fill(ink);
        return;
      case "explosive":
        g.circle(c, c, s * 1.2).stroke({ width: 2, color: ink });
        return;
      case null:
        break;
    }
    switch (def.auraStat) {
      case "damage":
        g.rect(c - s * 0.3, c - s * 1.2, s * 0.6, s * 2.4).fill(ink);
        return;
      case "rate":
        g.rect(c - s * 1.1, c - s * 1.2, s * 0.6, s * 2.4).fill(ink);
        g.rect(c + s * 0.5, c - s * 1.2, s * 0.6, s * 2.4).fill(ink);
        return;
      case "gold":
        g.rect(c - s * 0.8, c - s * 0.8, s * 1.6, s * 1.6).fill(ink);
        return;
      case null:
        break;
    }
    switch (def.controlEffect) {
      case "slow":
        g.rect(c - s * 1.4, c - s * 0.3, s * 2.8, s * 0.6).fill(ink);
        return;
      case "stun":
        g.poly([c, c - s * 1.3, c + s * 1.2, c + s, c - s * 1.2, c + s]).fill(ink);
        return;
      case null:
        break;
    }
    if (hasReveal(def)) g.circle(c, c, s * 1.2).stroke({ width: 2, color: ink });
    if (hasIncome(def)) g.rect(c - s * 0.7, c - s * 0.3, s * 1.4, s * 1.4).fill(ink);
  }

  private syncTowers(state: GameState): void {
    const seen = new Set<number>();
    for (const t of state.towers) {
      seen.add(t.id);
      const color = ownerColor(state, t.owner);
      const existing = this.towerSprites.get(t.id);
      if (existing && existing.level === t.level && existing.hp === t.hp && existing.color === color) continue;
      existing?.g.destroy();
      const g = new Graphics();
      this.drawTower(g, t, color);
      g.position.set(t.x * this.base, t.y * this.base);
      this.towers.addChild(g);
      this.towerSprites.set(t.id, { g, level: t.level, hp: t.hp, color });
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
      sprite.body.alpha = statusAlpha(state, e);
      sprite.lastHitBy = e.lastHitBy;
      if (e.shield !== sprite.lastShield) {
        sprite.lastShield = e.shield;
        sprite.shield.clear();
        if (e.shield > 0)
          sprite.shield.circle(0, 0, ENEMIES[e.kind].radius * this.base + 3).stroke({ width: 2, color: AFFIX_COLORS.shielded });
      }
      const ratio = Math.max(0, e.hp) / e.maxHp;
      if (ratio !== sprite.lastHpRatio) {
        sprite.lastHpRatio = ratio;
        this.drawHpBar(sprite.hp, e.kind, ratio);
      }
    }
    const kills: KillEvent[] = [];
    for (const [id, sprite] of this.enemySprites) {
      if (seen.has(id)) continue;
      if (sprite.lastHpRatio < 1 && !this.leaked(sprite)) {
        const killer = state.towers.find((t) => t.id === sprite.lastHitBy);
        const owner = killer && killer.owner !== TEAM_OWNER ? killer.owner : null;
        kills.push({ x: sprite.root.position.x, y: sprite.root.position.y, kind: sprite.kind, owner });
      }
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
    body.circle(0, 0, ENEMIES[e.kind].radius * this.base).fill(ENEMIES[e.kind].color);
    if (e.affix !== null) {
      body.circle(0, 0, ENEMIES[e.kind].radius * this.base + 6).stroke({ width: 3, color: AFFIX_COLORS[e.affix] });
    }
    const hp = new Graphics();
    const shield = new Graphics();
    root.addChild(body, shield, hp);
    return { root, body, hp, shield, kind: e.kind, lastHpRatio: -1, lastShield: -1, lastHitBy: 0 };
  }

  private drawHpBar(g: Graphics, kind: Enemy["kind"], ratio: number): void {
    const r = ENEMIES[kind].radius * this.base;
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
      const def = towerDef(t);
      const cx = (t.x + 0.5) * this.base;
      const cy = (t.y + 0.5) * this.base;
      const reach = Math.max(def.range, def.controlRange, def.revealRange);
      if (reach > 0) {
        this.ranges.circle(cx, cy, (reach / FP) * this.base).stroke({ width: 1, color: COLORS.range, alpha: 0.6 });
      }
      if (def.auraRadius > 0) {
        const side = (def.auraRadius * 2 + 1) * this.base;
        this.ranges.rect(cx - side / 2, cy - side / 2, side, side).stroke({ width: 1, color: COLORS.aura, alpha: 0.7 });
      }
    }
  }
}
