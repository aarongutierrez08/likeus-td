import { resolve } from "node:path";
import { chromium, type Locator, type Page } from "playwright";
import { createServer } from "vite";

/**
 * Plays the solo UI like a person, with the game running (not paused): build on a cell, select the tower,
 * upgrade twice choosing a branch, sell, build a wall on the path. A click that lands on a button recreated
 * each tick is lost, so every interaction here happens while ticks flow. Exit 1 on any failure.
 */
const root = resolve("packages/client");
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
const state = (page: Page) => page.evaluate(() => window.__td!.state());
/** A person holds the button for a moment; a row recreated in between loses the click. */
const HOLD_MS = 120;
/** The same DOM element must survive a few ticks, or clicks on it are a lottery. */
async function assertStable(page: Page, target: Locator, what: string): Promise<void> {
  const before = await target.elementHandle();
  await page.waitForTimeout(300);
  const after = await target.elementHandle();
  const same = before && after && (await page.evaluate(([a, b]) => a === b, [before, after] as const));
  if (!same) throw new Error(`${what} se recrea entre ticks: un clic humano se pierde`);
}

let failed = false;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  await page.goto(`${base}?seed=42&wave=4&gold=900&speed=1&bot=0`);
  await page.waitForFunction(() => document.documentElement.dataset["ready"] === "1", null, { timeout: 30000 });
  const box = (await (await page.$("#map canvas"))!.boundingBox())!;
  const cell = Math.min(box.width / 20, box.height / 12);
  const px = (x: number) => box.x + Math.floor((box.width - cell * 20) / 2) + cell * (x + 0.5);
  const py = (y: number) => box.y + Math.floor((box.height - cell * 12) / 2) + cell * (y + 0.5);
  const clickCell = async (x: number, y: number): Promise<void> => page.mouse.click(px(x), py(y));
  await page.waitForFunction(() => (window.__td?.state().tick ?? 0) > 5);
  done("partida en marcha");

  await clickCell(15, 3);
  await page.waitForFunction(() => window.__td!.state().towers.length === 1);
  done("torre construida con el primer botón de la tienda");

  await clickCell(15, 3);
  await page.waitForSelector(".tower-panel");
  await assertStable(page, page.getByRole("button", { name: "Mejorar" }), "el botón Mejorar");
  await page.getByRole("button", { name: "Mejorar" }).click({ delay: HOLD_MS });
  await page.waitForFunction(() => window.__td!.state().towers[0]?.level === 2);
  done("mejorada a nivel 2 desde el panel");

  const branchButtons = page.locator(".tower-panel button.inline").filter({ hasNotText: /Vender|Mejorar/ });
  await branchButtons.first().waitFor();
  await assertStable(page, branchButtons.first(), "el botón de rama");
  const chosen = (await branchButtons.first().innerText()).trim();
  await branchButtons.first().click({ delay: HOLD_MS });
  await page.waitForFunction(() => window.__td!.state().towers[0]?.level === 3 && window.__td!.state().towers[0]?.branch !== null);
  const label = (await page.locator(".tower-panel b").first().innerText()).trim();
  if (!label.startsWith(chosen)) throw new Error(`el panel dice "${label}", se eligió "${chosen}"`);
  done(`nivel 3 con rama "${chosen}"`);

  await page.getByRole("button", { name: /^Vender/ }).click({ delay: HOLD_MS });
  await page.waitForFunction(() => window.__td!.state().towers.length === 0);
  done("vendida desde el panel");

  await page.locator(".shop button").filter({ hasText: "Tranquera" }).click({ delay: HOLD_MS });
  await clickCell(5, 1);
  await page.waitForFunction(() => window.__td!.state().towers.length === 1);
  const wall = (await state(page)).towers[0]!;
  if (wall.x !== 5 || wall.y !== 1) throw new Error(`la tranquera quedó en (${wall.x},${wall.y})`);
  done("tranquera construida sobre el camino");

  await page
    .getByRole("button", { name: "Llamar oleada +1" })
    .click()
    .catch(() => undefined);
  await page.waitForFunction(() => (window.__td?.state().enemies.length ?? 0) > 0, null, { timeout: 30000 });
  await page.waitForFunction(
    () => {
      const t = window.__td!.state().towers[0];
      return t === undefined || t.hp < 300;
    },
    null,
    { timeout: 60000 },
  );
  done("los enemigos golpean la tranquera");
} catch (err) {
  failed = true;
  console.error(`FALLÓ tras ${steps.length} pasos: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await browser.close();
  await vite.close();
}
if (errors.length > 0) {
  failed = true;
  console.error(`errores de browser:\n${errors.join("\n")}`);
}
console.log(failed ? "uismoke: FAIL" : "uismoke: OK");
process.exit(failed ? 1 : 0);
