import { describe, expect, it } from "vitest";
import { PLAYER_COLORS, createInitialState, step, validateCommand } from "../src/index";
import { scenario } from "./helpers/scenario";

describe("player colors", () => {
  it("initial players get distinct colors in id order, honouring a requested free one", () => {
    const state = createInitialState({ seed: 1, players: [{ id: 0 }, { id: 1, color: 5 }, { id: 2 }] });
    expect(state.players.map((p) => p.color)).toEqual([0, 5, 1]);
    const clash = createInitialState({
      seed: 1,
      players: [
        { id: 0, color: 3 },
        { id: 1, color: 3 },
      ],
    });
    expect(clash.players.map((p) => p.color)).toEqual([3, 0]);
  });

  it("a joining player takes the first free color, and a leaver frees theirs", () => {
    const game = scenario({ seed: 1, players: [0, 1] })
      .join(2)
      .run(1);
    expect(game.state().players.map((p) => p.color)).toEqual([0, 1, 2]);
    game.leave(1).run(1).join(3).run(1);
    expect(game.state().players.find((p) => p.id === 3)?.color).toBe(1);
  });

  it("a player may switch to a free color but not to a taken or unknown one", () => {
    const game = scenario({ seed: 1, players: [0, 1] }).run(0);
    const to = (color: number) => ({ type: "setColor" as const, tick: 0, playerId: 0, color });
    expect(validateCommand(game.state(), to(1))).toBe("color_taken");
    expect(validateCommand(game.state(), to(PLAYER_COLORS.length))).toBe("bad_color");
    expect(validateCommand(game.state(), to(7))).toBeNull();
    const after = step(game.state(), [to(7)]);
    expect(after.players[0]!.color).toBe(7);
  });
});
