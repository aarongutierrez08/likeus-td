import { TOWER_KINDS, WAVES, type GameState, type TowerKind } from "@td/sim";
import { intArg, parseArgs } from "./args";
import { playGame } from "./play";

const args = parseArgs(process.argv.slice(2));
const runsPerSeed = intArg(args, "runs", 20);
const [seedFrom, seedTo] = parseSeedRange(args.get("seeds") ?? "1-10");
const players = intArg(args, "players", 1);

interface SeedSummary {
  seed: number;
  wins: number;
  lossWaves: number[];
  goldLeft: number[];
  towersBuilt: Record<TowerKind, number>;
  damage: Record<TowerKind, number>;
}

function parseSeedRange(text: string): [number, number] {
  const m = /^(\d+)(?:-(\d+))?$/.exec(text);
  if (!m) throw new Error(`--seeds expects "a-b" or "a", got "${text}"`);
  const from = Number.parseInt(m[1]!, 10);
  const to = m[2] === undefined ? from : Number.parseInt(m[2], 10);
  return [from, to];
}

function zeroByKind(): Record<TowerKind, number> {
  return { archer: 0, cannon: 0, aura: 0, mine: 0 };
}

function record(summary: SeedSummary, final: GameState): void {
  if (final.status === "won") summary.wins++;
  else summary.lossWaves.push(final.wave);
  summary.goldLeft.push(final.players.reduce((sum, p) => sum + p.gold, 0));
  for (const t of final.towers) summary.towersBuilt[t.kind]++;
  for (const k of TOWER_KINDS) summary.damage[k] += final.stats.damageByTower[k];
}

function avg(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

function extremeKind(counts: Record<TowerKind, number>, pick: "max" | "min"): string {
  const sorted = [...TOWER_KINDS].sort((a, b) => counts[a] - counts[b]);
  const kind = pick === "max" ? sorted[sorted.length - 1]! : sorted[0]!;
  return `${kind} (${counts[kind]})`;
}

const summaries: SeedSummary[] = [];
for (let seed = seedFrom; seed <= seedTo; seed++) {
  const summary: SeedSummary = { seed, wins: 0, lossWaves: [], goldLeft: [], towersBuilt: zeroByKind(), damage: zeroByKind() };
  for (let run = 0; run < runsPerSeed; run++) {
    record(summary, playGame({ seed, mode: run === 0 ? "trivial" : "variant", botSeed: run, players }));
  }
  summaries.push(summary);
}

console.log(`players: ${players}, runs per seed: ${runsPerSeed} (run 0 = trivial bots, rest = variant bots)\n`);
console.log("| Seed | Wins | Loss wave (avg / min) | Gold left (avg) | Most built | Least built | Top damage share |");
console.log("|---|---|---|---|---|---|---|");
for (const s of summaries) {
  const losses = s.lossWaves.length === 0 ? "WIN" : `${avg(s.lossWaves).toFixed(1)} / ${Math.min(...s.lossWaves)}`;
  const totalDamage = TOWER_KINDS.reduce((n, k) => n + s.damage[k], 0);
  const topKind = [...TOWER_KINDS].sort((a, b) => s.damage[b] - s.damage[a])[0]!;
  const share = totalDamage === 0 ? 0 : Math.round((100 * s.damage[topKind]) / totalDamage);
  console.log(
    `| ${s.seed} | ${s.wins}/${runsPerSeed} | ${losses} | ${avg(s.goldLeft).toFixed(0)} | ${extremeKind(s.towersBuilt, "max")} | ${extremeKind(s.towersBuilt, "min")} | ${topKind} ${share}% |`,
  );
}
const totalWins = summaries.reduce((n, s) => n + s.wins, 0);
const totalRuns = summaries.length * runsPerSeed;
console.log(`\nwin rate: ${totalWins}/${totalRuns} (${Math.round((100 * totalWins) / totalRuns)}%) over ${WAVES.length} waves`);
