import { describe, expect, it } from "vitest";
import { ENEMIES, GAME, MAPS } from "../src/index";
import { scenario } from "./helpers/scenario";

const exit = MAPS.s.waypoints[MAPS.s.waypoints.length - 1]!;
const bigHp = 100000;

describe("enemy movement and lives", () => {
  it("each kind advances by its speed every tick", () => {
    const walkers = scenario({ seed: 1 })
      .enemy("normal", { x: 0, y: 1, hp: bigHp })
      .enemy("fast", { x: 0, y: 1, hp: bigHp })
      .enemy("tank", { x: 0, y: 1, hp: bigHp })
      .run(10);
    expect(walkers.enemy(0).progress).toBe(ENEMIES.normal.speed * 10);
    expect(walkers.enemy(1).progress).toBe(ENEMIES.fast.speed * 10);
    expect(walkers.enemy(2).progress).toBe(ENEMIES.tank.speed * 10);
  });

  it("a leaked enemy costs the lives of its kind", () => {
    const leaks = scenario({ seed: 1 }).enemy("normal", exit).enemy("tank", exit).run(1);
    expect(leaks.enemies()).toHaveLength(0);
    expect(leaks.lives()).toBe(GAME.lives - ENEMIES.normal.livesCost - ENEMIES.tank.livesCost);
    expect(leaks.state().stats.leaks).toBe(2);
  });

  it("the game is lost when lives reach zero and then freezes", () => {
    const overrun = scenario({ seed: 1 });
    for (let i = 0; i < GAME.lives; i++) overrun.enemy("normal", exit);
    overrun.run(1);
    expect(overrun.status()).toBe("lost");
    expect(overrun.lives()).toBe(0);
    const frozen = overrun.state();
    overrun.run(5);
    expect(overrun.state()).toBe(frozen);
  });

  it("lives never go below zero even when several enemies leak on the same tick", () => {
    const overrun = scenario({ seed: 1 });
    for (let i = 0; i < GAME.lives - 1; i++) overrun.enemy("normal", exit);
    overrun.enemy("tank", exit).enemy("tank", exit).run(1);
    expect(overrun.lives()).toBe(0);
    expect(overrun.status()).toBe("lost");
  });
});
