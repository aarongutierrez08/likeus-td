/** Minimal `--flag value` / `--flag` parser for the dev scripts. */
export function parseArgs(argv: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) continue;
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out.set(arg.slice(2), next);
      i++;
    } else {
      out.set(arg.slice(2), "1");
    }
  }
  return out;
}

export function intArg(args: Map<string, string>, name: string, fallback: number): number {
  const raw = args.get(name);
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) throw new Error(`--${name} expects an integer, got "${raw}"`);
  return n;
}
