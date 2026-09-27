import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { dumpState, hashState, step, type Command, type GameState } from "@td/sim";
import type { BugReport } from "@td/server/protocol";
import { intArg, parseArgs } from "./args";

/**
 * Reads bug reports (local JSON files or GitHub issues labelled bug-report) and replays them.
 *   pnpm report list
 *   pnpm report show <n | path>
 *   pnpm report replay <n | path> [--tick T]
 */
const args = parseArgs(process.argv.slice(2));
const [command, target] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const reportsDir = resolve("tools/out/reports");

function gh(...argv: string[]): string {
  const result = spawnSync("gh", argv, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `gh ${argv.join(" ")} failed`);
  return result.stdout;
}

async function load(ref: string): Promise<BugReport> {
  if (/^\d+$/.test(ref)) {
    const body = gh("issue", "view", ref, "--json", "body", "--jq", ".body");
    const match = /```json\n([\s\S]*?)\n```/.exec(body);
    if (!match) throw new Error(`issue #${ref} has no bundle`);
    return JSON.parse(match[1]!) as BugReport;
  }
  return JSON.parse(await readFile(resolve(ref), "utf8")) as BugReport;
}

async function list(): Promise<void> {
  console.log("--- issues abiertos (bug-report):");
  try {
    console.log(gh("issue", "list", "--label", "bug-report", "--state", "open", "--limit", "20") || "(ninguno)");
  } catch (err) {
    console.log(`(gh no disponible: ${err instanceof Error ? err.message.trim() : String(err)})`);
  }
  console.log(`--- archivos locales en ${reportsDir}:`);
  const files = await readdir(reportsDir).catch(() => [] as string[]);
  console.log(files.length > 0 ? files.map((f) => `  ${f}`).join("\n") : "  (ninguno)");
}

function summary(report: BugReport): string {
  return [
    `motivo ${report.reason} · sala ${report.code} · seed ${report.seed} · balance v${report.balanceVersion} · commit ${report.commit} · ${report.at}`,
    `server tick ${report.serverTick} hash ${report.serverHash} · cliente tick ${report.clientTick ?? "-"} hash ${report.clientHash ?? "-"} · jugador ${report.reporter ?? "-"}`,
    `mensaje: ${report.message || "(sin mensaje)"}`,
    report.errors.length > 0 ? `errores:\n${report.errors.map((e) => `  ${e}`).join("\n")}` : "errores: ninguno",
    `historial: ${report.history.length} ticks con comandos${report.historyTruncated ? " (truncado)" : ""}`,
  ].join("\n");
}

function replayTo(report: BugReport, targetTick: number): GameState {
  if (!report.initialState) throw new Error("el reporte no trae estado inicial (partida en lobby)");
  let state = report.initialState;
  const byTick = new Map<number, Command[]>(report.history.map((h) => [h.tick, h.commands]));
  while (state.tick < targetTick && state.status === "playing") state = step(state, byTick.get(state.tick) ?? []);
  return state;
}

async function main(): Promise<void> {
  if (command === "list" || command === undefined) return list();
  if (!target) throw new Error("falta el número de issue o la ruta del archivo");
  const report = await load(target);
  console.log(summary(report));
  if (command === "show") {
    console.log("\n--- dump del server:\n" + report.serverDump);
    if (report.clientDump) console.log("\n--- dump del cliente:\n" + report.clientDump);
    return;
  }
  if (command === "replay") {
    const tick = intArg(args, "tick", report.clientTick ?? report.serverTick);
    const replayed = replayTo(report, tick);
    const hash = hashState(replayed);
    console.log(`\n--- replay hasta tick ${replayed.tick}: hash ${hash}`);
    if (replayed.tick === report.serverTick) console.log(`coincide con el server: ${hash === report.serverHash}`);
    if (report.clientTick !== null && replayed.tick === report.clientTick)
      console.log(`coincide con el cliente: ${hash === report.clientHash}`);
    console.log("\n" + dumpState(replayed));
    return;
  }
  throw new Error(`comando desconocido: ${command}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
