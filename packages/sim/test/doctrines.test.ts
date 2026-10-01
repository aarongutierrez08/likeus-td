import { describe, expect, it } from "vitest";
import {
  ABILITIES,
  DOCTRINE,
  DOCTRINES,
  DOCTRINE_KINDS,
  ECONOMY,
  ENEMIES,
  TOWERS,
  damageMultiplier,
  doctrineOdds,
  validateCommand,
} from "../src/index";
import { scenario } from "./helpers/scenario";

/** Waves close as their enemies leak too, so no towers are needed to reach a doctrine offer. */
const atOffer = (seed = 3, opts: Parameters<typeof scenario>[0] = { seed }) =>
  scenario({ ...opts, seed, waves: true, startWave: DOCTRINE.everyWaves, gold: opts.gold ?? 1000 }).runUntil(
    (st) => st.wavesClosed === DOCTRINE.everyWaves,
    20000,
  );

describe("doctrine offers", () => {
  it("every player is offered three different doctrines at the close of wave 5, and none before", () => {
    const before = scenario({ seed: 3, waves: true, startWave: 4, players: [0, 1] }).runUntil((st) => st.wavesClosed === 4, 20000);
    expect(before.player(0).doctrineOffer).toEqual([]);
    const game = atOffer(3, { seed: 3, players: [0, 1] });
    for (const id of [0, 1]) {
      const offer = game.player(id).doctrineOffer;
      expect(offer).toHaveLength(DOCTRINE.offerSize);
      expect(new Set(offer).size).toBe(DOCTRINE.offerSize);
    }
  });

  it("the offer is fixed by the seed and never repeats a doctrine already taken", () => {
    expect(atOffer(3).player().doctrineOffer).toEqual(atOffer(3).player().doctrineOffer);
    const taken = DOCTRINE_KINDS.slice(0, 2);
    for (let seed = 1; seed <= 10; seed++) {
      const offer = atOffer(seed, { seed, doctrines: { 0: taken } }).player().doctrineOffer;
      for (const kind of taken) expect(offer).not.toContain(kind);
    }
  });

  it("a player who built an aura always gets the aura doctrine among the three", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const game = scenario({ seed, waves: true, startWave: DOCTRINE.everyWaves, gold: 1000 }).tower("aura", { x: 3, y: 3 });
      game.runUntil((st) => st.wavesClosed === DOCTRINE.everyWaves, 20000);
      expect(game.player().doctrineOffer).toContain("wideAuras");
    }
  });

  it("the odds of the next draw add up to the offer size and favor what fits the player", () => {
    const game = scenario({ seed: 1, gold: 1000 }).tower("aura", { x: 3, y: 3 }).run(0);
    const odds = doctrineOdds(game.state(), 0);
    const total = DOCTRINE_KINDS.reduce((sum, kind) => sum + odds[kind], 0);
    expect(Math.abs(total - DOCTRINE.offerSize * 100)).toBeLessThanOrEqual(DOCTRINE_KINDS.length);
    expect(odds.wideAuras).toBe(100);
    expect(odds.firstCheap).toBeLessThan(100);
  });

  it("picking one adds it and closes the offer; only an offered doctrine can be picked", () => {
    const game = atOffer();
    const offer = game.player().doctrineOffer;
    const notOffered = DOCTRINE_KINDS.find((k) => !offer.includes(k))!;
    expect(validateCommand(game.state(), { type: "chooseDoctrine", tick: 0, playerId: 0, doctrine: notOffered })).toBe("bad_doctrine");
    game.chooseDoctrine(offer[1]!).run(1);
    expect(game.player().doctrines).toEqual([offer[1]]);
    expect(game.player().doctrineOffer).toEqual([]);
    expect(validateCommand(game.state(), { type: "chooseDoctrine", tick: 0, playerId: 0, doctrine: offer[0]! })).toBe("no_offer");
  });

  it("an offer nobody picks expires when the next wave starts", () => {
    const game = atOffer();
    game.runUntil((st) => st.wave === DOCTRINE.everyWaves + 1, 20000);
    expect(game.player().doctrineOffer).toEqual([]);
    expect(game.player().doctrines).toEqual([]);
  });

  it("a reroll brings three others while the pool has enough", () => {
    const game = atOffer();
    const first = game.player().doctrineOffer;
    game.rerollDoctrines().run(1);
    for (const kind of game.player().doctrineOffer) expect(first).not.toContain(kind);
  });

  it("one reroll per offer, for gold", () => {
    const game = atOffer();
    const gold = game.gold();
    game.rerollDoctrines().run(1);
    expect(game.gold()).toBe(gold - DOCTRINE.rerollCost);
    expect(game.player().doctrineOffer).toHaveLength(DOCTRINE.offerSize);
    expect(validateCommand(game.state(), { type: "rerollDoctrines", tick: 0, playerId: 0 })).toBe("already_rerolled");
    const broke = atOffer(3, { seed: 3, gold: 0 });
    expect(validateCommand(broke.state(), { type: "rerollDoctrines", tick: 0, playerId: 0 })).toBe("no_gold");
  });

  it("the bots pick a doctrine", () => {
    const game = scenario({ seed: 3, waves: true, startWave: DOCTRINE.everyWaves, gold: 1000, bot: true });
    game.runUntil((st) => st.wavesClosed === DOCTRINE.everyWaves, 20000).run(2);
    expect(game.player().doctrines).toHaveLength(1);
  });
});

