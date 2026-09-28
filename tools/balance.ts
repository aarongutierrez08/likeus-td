import {
  ARMORS,
  ARMOR_LABELS,
  ENEMIES,
  TICKS_PER_SECOND,
  TOWERS,
  TOWER_KINDS,
  WAVES,
  hasAttack,
  startingGold,
  type Armor,
  type GameState,
  type TowerKind,
} from "@td/sim";
import { intArg, parseArgs } from "./args";
import { playGame } from "./play";

/**
 * Balance report (.claude/rules/balance.md): games per (players, bot) with win rate, loss wave,
 * damage and purchase share per tower, then the calendar's hp per armor and each tower's damage per gold.
 * --bot informed (one deterministic game per seed), random (every run a variant bot) or both (default: run 0 informed).
 */
const args = parseArgs(process.argv.slice(2));
const runsPerSeed = intArg(args, "runs", 20);
const [seedFrom, seedTo] = parseSeedRange(args.get("seeds") ?? "1-10");
const players = intArg(args, "players", 1);
const bot = parseBot(args.get("bot") ?? "both");

type BotChoice = "informed" | "random" | "both";

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

function parseBot(text: string): BotChoice {
  if (text === "informed" || text === "random" || text === "both") return text;
  throw new Error(`--bot expects informed, random or both, got "${text}"`);
}

function zeroByKind(): Record<TowerKind, number> {
  return Object.fromEntries(TOWER_KINDS.map((kind) => [kind, 0])) as Record<TowerKind, number>;
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

function shareLine(counts: Record<TowerKind, number>): string {
  const total = TOWER_KINDS.reduce((sum, k) => sum + counts[k], 0);
  if (total === 0) return "-";
  return TOWER_KINDS.map((k) => `${k} ${Math.round((100 * counts[k]) / total)}%`).join(" · ");
}

function runsFor(choice: BotChoice): number {
  return choice === "informed" ? 1 : runsPerSeed;
}

function modeFor(choice: BotChoice, run: number): "trivial" | "variant" {
  if (choice === "random") return "variant";
  if (choice === "informed") return "trivial";
  return run === 0 ? "trivial" : "variant";
}

const runs = runsFor(bot);
const summaries: SeedSummary[] = [];
for (let seed = seedFrom; seed <= seedTo; seed++) {
  const summary: SeedSummary = { seed, wins: 0, lossWaves: [], goldLeft: [], towersBuilt: zeroByKind(), damage: zeroByKind() };
  for (let run = 0; run < runs; run++) record(summary, playGame({ seed, mode: modeFor(bot, run), botSeed: run, players }));
  summaries.push(summary);
}

console.log(`players: ${players}, bot: ${bot}, runs per seed: ${runs}, seeds ${seedFrom}-${seedTo}\n`);
console.log("| Seed | Wins | Loss wave (avg / min) | Gold left (avg) | Damage share |");
console.log("|---|---|---|---|---|");
for (const s of summaries) {
  const losses = s.lossWaves.length === 0 ? "WIN" : `${avg(s.lossWaves).toFixed(1)} / ${Math.min(...s.lossWaves)}`;
  console.log(`| ${s.seed} | ${s.wins}/${runs} | ${losses} | ${avg(s.goldLeft).toFixed(0)} | ${shareLine(s.damage)} |`);
}

const damageByKind = zeroByKind();
const builtByKind = zeroByKind();
const allLossWaves: number[] = [];
for (const s of summaries) {
  for (const k of TOWER_KINDS) {
    damageByKind[k] += s.damage[k];
    builtByKind[k] += s.towersBuilt[k];
  }
  allLossWaves.push(...s.lossWaves);
}
const totalWins = summaries.reduce((n, s) => n + s.wins, 0);
const totalRuns = summaries.length * runs;
console.log(`\nwin rate: ${totalWins}/${totalRuns} (${Math.round((100 * totalWins) / totalRuns)}%) over ${WAVES.length} waves`);
console.log(`loss wave (avg): ${allLossWaves.length === 0 ? "-" : avg(allLossWaves).toFixed(1)}`);
console.log(`damage share: ${shareLine(damageByKind)}`);
console.log(`purchase share: ${shareLine(builtByKind)}`);

console.log("\n| Tower | Cost | Damage/s | Damage/s per 100 gold |");
console.log("|---|---|---|---|");
for (const k of TOWER_KINDS) {
  const def = TOWERS[k];
  if (!hasAttack(def)) continue;
  const perSecond = (def.damage * TICKS_PER_SECOND) / def.cooldown;
  const area = def.splash > 0 ? " (area)" : "";
  console.log(`| ${k}${area} | ${def.cost} | ${perSecond.toFixed(1)} | ${((perSecond * 100) / def.cost).toFixed(1)} |`);
}
console.log(`\nstarting gold: solo ${startingGold(1)}, coop ${startingGold(2)}`);

const armorTotals: Record<Armor, number> = Object.fromEntries(ARMORS.map((a) => [a, 0])) as Record<Armor, number>;
console.log(`\n| Wave | Enemies | ${ARMORS.map((a) => ARMOR_LABELS[a]).join(" | ")} |`);
console.log(`|---|---|${ARMORS.map(() => "---").join("|")}|`);
WAVES.forEach((wave, i) => {
  const byArmor: Record<Armor, number> = Object.fromEntries(ARMORS.map((a) => [a, 0])) as Record<Armor, number>;
  let enemies = 0;
  for (const g of wave.groups) {
    const hp = Math.floor((ENEMIES[g.kind].hp * wave.hpPct) / 100) * g.count;
    byArmor[ENEMIES[g.kind].armor] += hp;
    armorTotals[ENEMIES[g.kind].armor] += hp;
    enemies += g.count;
  }
  const waveHp = ARMORS.reduce((sum, a) => sum + byArmor[a], 0);
  console.log(`| ${i + 1} | ${enemies} | ${ARMORS.map((a) => `${Math.round((100 * byArmor[a]) / waveHp)}%`).join(" | ")} |`);
});
const calendarHp = ARMORS.reduce((sum, a) => sum + armorTotals[a], 0);
console.log(`| total | | ${ARMORS.map((a) => `${Math.round((100 * armorTotals[a]) / calendarHp)}%`).join(" | ")} |`);
