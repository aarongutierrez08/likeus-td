import { describe, expect, it } from "vitest";
import { ENEMIES, FP, TOWERS, validateCommand } from "../src/index";
import { scenario } from "./helpers/scenario";

const wallCell = 5;
/** Enemies stop at the edge before the wall's cell. */
const stop = wallCell * FP - FP / 2;
const speed = ENEMIES.normal.speed;

describe("wall", () => {
  it("is built on the path and stops enemies at its front edge, where they hit it every tick", () => {
    const game = scenario({ seed: 1 }).tower("wall", { x: wallCell, y: 1 }).enemy("normal", { x: 2, y: 1 }).run(60);
    expect(game.enemy(0).progress).toBe(stop);
    expect(game.tower(0).hp).toBeLessThan(TOWERS.wall.wallHp);
    const firstHitTick = Math.ceil((stop - 2 * FP - speed) / speed);
    const ticksHitting = 60 - firstHitTick;
    expect(game.tower(0).hp).toBe(TOWERS.wall.wallHp - ticksHitting * ENEMIES.normal.wallDamage);
  });

  it("cannot be built off the path, twice by the same player, or before its cooldown after falling", () => {
    const game = scenario({ seed: 1, gold: 1000 }).tower("wall", { x: wallCell, y: 1 }).run(0);
    const offPath = { type: "build" as const, tick: 0, playerId: 0, tower: "wall" as const, x: 3, y: 3 };
    expect(validateCommand(game.state(), offPath)).toBe("not_on_path");
    const second = { ...offPath, x: 8, y: 1 };
    expect(validateCommand(game.state(), second)).toBe("wall_active");
    const hit = scenario({ seed: 1, gold: 1000 })
      .tower("wall", { x: wallCell, y: 1 })
      .enemy("boss", { x: 4, y: 1, offset: FP / 2 });
    hit.tower(0).hp = 1;
    hit.run(1);
    expect(hit.towers()).toHaveLength(0);
    expect(validateCommand(hit.state(), second)).toBe("wall_cooldown");
    hit.run(TOWERS.wall.wallCooldown);
    expect(validateCommand(hit.state(), second)).toBeNull();
    expect(hit.enemy(0).progress).toBeGreaterThan(stop);
  });

  it("takes more damage from bosses than from soldiers and cannot be sold while under attack", () => {
    expect(ENEMIES.boss.wallDamage).toBeGreaterThan(ENEMIES.normal.wallDamage);
    const game = scenario({ seed: 1 })
      .tower("wall", { x: wallCell, y: 1 })
      .enemy("boss", { x: 4, y: 1, offset: FP / 2 })
      .run(1);
    expect(game.tower(0).hp).toBe(TOWERS.wall.wallHp - ENEMIES.boss.wallDamage);
    const sell = { type: "sell" as const, tick: 1, playerId: 0, towerId: game.tower(0).id };
    expect(validateCommand(game.state(), sell)).toBe("wall_under_attack");
    const idle = scenario({ seed: 1 }).tower("wall", { x: wallCell, y: 1 }).run(1);
    expect(validateCommand(idle.state(), { ...sell, towerId: idle.tower(0).id })).toBeNull();
  });

  it("does not stop enemies that already passed it", () => {
    const game = scenario({ seed: 1 }).tower("wall", { x: wallCell, y: 1 }).enemy("normal", { x: 7, y: 1 }).run(2);
    expect(game.enemy(0).progress).toBe(7 * FP + speed * 2);
  });
});