describe("doctrine effects, only on the owner's things", () => {
  it("auras reach one cell further", () => {
    const far = DOCTRINES.wideAuras.auraRadius + TOWERS.aura.auraRadius;
    const hit = (doctrines: boolean) =>
      scenario({ seed: 1, doctrines: doctrines ? { 0: ["wideAuras"] } : {} })
        .tower("archer", { x: 5, y: 2 })
        .tower("aura", { x: 5 + far, y: 2 })
        .enemy("normal", { hp: 1000, x: 5, y: 1 })
        .run(1)
        .enemy(0).hp;
    expect(1000 - hit(false)).toBe(TOWERS.archer.damage);
    expect(1000 - hit(true)).toBe(Math.floor((TOWERS.archer.damage * (100 + TOWERS.aura.auraBonusPct)) / 100));
  });

  it("a new wall has half again its hit points", () => {
    const game = scenario({ seed: 1, gold: 1000, doctrines: { 0: ["tougherWalls"] } })
      .build("wall", { x: 5, y: 1 })
      .run(1);
    const hp = Math.floor((TOWERS.wall.wallHp * (100 + DOCTRINES.tougherWalls.wallHpPct)) / 100);
    expect(game.tower(0).hp).toBe(hp);
    expect(game.tower(0).maxHp).toBe(hp);
  });

  it("interest caps higher, for the owner only", () => {
    const game = scenario({ seed: 3, waves: true, gold: 1000, players: [0, 1], doctrines: { 0: ["savings"] } });
    game.runUntil((st) => st.wavesClosed === 1, 20000);
    expect(game.gold(0) - game.gold(1)).toBe(DOCTRINES.savings.interestCapGold);
  });

  it("interest pays more points below the cap, for the owner only", () => {
    const gold = 100;
    const game = scenario({ seed: 3, waves: true, gold, players: [0, 1], doctrines: { 0: ["savings"] } });
    game.runUntil((st) => st.wavesClosed === 1, 20000);
    const interest = (g: number, pct: number, cap: number) => Math.min(Math.floor((g * pct) / 100), cap);
    let beforeInterest = game.gold(1);
    while (beforeInterest + interest(beforeInterest, ECONOMY.interestPct, ECONOMY.interestCapGold) > game.gold(1)) beforeInterest--;
    const boosted = interest(
      beforeInterest,
      ECONOMY.interestPct + DOCTRINES.savings.interestPct,
      ECONOMY.interestCapGold + DOCTRINES.savings.interestCapGold,
    );
    expect(boosted).toBeGreaterThan(interest(beforeInterest, ECONOMY.interestPct, ECONOMY.interestCapGold));
    expect(game.gold(0)).toBe(beforeInterest + boosted);
  });

  it("the first tower of each wave is cheaper, the next ones are not, and only for the owner", () => {
    const cut = (cost: number) => cost - Math.floor((cost * DOCTRINES.firstCheap.firstTowerDiscountPct) / 100);
    const game = scenario({ seed: 1, gold: 1000, players: [0, 1], doctrines: { 0: ["firstCheap"] } })
      .build("archer", { x: 3, y: 3, player: 0 })
      .build("archer", { x: 3, y: 4, player: 1 })
      .run(1);
    expect(game.gold(0)).toBe(1000 - cut(TOWERS.archer.cost));
    expect(game.gold(1)).toBe(1000 - TOWERS.archer.cost);
    game.build("archer", { x: 4, y: 3 }).run(1);
    expect(game.gold(0)).toBe(1000 - cut(TOWERS.archer.cost) - TOWERS.archer.cost);
  });

  it("abilities come back sooner", () => {
    const game = scenario({ seed: 1, doctrines: { 0: ["quickAbilities"] } })
      .useAbility("bombard", { x: 3, y: 3 })
      .run(1);
    const cooldown = ABILITIES.bombard.levels[0]!.cooldown;
    expect(game.player().abilities.bombard.readyTick).toBe(
      cooldown - Math.floor((cooldown * DOCTRINES.quickAbilities.abilityCooldownPct) / 100),
    );
  });

  it("explosive hits heavy armor harder, only for the owner's towers", () => {
    expect(ENEMIES.tank.armor).toBe("heavy");
    const bonus = DOCTRINES.heavyBlast.armorBonus!.pct;
    const dealt = (owner: number) =>
      1000 -
      scenario({ seed: 1, players: [0, 1], doctrines: { 0: ["heavyBlast"] } })
        .tower("cannon", { x: 5, y: 2, owner })
        .enemy("tank", { hp: 1000, x: 5, y: 1 })
        .run(1)
        .enemy(0).hp;
    expect(dealt(1)).toBe(Math.floor((TOWERS.cannon.damage * damageMultiplier("explosive", "heavy")) / 100));
    expect(dealt(0)).toBe(Math.floor((TOWERS.cannon.damage * (damageMultiplier("explosive", "heavy") + bonus)) / 100));
  });
});
