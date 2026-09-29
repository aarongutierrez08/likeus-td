import { describe, expect, it } from "vitest";
import { ENEMIES, FP, TOWERS, UPGRADE, towerDef, towerIncome, validateCommand, type TowerKind } from "../src/index";
import { scenario, type Scenario } from "./helpers/scenario";

const hp = 1000;

/** A tower of that kind with both upgrades queued for the first tick, so it fires as a level-3 branch from the start. */
function branched(kind: TowerKind, branch: "a" | "b", at: { x: number; y: number }, extra?: (game: Scenario) => Scenario): Scenario {
  const game = scenario({ seed: 1, gold: TOWERS[kind].cost * 2 + 1000 }).tower(kind, at);
  const withEnemies = extra ? extra(game) : game;
  const id = withEnemies.tower(0).id;
  return withEnemies.upgrade(id).upgrade(id, 0, branch);
}

describe("branches at level 3", () => {
  it("the third level needs a branch, and every tower except the wall offers two", () => {
    for (const kind of Object.keys(TOWERS) as TowerKind[]) {
      if (kind === "wall") expect(TOWERS[kind].branches).toBeNull();
      else expect(TOWERS[kind].branches).not.toBeNull();
    }
    const game = scenario({ seed: 1, gold: TOWERS.archer.cost * 2 })
      .tower("archer", { x: 4, y: 2 })
      .run(0);
    const id = game.tower(0).id;
    game.upgrade(id).run(1);
    expect(game.tower(0).level).toBe(2);
    expect(validateCommand(game.state(), { type: "upgrade", tick: 1, playerId: 0, towerId: id })).toBe("branch_required");
    game.upgrade(id, 0, "b").run(1);
    expect(game.tower(0).level).toBe(UPGRADE.maxLevel);
    expect(game.tower(0).branch).toBe("b");
    expect(towerDef(game.tower(0)).label).toBe(TOWERS.archer.branches!.b.label);
    expect(towerDef(game.tower(0)).cooldown).toBeLessThan(TOWERS.archer.cooldown);
  });

  it("a sharpshooter archer aims at the enemy with the most hp instead of the furthest", () => {
    const game = branched("archer", "a", { x: 4, y: 2 }, (g) =>
      g.enemy("normal", { x: 4, y: 1, hp: 100 }).enemy("tank", { x: 3, y: 1, hp: 500 }),
    );
    game.run(1);
    expect(game.enemy(0).hp).toBe(100);
    expect(game.enemy(1).hp).toBeLessThan(500);
  });

  it("a chain mage hits a second enemy near its target, never a third", () => {
    const game = branched("mage", "b", { x: 4, y: 2 }, (g) =>
      g
        .enemy("normal", { x: 4, y: 1, hp })
        .enemy("normal", { x: 4, y: 1, hp, offset: -400 })
        .enemy("normal", { x: 4, y: 1, hp, offset: -800 }),
    );
    game.run(1);
    expect(game.enemy(0).hp).toBeLessThan(hp);
    expect(game.enemy(1).hp).toBeLessThan(hp);
    expect(game.enemy(2).hp).toBe(hp);
  });

  it("a mortar cannon reaches far but does not fire at what is next to it", () => {
    const close = branched("cannon", "b", { x: 4, y: 2 }, (g) => g.enemy("normal", { x: 4, y: 1, hp }));
    close.run(1);
    expect(close.enemy(0).hp).toBe(hp);
    const far = branched("cannon", "b", { x: 4, y: 2 }, (g) => g.enemy("normal", { x: 8, y: 1, hp }));
    far.run(1);
    expect(far.enemy(0).hp).toBeLessThan(hp);
  });

  it("a lookout aura extends the range of towers in its square instead of their rate", () => {
    const cell = { x: 5, y: 2 };
    const outOfReach = { x: 5 + Math.ceil(TOWERS.archer.range / FP), y: 1 };
    const plain = scenario({ seed: 1 })
      .tower("archer", cell)
      .enemy("normal", { ...outOfReach, hp })
      .run(1);
    expect(plain.enemy(0).hp).toBe(hp);
    const game = branched("haste", "b", { x: 4, y: 3 }, (g) => g.tower("archer", cell).enemy("normal", { ...outOfReach, hp }));
    game.run(1);
    expect(game.enemy(0).hp).toBeLessThan(hp);
  });

  it("a shared gold aura pays every player a smaller cut", () => {
    const start = 1000;
    const game = scenario({ seed: 1, players: [0, 1], gold: start })
      .tower("archer", { x: 5, y: 2, owner: 0 })
      .tower("greed", { x: 6, y: 3, owner: 1 })
      .enemy("normal", { x: 5, y: 1, hp: 1 });
    const aura = game.tower(1).id;
    game.upgrade(aura, 1).upgrade(aura, 1, "b").run(1);
    expect(game.enemies()).toHaveLength(0);
    const cut = Math.floor((ENEMIES.normal.bounty * TOWERS.greed.branches!.b.def.auraBonusPct) / 100);
    expect(cut).toBeGreaterThan(0);
    expect(cut).toBeLessThan(Math.floor((ENEMIES.normal.bounty * TOWERS.greed.auraBonusPct) / 100));
    const spent = TOWERS.greed.cost * 2;
    expect(game.gold(1) + spent - game.gold(0)).toBe(0);
    expect(game.gold(0) - start).toBeGreaterThan(0);
  });

  it("a bank mine raises its owner's interest cap instead of paying gold", () => {
    const rich = 5000;
    const defended = (withBank: boolean): Scenario => {
      const game = scenario({ seed: 1, waves: true, gold: rich });
      for (let x = 0; x < 8; x++) game.tower("archer", { x, y: 0 });
      if (withBank) {
        game.tower("mine", { x: 3, y: 3 });
        const id = game.tower(8).id;
        game.upgrade(id).upgrade(id, 0, "b");
      }
      return game.runUntil((st) => st.wavesClosed === 1, 20000);
    };
    const plain = defended(false);
    const bank = defended(true);
    expect(bank.state().wavesClosed).toBe(1);
    const upgrades = TOWERS.mine.cost * 2;
    const extraInterest = towerIncome(bank.tower(8));
    expect(extraInterest).toBeGreaterThan(0);
    expect(bank.gold(0) - plain.gold(0)).toBe(extraInterest - upgrades);
  });

  it("a marking radar makes revealed enemies take extra damage from everyone", () => {
    const plainHit = Math.floor((TOWERS.cannon.damage * 150) / 100);
    const game = branched("radar", "b", { x: 3, y: 3 }, (g) => g.tower("cannon", { x: 4, y: 3 }).enemy("shade", { x: 4, y: 1, hp }));
    game.run(1);
    const marked = Math.floor((plainHit * (100 + TOWERS.radar.branches!.b.def.markPct)) / 100);
    expect(marked).toBeGreaterThan(plainHit);
    expect(game.enemy(0).hp).toBe(hp - marked);
  });
});
