import { describe, expect, it } from "vitest";
import { ABILITIES, ABILITY_KINDS, ENEMIES, FP, GAME, TOWERS, damageMultiplier, validateCommand } from "../src/index";
import { scenario } from "./helpers/scenario";

const wallCell = 5;
/** An enemy walking from cell 2 stops in front of the wall, right at the center of cell 4. */
const pinnedCell = { x: wallCell - 1, y: 1 };
const pinned = () => scenario({ seed: 1, gold: 1000 }).tower("wall", { x: wallCell, y: 1 });
const bombard = ABILITIES.bombard.levels[0]!;
const frost = ABILITIES.frost.levels[0]!;
const overcharge = ABILITIES.overcharge.levels[0]!;
const repair = ABILITIES.repair.levels[0]!;

describe("abilities", () => {
  it("every player starts with every ability at level 1, ready to use, and so does one who joins", () => {
    const game = scenario({ seed: 1, players: [0, 1] })
      .join(2)
      .run(1);
    for (const id of [0, 1, 2]) {
      for (const kind of ABILITY_KINDS) expect(game.player(id).abilities[kind]).toEqual({ level: 1, readyTick: 0 });
    }
  });

  it("every level after the first changes the cooldown or the effect, never both", () => {
    for (const kind of ABILITY_KINDS) {
      const levels = ABILITIES[kind].levels;
      expect(levels.length).toBe(3);
      for (let i = 1; i < levels.length; i++) {
        const changed = (Object.keys(levels[i]!) as (keyof (typeof levels)[number])[]).filter((k) => levels[i]![k] !== levels[i - 1]![k]);
        const cooldownChanged = changed.includes("cooldown");
        expect(changed.length).toBeGreaterThan(0);
        if (cooldownChanged) expect(changed).toEqual(["cooldown"]);
      }
    }
  });

  it("an unknown ability is refused", () => {
    const game = scenario({ seed: 1 }).run(0);
    const unknown = { type: "useAbility", tick: 0, playerId: 0, ability: "constructor", x: 1, y: 1 } as unknown as Parameters<
      typeof validateCommand
    >[1];
    expect(validateCommand(game.state(), unknown)).toBe("unknown_ability");
  });
});

describe("bombard", () => {
  it("lands after its delay with explosive damage on every enemy in its radius, not before", () => {
    const hp = 1000;
    const game = pinned().enemy("normal", { x: 2, y: 1, hp }).enemy("rider", { x: 3, y: 1, hp }).run(40);
    game.useAbility("bombard", pinnedCell).run(bombard.delay);
    expect(game.enemy(0).hp).toBe(hp);
    expect(game.state().blasts).toHaveLength(1);
    game.run(1);
    expect(game.enemy(0).hp).toBe(hp - Math.floor((bombard.damage * damageMultiplier("explosive", "none")) / 100));
    expect(game.enemy(1).hp).toBe(hp - Math.floor((bombard.damage * damageMultiplier("explosive", "light")) / 100));
    expect(game.state().blasts).toHaveLength(0);
    expect(game.state().stats.damageByAbility.bombard).toBeGreaterThan(0);
  });

  it("leaves enemies outside its radius untouched and can be aimed off the path", () => {
    const game = pinned().enemy("normal", { x: 2, y: 1, hp: 1000 }).run(40);
    game.useAbility("bombard", { x: pinnedCell.x, y: pinnedCell.y + 3 }).run(bombard.delay + 1);
    expect(game.enemy(0).hp).toBe(1000);
  });

  it("goes on cooldown and is ready again once the cooldown is over", () => {
    const game = scenario({ seed: 1 }).useAbility("bombard", pinnedCell).run(1);
    const again = { type: "useAbility" as const, tick: 0, playerId: 0, ability: "bombard" as const, ...pinnedCell };
    expect(validateCommand(game.state(), again)).toBe("ability_cooldown");
    game.run(bombard.cooldown - 1);
    expect(validateCommand(game.state(), again)).toBeNull();
  });

  it("each player has their own cooldown", () => {
    const game = scenario({ seed: 1, players: [0, 1] })
      .useAbility("bombard", pinnedCell, 0)
      .run(1);
    const byOther = { type: "useAbility" as const, tick: 0, playerId: 1, ability: "bombard" as const, ...pinnedCell };
    expect(validateCommand(game.state(), byOther)).toBeNull();
  });

  it("a shield absorbs it, a mark adds to it and stealth does not hide from it", () => {
    const hp = 1000;
    const shielded = pinned().enemy("shielded", { x: 3, y: 1, hp }).run(40);
    shielded.useAbility("bombard", pinnedCell).run(bombard.delay + 1);
    expect(shielded.enemy(0).hp).toBe(hp);
    expect(shielded.enemy(0).shield).toBe(0);
    const stealthy = pinned().enemy("shade", { x: 3, y: 1, hp }).run(40);
    stealthy.useAbility("bombard", pinnedCell).run(bombard.delay + 1);
    const plain = Math.floor((bombard.damage * damageMultiplier("explosive", "none")) / 100);
    expect(stealthy.enemy(0).hp).toBe(hp - plain);
    const marked = scenario({ seed: 1, gold: 1000 })
      .tower("wall", { x: wallCell, y: 1 })
      .tower("radar", { x: 4, y: 3 })
      .enemy("shade", { x: 3, y: 1, hp });
    marked.upgrade(marked.tower(1).id).run(1).upgrade(marked.tower(1).id, 0, "b").run(40);
    marked.useAbility("bombard", pinnedCell).run(bombard.delay + 1);
    expect(marked.enemy(0).hp).toBe(hp - Math.floor((plain * (100 + TOWERS.radar.branches!.b.def.markPct)) / 100));
  });

  it("a kill by bombard counts like any kill: the tower that was hitting it gets the kill", () => {
    const game = pinned().tower("archer", { x: pinnedCell.x, y: 2 }).enemy("normal", { x: 2, y: 1, hp: 100 }).run(40);
    game.useAbility("bombard", pinnedCell).run(bombard.delay + 1);
    expect(game.alive(0)).toBe(false);
    expect(game.tower(1).kills).toBe(1);
  });

  it("a kill by bombard pays the gold aura around the tower that was hitting it", () => {
    const withAura = pinned()
      .tower("archer", { x: pinnedCell.x, y: 2 })
      .tower("greed", { x: pinnedCell.x + 1, y: 2 })
      .enemy("normal", { x: 2, y: 1, hp: 100 })
      .run(40);
    const without = pinned().tower("archer", { x: pinnedCell.x, y: 2 }).enemy("normal", { x: 2, y: 1, hp: 100 }).run(40);
    for (const game of [withAura, without]) game.useAbility("bombard", pinnedCell).run(bombard.delay + 1);
    const cut = Math.floor((ENEMIES.normal.bounty * TOWERS.greed.auraBonusPct) / 100);
    expect(withAura.gold() - without.gold()).toBe(cut);
  });

  it("its last level hits harder", () => {
    const hp = 1000;
    const game = pinned().enemy("normal", { x: 2, y: 1, hp }).upgradeAbility("bombard").run(1).upgradeAbility("bombard").run(39);
    game.useAbility("bombard", pinnedCell).run(bombard.delay + 1);
    const top = ABILITIES.bombard.levels[2]!.damage;
    expect(top).toBeGreaterThan(bombard.damage);
    expect(game.enemy(0).hp).toBe(hp - Math.floor((top * damageMultiplier("explosive", "none")) / 100));
  });

  it("cannot be aimed outside the map", () => {
    const game = scenario({ seed: 1 }).run(0);
    expect(validateCommand(game.state(), { type: "useAbility", tick: 0, playerId: 0, ability: "bombard", x: -1, y: 0 })).toBe("outside");
    expect(validateCommand(game.state(), { type: "useAbility", tick: 0, playerId: 0, ability: "bombard" })).toBe("outside");
  });
});

