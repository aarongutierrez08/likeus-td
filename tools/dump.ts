import { createInitialState, dumpState, step } from "@td/sim";
import { intArg, parseArgs } from "./args";
import { playGame } from "./play";

const args = parseArgs(process.argv.slice(2));
const seed = intArg(args, "seed", 42);
const tick = intArg(args, "tick", 900);
const useBot = intArg(args, "bot", 1) !== 0;
const mapId = args.get("map");

let state;
if (useBot) {
  state = playGame({ seed, mode: "trivial", mapId, untilTick: tick });
} else {
  state = createInitialState({ seed, mapId });
  while (state.status === "playing" && state.tick < tick) state = step(state);
}
console.log(dumpState(state));
