import { describe, expect, it } from "vitest";
import { ENEMIES } from "../src/balance/enemies";
import { GAME } from "../src/balance/game";
import { pathLength } from "../src/path";
import { step } from "../src/step";
import { addEnemy, runTicks, sandbox } from "./helpers";

describe("enemy movement", () => {
  it("each kind advances by its speed every tick", () => {
    const state = sandbox();
    addEnemy(state, "normal", 1000);
    addEnemy(state, "fast", 1000);
    addEnemy(state, "tank", 1000);
    const after = runTicks(state, 10);
    expect(after.enemies.map((e) => e.progress)).toEqual([
      ENEMIES.normal.speed * 10,
      ENEMIES.fast.speed * 10,
      ENEMIES.tank.speed * 10,
    ]);
  });

  it("an enemy reaching the exit leaks and costs lives", () => {
    const state = sandbox();
    const end = pathLength("s");
    addEnemy(state, "normal", 1000, end - ENEMIES.normal.speed);
    addEnemy(state, "tank", 1000, end - ENEMIES.tank.speed);
    const next = step(state);
    expect(next.enemies).toHaveLength(0);
    expect(next.lives).toBe(GAME.lives - ENEMIES.normal.livesCost - ENEMIES.tank.livesCost);
    expect(next.stats.leaks).toBe(2);
  });

  it("the game is lost when lives reach zero and then freezes", () => {
    const state = sandbox();
    state.lives = 1;
    addEnemy(state, "fast", 1000, pathLength("s") - 1);
    const lost = step(state);
    expect(lost.status).toBe("lost");
    expect(lost.lives).toBe(0);
    expect(step(lost)).toBe(lost);
  });
});