describe("frost", () => {
  const speed = ENEMIES.normal.speed;
  const slowed = Math.floor((speed * (100 - frost.slowPct)) / 100);

  it("slows every enemy on that stretch of path from the tick it is cast", () => {
    const game = scenario({ seed: 1 }).enemy("normal", { x: 5, y: 1 }).useAbility("frost", { x: 5, y: 1 }).run(1);
    expect(game.enemy(0).progress).toBe(5 * FP + slowed);
  });

  it("does not stack with a weaker frost tower: the stronger slow applies", () => {
    expect(frost.slowPct).toBeGreaterThan(TOWERS.frost.controlPct);
    const game = scenario({ seed: 1 })
      .tower("frost", { x: 5, y: 2 })
      .enemy("normal", { x: 5, y: 1 })
      .useAbility("frost", { x: 5, y: 1 })
      .run(3);
    expect(game.enemy(0).progress).toBe(5 * FP + 3 * slowed);
  });

  it("two stretches from different players on the same spot slow like one", () => {
    const game = scenario({ seed: 1, players: [0, 1] })
      .enemy("normal", { x: 5, y: 1 })
      .useAbility("frost", { x: 5, y: 1 }, 0)
      .useAbility("frost", { x: 5, y: 1 }, 1)
      .run(1);
    expect(game.enemy(0).progress).toBe(5 * FP + slowed);
  });

  it("leaves a frost tower's own slow on the enemy for when it walks out", () => {
    const game = scenario({ seed: 1 })
      .tower("frost", { x: 5, y: 2 })
      .enemy("normal", { x: 5, y: 1 })
      .useAbility("frost", { x: 5, y: 1 })
      .run(2);
    expect(game.enemy(0).slowPct).toBe(TOWERS.frost.controlPct);
    expect(game.enemy(0).slowUntil).toBeGreaterThan(game.state().tick);
  });

  it("melts after its duration and only goes on the path", () => {
    const game = scenario({ seed: 1 }).useAbility("frost", { x: 5, y: 1 }).run(1);
    expect(game.state().frostZones).toHaveLength(1);
    game.run(frost.duration);
    expect(game.state().frostZones).toHaveLength(0);
    const offPath = { type: "useAbility" as const, tick: 0, playerId: 0, ability: "frost" as const, x: 5, y: 4 };
    expect(validateCommand(scenario({ seed: 1 }).run(0).state(), offPath)).toBe("not_on_path");
  });
});

