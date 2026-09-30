import { describe, expect, it } from "vitest";
import { DECK, DEFAULT_DECKS, TOWER_KINDS, createInitialState, deckProblem, randomDeck, validateCommand, type Deck } from "../src/index";
import { scenario } from "./helpers/scenario";

const coopDeck = DEFAULT_DECKS.coop;
const otherDeck: Deck = { towers: ["archer", "mage", "frost", "wall", "aura"], abilities: ["frost", "overcharge"] };
const twoPlayers = () =>
  scenario({ seed: 1, gold: 1000, players: [0, 1], deckTowers: DECK.coopTowers, decks: { 0: coopDeck, 1: otherDeck } });
const build = (playerId: number, tower: Deck["towers"][number]) => ({ type: "build" as const, tick: 0, playerId, tower, x: 3, y: 3 });

describe("decks", () => {
  it("a player builds only the towers of their own deck", () => {
    const game = twoPlayers().run(0);
    expect(validateCommand(game.state(), build(0, "cannon"))).toBeNull();
    expect(validateCommand(game.state(), build(1, "cannon"))).toBe("not_in_deck");
    expect(validateCommand(game.state(), build(1, "frost"))).toBeNull();
  });

  it("a player uses and upgrades only the abilities of their own deck", () => {
    const game = twoPlayers().run(0);
    const use = (playerId: number, ability: Deck["abilities"][number]) => ({ type: "useAbility" as const, tick: 0, playerId, ability });
    expect(validateCommand(game.state(), use(0, "repair"))).toBeNull();
    expect(validateCommand(game.state(), use(1, "repair"))).toBe("not_in_deck");
    expect(validateCommand(game.state(), { type: "upgradeAbility", tick: 0, playerId: 1, ability: "bombard" })).toBe("not_in_deck");
    expect(validateCommand(game.state(), { type: "upgradeAbility", tick: 0, playerId: 1, ability: "overcharge" })).toBeNull();
  });

  it("without decks every player has every card", () => {
    const game = scenario({ seed: 1, gold: 1000 }).run(0);
    expect(game.player().deck.towers).toEqual(TOWER_KINDS);
    expect(validateCommand(game.state(), build(0, "mine"))).toBeNull();
  });

  it("a deck of the wrong size, with repeats, unknown cards, one attack type or the wrong number of abilities cannot play", () => {
    const bad: Deck[] = [
      { towers: ["archer", "mage", "hammer", "cannon"], abilities: ["bombard", "repair"] },
      { towers: ["archer", "archer", "mage", "hammer", "cannon"], abilities: ["bombard", "repair"] },
      { towers: ["archer", "mage", "hammer", "cannon", "laser" as never], abilities: ["bombard", "repair"] },
      { towers: ["archer", "frost", "wall", "aura", "radar"], abilities: ["bombard", "repair"] },
      { towers: [...coopDeck.towers], abilities: ["bombard", "repair", "frost"] },
      { towers: [...coopDeck.towers], abilities: ["bombard", "bombard"] },
    ];
    for (const deck of bad) {
      expect(() => createInitialState({ seed: 1, deckTowers: DECK.coopTowers, players: [{ id: 0, deck }] })).toThrow();
      const game = scenario({ seed: 1, deckTowers: DECK.coopTowers, decks: { 0: coopDeck } }).run(0);
      expect(validateCommand(game.state(), { type: "join", tick: 0, playerId: 1, deck })).toBe("bad_deck");
    }
    expect(() => createInitialState({ seed: 1, deckTowers: DECK.coopTowers, players: [{ id: 0 }] })).toThrow();
  });

  it("the default decks are valid for their mode", () => {
    expect(() =>
      createInitialState({ seed: 1, deckTowers: DECK.soloTowers, players: [{ id: 0, deck: DEFAULT_DECKS.solo }] }),
    ).not.toThrow();
    expect(() =>
      createInitialState({ seed: 1, deckTowers: DECK.coopTowers, players: [{ id: 0, deck: DEFAULT_DECKS.coop }] }),
    ).not.toThrow();
  });

  it("a late joiner plays with the deck they bring, and needs one", () => {
    const game = scenario({ seed: 1, deckTowers: DECK.coopTowers, decks: { 0: coopDeck } }).run(0);
    expect(validateCommand(game.state(), { type: "join", tick: 0, playerId: 1 })).toBe("bad_deck");
    game.join(1, otherDeck).run(1);
    expect(game.player(1).deck).toEqual(otherDeck);
  });

  it("team towers left behind can be upgraded by anyone, in their deck or not", () => {
    const game = twoPlayers().build("cannon", { x: 3, y: 3, player: 0 }).run(1).leave(0).run(1);
    const upgrade = { type: "upgrade" as const, tick: 0, playerId: 1, towerId: game.tower(0).id };
    expect(validateCommand(game.state(), upgrade)).toBeNull();
  });

  it("the reference bot only builds towers of its deck", () => {
    const game = scenario({ seed: 42, waves: true, bot: true, deckTowers: DECK.coopTowers, decks: { 0: coopDeck } }).run(4000);
    expect(game.towers().length).toBeGreaterThan(0);
    for (const tower of game.towers()) expect(coopDeck.towers).toContain(tower.kind);
  });

  it("the random bot only builds towers of its random deck", () => {
    const deck = randomDeck(3, DECK.coopTowers);
    const game = scenario({ seed: 42, waves: true, bot: "variant", deckTowers: DECK.coopTowers, decks: { 0: deck } }).run(4000);
    expect(game.towers().length).toBeGreaterThan(0);
    for (const tower of game.towers()) expect(deck.towers).toContain(tower.kind);
  });

  it("a random bot deck is always valid and fixed by its seed", () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const towers of [DECK.soloTowers, DECK.coopTowers]) expect(deckProblem(randomDeck(seed, towers), towers)).toBeNull();
    }
    expect(randomDeck(7, DECK.coopTowers)).toEqual(randomDeck(7, DECK.coopTowers));
  });
});
