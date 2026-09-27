import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { BugReport } from "./protocol";

/** GitHub issue bodies cap at 65536 chars; keep room for the summary. */
const MAX_BODY_CHARS = 60_000;
export const REPORT_LABEL = "bug-report";
/** Process-wide cap so a spammer with many tabs cannot flood the issue tracker. */
const GLOBAL_WINDOW_MS = 10 * 60_000;
const GLOBAL_MAX_PER_WINDOW = 10;
const filedAt: number[] = [];

export function globalReportAllowed(now = Date.now()): boolean {
  while (filedAt.length > 0 && now - filedAt[0]! > GLOBAL_WINDOW_MS) filedAt.shift();
  if (filedAt.length >= GLOBAL_MAX_PER_WINDOW) return false;
  filedAt.push(now);
  return true;
}

export interface ReportSink {
  file(report: BugReport): Promise<string>;
}

export interface ReportSinkOptions {
  githubToken?: string | undefined;
  githubRepo?: string | undefined;
  reportsDir?: string | undefined;
}

export function createReportSink(opts: ReportSinkOptions): ReportSink {
  if (opts.githubToken && opts.githubRepo) return githubSink(opts.githubToken, opts.githubRepo);
  return fileSink(opts.reportsDir ?? resolve(process.cwd(), "../../tools/out/reports"));
}

function fileSink(dir: string): ReportSink {
  return {
    async file(report) {
      await mkdir(dir, { recursive: true });
      const stamp = report.at.replace(/[:.]/g, "-");
      const path = resolve(dir, `report-${stamp}-${report.code}-${report.reason}.json`);
      await writeFile(path, JSON.stringify(report, null, 2));
      return path;
    },
  };
}

function githubSink(token: string, repo: string): ReportSink {
  return {
    async file(report) {
      const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "likeus-td-server",
        },
        body: JSON.stringify({ title: issueTitle(report), body: issueBody(report), labels: [REPORT_LABEL] }),
      });
      if (!response.ok) throw new Error(`GitHub issue failed: ${response.status} ${await response.text()}`);
      const issue = (await response.json()) as { number: number; html_url: string };
      return issue.html_url;
    },
  };
}

export function issueTitle(report: BugReport): string {
  const head = report.message.split("\n")[0]?.slice(0, 60) || report.reason;
  return `[${report.reason}] ${report.code} · ${head}`;
}

/** Summary first, then the JSON bundle in a collapsible block; history trimmed to fit the cap. */
export function issueBody(report: BugReport): string {
  const summary = [
    `**Motivo:** ${report.reason}`,
    `**Sala:** ${report.code} · seed ${report.seed} · balance v${report.balanceVersion} · commit ${report.commit}`,
    `**Server:** tick ${report.serverTick} hash ${report.serverHash}`,
    `**Cliente:** tick ${report.clientTick ?? "-"} hash ${report.clientHash ?? "-"} · jugador ${report.reporter ?? "-"}`,
    `**Mensaje:** ${report.message || "(sin mensaje)"}`,
    report.errors.length > 0 ? `**Errores:**\n${report.errors.map((e) => `- ${e}`).join("\n")}` : "",
    "",
    `Reproducir: \`pnpm report replay <número de este issue>\``,
  ]
    .filter((line) => line !== undefined)
    .join("\n");
  let bundle = { ...report };
  let json = JSON.stringify(bundle);
  while (json.length > MAX_BODY_CHARS && bundle.history.length > 0) {
    bundle = { ...bundle, history: bundle.history.slice(Math.ceil(bundle.history.length / 2)), historyTruncated: true };
    json = JSON.stringify(bundle);
  }
  return `${summary}\n\n<details><summary>bundle</summary>\n\n\`\`\`json\n${json}\n\`\`\`\n</details>`;
}

/** Extracts the bundle from an issue body written by issueBody(). */
export function parseIssueBody(body: string): BugReport {
  const match = /```json\n([\s\S]*?)\n```/.exec(body);
  if (!match) throw new Error("no bundle found in issue body");
  return JSON.parse(match[1]!) as BugReport;
}