describe("overcharge", () => {
  const cooldown = TOWERS.archer.cooldown;
  const target = () =>
    scenario({ seed: 1 }).tower("archer", { x: 5, y: 2 }).tower("wall", { x: 6, y: 1 }).enemy("swarm", { x: 5, y: 1, hp: 1000000 });
  const shots = (game: ReturnType<typeof target>) => game.tower(0).damageDealt / TOWERS.archer.damage;

  it("an own attack tower fires at double rate while it lasts, then back to normal", () => {
    const normal = target().run(overcharge.duration);
    const boosted = target();
    boosted.useAbility("overcharge", { towerId: boosted.tower(0).id }).run(overcharge.duration);
    expect(shots(boosted)).toBeGreaterThanOrEqual(2 * shots(normal) - 1);
    boosted.run(1);
    const before = shots(boosted);
    boosted.run(8 * cooldown);
    expect(shots(boosted) - before).toBe(8);
  });

  it("a shorter overcharge on a team tower never cuts a longer one short", () => {
    const game = scenario({ seed: 1, players: [0, 1], gold: 1000 }).tower("archer", { x: 5, y: 2 });
    const id = game.tower(0).id;
    game.upgradeAbility("overcharge", 0).run(1).useAbility("overcharge", { towerId: id }, 0).run(1).leave(0).run(1);
    const until = game.tower(0).overchargeUntil;
    expect(ABILITIES.overcharge.levels[1]!.duration).toBeGreaterThan(overcharge.duration + 2);
    game.useAbility("overcharge", { towerId: id }, 1).run(1);
    expect(game.tower(0).overchargeUntil).toBe(until);
  });

  it("cannot be cast on another player's tower or on a tower that does not attack", () => {
    const game = scenario({ seed: 1, players: [0, 1] })
      .tower("archer", { x: 5, y: 2, owner: 1 })
      .tower("aura", { x: 6, y: 2 })
      .run(0);
    const on = (towerId: number) => ({ type: "useAbility" as const, tick: 0, playerId: 0, ability: "overcharge" as const, towerId });
    expect(validateCommand(game.state(), on(game.tower(0).id))).toBe("not_owner");
    expect(validateCommand(game.state(), on(game.tower(1).id))).toBe("bad_target");
    expect(validateCommand(game.state(), on(9999))).toBe("no_tower");
  });
});

describe("repair", () => {
  it("gives the team a life back and puts only its owner on cooldown", () => {
    const game = scenario({ seed: 1, players: [0, 1] })
      .enemy("normal", { x: 0, y: 1, offset: 100000 })
      .run(5);
    const livesBefore = game.lives();
    expect(livesBefore).toBeLessThan(GAME.lives);
    game.useAbility("repair", null, 0).run(1);
    expect(game.lives()).toBe(livesBefore + repair.lives);
    const again = { type: "useAbility" as const, tick: 0, playerId: 0, ability: "repair" as const };
    const byOther = { ...again, playerId: 1 };
    expect(validateCommand(game.state(), again)).toBe("ability_cooldown");
    expect(validateCommand(game.state(), byOther)).toBeNull();
  });

  it("only its owner upgrades it", () => {
    const cost = ABILITIES.repair.upgradeCost;
    const game = scenario({ seed: 1, players: [0, 1], gold: cost })
      .upgradeAbility("repair", 0)
      .run(1);
    expect(game.player(0).abilities.repair.level).toBe(2);
    expect(game.player(1).abilities.repair.level).toBe(1);
    expect(game.gold(1)).toBe(cost);
  });
});

describe("ability upgrades", () => {
  it("cost gold, apply the next level and stop at the last one", () => {
    const cost = ABILITIES.bombard.upgradeCost;
    const game = scenario({ seed: 1, gold: cost * 2 })
      .upgradeAbility("bombard")
      .run(1);
    expect(game.player().abilities.bombard.level).toBe(2);
    expect(game.gold()).toBe(cost);
    game.upgradeAbility("bombard").run(1);
    expect(game.player().abilities.bombard.level).toBe(3);
    const more = { type: "upgradeAbility" as const, tick: 0, playerId: 0, ability: "bombard" as const };
    expect(validateCommand(game.state(), more)).toBe("max_level");
  });

  it("are refused without enough gold", () => {
    const game = scenario({ seed: 1, gold: ABILITIES.bombard.upgradeCost - 1 }).run(0);
    expect(validateCommand(game.state(), { type: "upgradeAbility", tick: 0, playerId: 0, ability: "bombard" })).toBe("no_gold");
  });

  it("a shorter cooldown level makes the ability ready sooner", () => {
    const game = scenario({ seed: 1, gold: 1000 }).upgradeAbility("bombard").run(1).useAbility("bombard", pinnedCell).run(1);
    expect(game.player().abilities.bombard.readyTick).toBe(1 + ABILITIES.bombard.levels[1]!.cooldown);
  });
});
