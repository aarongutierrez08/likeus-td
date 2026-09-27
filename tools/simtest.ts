import { hashState } from "@td/sim";
import { intArg, parseArgs } from "./args";
import { playGame } from "./play";

const args = parseArgs(process.argv.slice(2));
const seed = intArg(args, "seed", 42);
const final = playGame({ seed, mode: "trivial" });

const towers = final.towers.length;
const gold = final.players.map((p) => p.gold).join("+");
const result = final.status === "won" ? "WIN" : final.status === "lost" ? `LOSS at wave ${final.wave}` : `TIMEOUT at tick ${final.tick}`;
console.log(
  `${result} seed=${seed} tick=${final.tick} lives=${final.lives} gold=${gold} towers=${towers} kills=${final.stats.kills} leaks=${final.stats.leaks} hash=${hashState(final)}`,
);
process.exit(final.status === "won" ? 0 : 1);
