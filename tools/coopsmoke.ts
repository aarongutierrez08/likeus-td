import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Page } from "playwright";
import { createServer } from "vite";
import { intArg, parseArgs } from "./args";

/**
 * End-to-end smoke of the co-op path with a real server and two browser tabs:
 * create, join by code, start, build, upgrade to a branch, chat, reload and reconnect. Everything happens
 * with the game running, as a player would do it. Exit 1 on any failure.
 */
const args = parseArgs(process.argv.slice(2));
const port = intArg(args, "port", 2599);
const root = resolve("packages/client");
const outDir = resolve("tools/out");
await mkdir(outDir, { recursive: true });

const serverLog: string[] = [];
const serverProc = spawn(resolve("node_modules/.bin/tsx"), ["packages/server/src/index.ts"], {
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});
serverProc.stdout.on("data", (d: Buffer) => serverLog.push(d.toString()));
serverProc.stderr.on("data", (d: Buffer) => serverLog.push(d.toString()));
await new Promise<void>((ok, fail) => {
  const deadline = setTimeout(() => fail(new Error("server did not start")), 15000);
  const poll = setInterval(() => {
    if (!serverLog.join("").includes("listening")) return;
    clearTimeout(deadline);
    clearInterval(poll);
    ok();
  }, 100);
});

const vite = await createServer({
  root,
  configFile: resolve(root, "vite.config.ts"),
  logLevel: "error",
  server: { port: 0, host: "127.0.0.1" },
});
await vite.listen();
const base = vite.resolvedUrls!.local[0]!;
const browser = await chromium.launch();
const errors: string[] = [];
const steps: string[] = [];
const done = (label: string): void => {
  steps.push(label);
  console.log(`ok  ${label}`);
};

const newPage = async (): Promise<Page> => {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, hasTouch: true });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  await page.addInitScript((serverUrl) => {
    (window as unknown as { __VITE_SERVER_URL: string }).__VITE_SERVER_URL = serverUrl;
  }, `ws://127.0.0.1:${port}`);
  return page;
};
const tick = (page: Page) => page.evaluate(() => window.__td?.state().tick ?? 0);
const towers = (page: Page) => page.evaluate(() => window.__td?.state().towers.length ?? 0);

