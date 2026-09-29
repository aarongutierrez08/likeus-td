import { describe, expect, it } from "vitest";
import { AFFIXES, ENEMIES, FP, GAME, TOWERS, WAVES, bossAffix, damageMultiplier } from "../src/index";
import { scenario } from "./helpers/scenario";

const hp = 1000;
const archerHit = TOWERS.archer.damage;

describe("stealth enemies", () => {
  it("cannot be targeted by attack or control towers until a radar reveals them", () => {
    const hidden = scenario({ seed: 1 })
      .tower("archer", { x: 5, y: 2 })
      .tower("frost", { x: 6, y: 2 })
      .enemy("shade", { x: 5, y: 1, hp })
      .run(2);
    expect(hidden.enemy(0).hp).toBe(hp);
    expect(hidden.enemy(0).progress).toBe(5 * FP + ENEMIES.shade.speed * 2);
    const revealed = scenario({ seed: 1 })
      .tower("archer", { x: 5, y: 2 })
      .tower("radar", { x: 4, y: 2 })
      .enemy("shade", { x: 5, y: 1, hp })
      .run(1);
    expect(revealed.enemy(0).hp).toBeLessThan(hp);
  });

  it("still take splash damage from a shot aimed at a visible enemy", () => {
    const game = scenario({ seed: 1 })
      .tower("cannon", { x: 5, y: 3 })
      .enemy("normal", { x: 5, y: 1, hp })
      .enemy("shade", { x: 5, y: 1, hp, offset: -100 })
      .run(1);
    expect(game.enemy(1).hp).toBeLessThan(hp);
  });
});

describe("healer", () => {
  const every = ENEMIES.healer.healEvery;
  const amount = ENEMIES.healer.healAmount;

  it("heals nearby enemies every interval, never itself and never above max hp", () => {
    expect(amount).toBeGreaterThan(0);
    const game = scenario({ seed: 1 })
      .enemy("normal", { x: 5, y: 1, hp: 100 })
      .enemy("healer", { x: 5, y: 1, hp: 100, offset: -200 })
      .enemy("normal", { x: 5, y: 1, hp: 100, offset: -300 });
    game.run(1);
    const wounded = game.enemy(0);
    wounded.hp = 100 - amount * 3;
    const healer = game.enemy(1);
    healer.hp = 50;
    game.run(every);
    expect(game.enemy(0).hp).toBe(100 - amount * 2);
    expect(game.enemy(1).hp).toBe(50);
    expect(game.enemy(2).hp).toBe(100);
  });
});

describe("shielded enemies", () => {
  it("absorb the first hit and take the second one in full", () => {
    const game = scenario({ seed: 1 }).tower("archer", { x: 5, y: 2 }).enemy("shielded", { x: 5, y: 1, hp }).run(1);
    expect(game.enemy(0).hp).toBe(hp);
    game.run(TOWERS.archer.cooldown);
    expect(game.enemy(0).hp).toBe(hp - Math.floor((archerHit * damageMultiplier("pierce", ENEMIES.shielded.armor)) / 100));
  });
});

describe("splitting enemies", () => {
  it("leave three smaller enemies of the same wave where they died", () => {
    const game = scenario({ seed: 1, waves: true, startWave: 1, gold: 0 }).run(GAME.firstWaveTick + 1);
    const state = game.state();
    const blob = { ...state.enemies[0]!, kind: "blob" as const, hp: 1, maxHp: 1, progress: 5 * FP };
    state.enemies = [blob];
    state.spawnQueue = [];
    game.run(0);
    expect(game.enemies()).toHaveLength(1);
    const after = scenario({ seed: 1 }).tower("archer", { x: 5, y: 2 }).enemy("blob", { x: 5, y: 1, hp: 1 }).run(1);
    const children = after.enemies();
    expect(children).toHaveLength(ENEMIES.blob.splitCount);
    for (const child of children) {
      expect(child.kind).toBe("blobling");
      expect(child.progress).toBeLessThanOrEqual(5 * FP + ENEMIES.blob.speed);
    }
  });

  it("keep the wave open until they die", () => {
    const game = scenario({ seed: 1, waves: true, gold: 0 }).run(GAME.firstWaveTick + 1);
    const state = game.state();
    state.enemies = [{ ...state.enemies[0]!, kind: "blob", hp: 0, maxHp: 1 }];
    state.spawnQueue = [];
    game.run(1);
    expect(game.state().wavesClosed).toBe(0);
    expect(game.enemies().every((e) => e.kind === "blobling" && e.wave === 1)).toBe(true);
  });
});

describe("bosses", () => {
  it("come in the tenth and twentieth wave with an affix fixed by seed and wave", () => {
    expect(WAVES).toHaveLength(20);
    for (const wave of [10, 20]) expect(WAVES[wave - 1]!.groups.some((g) => g.kind === "boss")).toBe(true);
    const game = scenario({ seed: 7, waves: true, startWave: 10 }).run(GAME.firstWaveTick + 1);
    const queued = [
      ...game.state().spawnQueue.map((s) => ({ kind: s.kind, affix: s.affix })),
      ...game.enemies().map((e) => ({ kind: e.kind, affix: e.affix })),
    ];
    const boss = queued.find((e) => e.kind === "boss")!;
    expect(boss.affix).toBe(bossAffix(7, 10));
    expect(queued.filter((e) => e.kind !== "boss").every((e) => e.affix === null)).toBe(true);
  });

  it("a fast boss moves faster, a shielded one re-arms its shield, a regenerating one heals itself", () => {
    const fast = scenario({ seed: 1 }).enemy("boss", { x: 5, y: 1, affix: "fast" }).run(1);
    expect(fast.enemy(0).progress).toBe(5 * FP + Math.floor((ENEMIES.boss.speed * (100 + AFFIXES.fast.speedPct)) / 100));

    const shielded = scenario({ seed: 1 }).tower("archer", { x: 5, y: 2 }).enemy("boss", { x: 5, y: 1, hp, affix: "shielded" }).run(1);
    expect(shielded.enemy(0).hp).toBe(hp);
    expect(shielded.enemy(0).shield).toBe(0);
    shielded.run(AFFIXES.shielded.rearmEvery);
    expect(shielded.enemy(0).shield).toBe(1);

    const regen = scenario({ seed: 1 }).enemy("boss", { x: 5, y: 1, hp, affix: "regenerating" });
    regen.run(1);
    regen.enemy(0).hp = 500;
    regen.run(AFFIXES.regenerating.every);
    expect(regen.enemy(0).hp).toBe(500 + Math.floor((hp * AFFIXES.regenerating.healPct) / 100));
  });
});
