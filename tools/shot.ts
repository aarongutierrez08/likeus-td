import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import { intArg, parseArgs } from "./args";

const args = parseArgs(process.argv.slice(2));
const seed = intArg(args, "seed", 42);
const tick = intArg(args, "tick", 900);
const useBot = intArg(args, "bot", 1) !== 0;
const width = intArg(args, "width", 1280);
const height = intArg(args, "height", 800);
/** Extra query string appended verbatim, e.g. --params "tower=cannon&dump=1". */
const extraParams = args.get("params") ?? "";

const toolsDir = dirname(fileURLToPath(import.meta.url));
const clientRoot = resolve(toolsDir, "../packages/client");
const outDir = resolve(toolsDir, "out");
const suffix = args.get("out") ?? `seed${seed}-tick${tick}`;
const outFile = resolve(outDir, `${suffix}.png`);

const server = await createServer({
  root: clientRoot,
  configFile: resolve(clientRoot, "vite.config.ts"),
  logLevel: "error",
  server: { port: 0, host: "127.0.0.1", strictPort: false },
});
await server.listen();
const baseUrl = server.resolvedUrls?.local[0];
if (!baseUrl) throw new Error("vite did not report a local URL");

const query = new URLSearchParams({ seed: String(seed), tick: String(tick), speed: "0", bot: useBot ? "1" : "0" });
const url = `${baseUrl}?${query.toString()}${extraParams ? `&${extraParams}` : ""}`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    // The shot runs without the accounts server: the client then plays as before, so its refused requests are expected.
    if (msg.type() === "error" && !msg.text().includes("ERR_CONNECTION_REFUSED")) errors.push(msg.text());
  });
  await page.goto(url);
  await page.waitForFunction(() => document.documentElement.dataset["ready"] === "1", null, { timeout: 30000 });
  await page.waitForTimeout(100);
  await mkdir(outDir, { recursive: true });
  await page.screenshot({ path: outFile });
  const reached = await page.evaluate(() => ({ tick: window.__td?.state().tick, hash: window.__td?.hash() }));
  console.log(`${outFile}  (url ${url}, tick ${reached.tick}, hash ${reached.hash})`);
  if (errors.length > 0) {
    console.error(`browser errors:\n${errors.join("\n")}`);
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  await server.close();
}