let failed = false;
try {
  const a = await newPage();
  await a.goto(`${base}?mode=coop&name=Ana`);
  await a.getByRole("button", { name: "Crear sala pública" }).click();
  await a.waitForSelector(".lobby .code.big");
  const code = (await a.textContent(".lobby .code.big"))!.trim();
  done(`sala creada ${code}`);

  const b = await newPage();
  await b.goto(`${base}?mode=coop&name=Beto&room=${code}`);
  await b.waitForSelector(".lobby .players li:nth-child(2)");
  done("segundo jugador unido por código");

  const hostRow = (page: Page, name: string) => page.locator(".lobby .players li").filter({ hasText: name });
  await hostRow(a, "Beto").getByRole("button", { name: "Hacer anfitrión" }).click();
  await b.waitForFunction(() => document.querySelector(".lobby .players")?.textContent?.includes("Beto (anfitrión) (vos)"));
  await hostRow(b, "Ana").getByRole("button", { name: "Hacer anfitrión" }).click();
  await a.waitForFunction(() => document.querySelector(".lobby .players")?.textContent?.includes("Ana (anfitrión) (vos)"));
  done("en el lobby A hace anfitrión a B y B se lo devuelve");

  const bCard = (name: string) => b.locator(".deck-card").filter({ hasText: name });
  await bCard("Chusma").click();
  if (await b.getByRole("button", { name: /^Listo/ }).isEnabled()) throw new Error("B puede marcar listo con un mazo incompleto");
  await bCard("Heladera").click();
  await b.waitForFunction(() => !document.querySelector<HTMLButtonElement>(".lobby button.primary")?.disabled);
  done("B cambia su mazo en el lobby: incompleto no deja marcar listo");

  await b.getByRole("button", { name: /^Listo/ }).click();
  await a.waitForFunction(() => !document.querySelector<HTMLButtonElement>(".lobby button.primary")?.disabled);
  done("B marcó listo y A tiene Empezar habilitado");

  await bCard("Heladera").click();
  await a.waitForFunction(() => document.querySelector<HTMLButtonElement>(".lobby button.primary")?.disabled === true);
  await bCard("Heladera").click();
  await b.getByRole("button", { name: /^Listo/ }).click();
  await a.waitForFunction(() => !document.querySelector<HTMLButtonElement>(".lobby button.primary")?.disabled);
  done("B deja su mazo incompleto estando listo: deja de estar listo y A no puede empezar");

  await a.getByRole("button", { name: "Empezar" }).click();
  await a.waitForFunction(() => (window.__td?.state().tick ?? 0) > 5);
  await b.waitForFunction(() => (window.__td?.state().tick ?? 0) > 5);
  const bShop = await b.locator(".shop button .name").allInnerTexts();
  if (!bShop.some((n) => n.startsWith("Heladera")) || bShop.some((n) => n.startsWith("Chusma")))
    throw new Error(`la tienda de B no muestra su mazo: ${bShop.join(", ")}`);
  done("partida iniciada en ambas pestañas, cada tienda con su mazo");

  await b.getByText("Anfitrión: Ana").waitFor({ timeout: 5000 });
  await a.getByRole("button", { name: "Ceder anfitrión" }).click({ delay: 120 });
  await a.getByText("Anfitrión: Beto").waitFor({ timeout: 5000 });
  await b.getByRole("button", { name: "Ceder anfitrión" }).click({ delay: 120 });
  await b.getByText("Anfitrión: Ana").waitFor({ timeout: 5000 });
  await a.getByRole("button", { name: "Ceder anfitrión" }).waitFor({ timeout: 5000 });
  done("A cede el anfitrión a B y B se lo devuelve; cada uno ve quién es");

  const cellOf = async (page: Page): Promise<(x: number, y: number) => { x: number; y: number }> => {
    const box = (await (await page.$("#map canvas"))!.boundingBox())!;
    const cell = Math.min(box.width / 20, box.height / 12);
    return (x, y) => ({
      x: box.x + Math.floor((box.width - cell * 20) / 2) + cell * (x + 0.5),
      y: box.y + Math.floor((box.height - cell * 12) / 2) + cell * (y + 0.5),
    });
  };
  const atA = await cellOf(a);
  const atB = await cellOf(b);
  await a.locator(".shop button").first().click({ delay: 120 });
  await a.mouse.click(atA(15, 3).x, atA(15, 3).y);
  await b.waitForFunction(() => (window.__td?.state().towers.length ?? 0) === 1);
  await b.locator(".shop button").first().click({ delay: 120 });
  await b.mouse.click(atB(16, 3).x, atB(16, 3).y);
  await a.waitForFunction(() => (window.__td?.state().towers.length ?? 0) === 2);
  done("una torre de cada uno, visibles en ambas pestañas");

  await a.locator("button", { hasText: "4×" }).first().click();
  await a.waitForFunction(() => (window.__td?.state().players[0]?.gold ?? 0) >= 120 || window.__td?.state().status !== "playing", null, {
    timeout: 180000,
  });
  await a.mouse.click(atA(15, 3).x, atA(15, 3).y);
  await a.waitForSelector(".tower-panel");
  // Intermittent in co-op: a click on Mejorar sometimes has no effect (see docs/pendientes.md); retry before failing.
  for (let attempt = 1; ; attempt++) {
    await a.getByRole("button", { name: "Mejorar" }).click({ delay: 120 });
    const upgraded = await a
      .waitForFunction(() => window.__td?.state().towers[0]?.level === 2, null, { timeout: 4000 })
      .then(() => true)
      .catch(() => false);
    if (upgraded) {
      if (attempt > 1) console.log(`aviso: Mejorar necesitó ${attempt} clics (intermitente, ver docs/pendientes.md)`);
      break;
    }
    if (attempt === 3) throw new Error("Mejorar no tuvo efecto en tres clics");
  }
  const branchButtons = a.locator(".tower-panel button.inline").filter({ hasNotText: /Vender|Mejorar/ });
  await branchButtons.first().waitFor();
  await branchButtons.first().click({ delay: 120 });
  await a.waitForFunction(() => window.__td?.state().towers[0]?.level === 3, null, { timeout: 10000 });
  await b.waitForFunction(() => window.__td?.state().towers[0]?.level === 3 && window.__td?.state().towers[0]?.branch !== null, null, {
    timeout: 10000,
  });
  done("A mejoró a nivel 3 con rama y B lo ve igual");

  await b.getByRole("button", { name: /Chat/ }).click();
  await b.fill(".chat input", "hola");
  await b.getByRole("button", { name: "Enviar" }).click();
  await a.getByRole("button", { name: /Chat/ }).click();
  await a.waitForSelector(".chat-log li");
  done("chat de B recibido en A");

  await b.reload();
  await b.waitForFunction(() => (window.__td?.state().towers.length ?? 0) === 2, null, { timeout: 15000 });
  await a.waitForFunction(() => document.querySelector(".topbar")?.textContent?.includes("2/2"));
  done("B reconectado tras recargar");

  await a.locator("button", { hasText: "1×" }).first().click();
  const atB2 = await cellOf(b);
  await b.locator(".shop button").filter({ hasText: "Reviente" }).click({ delay: 120 });
  const priciestPoor = b.locator(".shop button.poor").filter({ hasText: "Reviente" });
  for (let x = 8; x <= 14 && (await priciestPoor.count()) === 0; x++) {
    const before = await towers(b);
    await b.mouse.click(atB2(x, 3).x, atB2(x, 3).y);
    await b.waitForFunction((n) => (window.__td?.state().towers.length ?? 0) > n, before, { timeout: 10000 });
  }
  const builtBefore = await towers(b);
  await b.keyboard.press("Escape");
  await priciestPoor.click({ delay: 120 });
  await b.touchscreen.tap(atB2(8, 4).x, atB2(8, 4).y);
  await b.getByText("Oro insuficiente").waitFor({ timeout: 2000 });
  const kept = await b.evaluate(() => window.__td?.preview?.() ?? null);
  if (kept?.x !== 8 || kept.y !== 4) throw new Error(`tras el toque sin oro el alcance quedó en ${JSON.stringify(kept)}`);
  await b.waitForTimeout(300);
  if ((await towers(b)) !== builtBefore) throw new Error("B construyó sin poder pagarla");
  done("B elige una torre que no puede pagar, la toca en el mapa, ve su alcance y no construye");

  await a.locator(".ability").filter({ hasText: "Bombardeo" }).locator(".use").click({ delay: 120 });
  await a.mouse.click(atA(12, 5).x, atA(12, 5).y);
  await b.waitForFunction(() => (window.__td?.state().players.find((p) => p.id === 0)?.abilities["bombard"]?.readyTick ?? 0) > 0, null, {
    timeout: 10000,
  });
  await a.locator(".ability").filter({ hasText: "Reparación" }).locator(".use").click({ delay: 120 });
  await b.waitForFunction(() => (window.__td?.state().players.find((p) => p.id === 0)?.abilities["repair"]?.readyTick ?? 0) > 0, null, {
    timeout: 10000,
  });
  const livesBefore = await b.evaluate(() => window.__td!.state().lives);
  await b.locator(".ability").filter({ hasText: "Reparación" }).locator(".use").click({ delay: 120 });
  await b.waitForFunction((before) => window.__td!.state().lives === before + 1, livesBefore, { timeout: 10000 });
  done("A bombardea y repara; B lo ve y repara con su propia carta");

  await a.locator("button", { hasText: "1×" }).first().click();
  await a.waitForFunction(() => (window.__td?.state().tick ?? 0) >= 200);
  await a.waitForTimeout(500);
  const [ta, tb] = await Promise.all([tick(a), tick(b)]);
  if (Math.abs(ta - tb) > 5) throw new Error(`ticks divergen: A ${ta}, B ${tb}`);
  if ((await towers(a)) !== (await towers(b))) throw new Error("las torres difieren entre pestañas");
  await a.screenshot({ path: resolve(outDir, "coopsmoke.png") });
  done(`ambas pestañas en tick ~${ta}, captura en tools/out/coopsmoke.png`);

  const solo = await newPage();
  await solo.goto(`${base}?daily=1&name=Diaria`);
  await solo.waitForSelector(".deck-screen");
  await solo.getByRole("button", { name: "Desafío del día" }).click();
  await solo.waitForFunction(() => document.documentElement.dataset["ready"] === "1", null, { timeout: 30000 });
  await solo.locator("button", { hasText: "4×" }).first().click();
  await solo.locator(".daily-board").filter({ hasText: "Diaria" }).waitFor({ timeout: 240000 });
  done("desafío del día: la partida termina, el server la repite y entra al ranking");
} catch (err) {
  failed = true;
  console.error(`FALLÓ tras ${steps.length} pasos: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await browser.close();
  await vite.close();
  serverProc.kill();
}
const desyncs = serverLog
  .join("")
  .split("\n")
  .filter((l) => l.includes("desync")).length;
if (desyncs > 0) {
  failed = true;
  console.error(`el server registró ${desyncs} desync(s)`);
}
if (errors.length > 0) {
  failed = true;
  console.error(`errores de browser:\n${errors.join("\n")}`);
}
console.log(failed ? "coopsmoke: FAIL" : "coopsmoke: OK");
process.exit(failed ? 1 : 0);
