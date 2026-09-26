import { render } from "solid-js/web";
import { Show, createEffect } from "solid-js";
import { createBot, createInitialState, hashState, validateBuild, type GameState, type MapId, type RejectReason } from "@td/sim";
import { GameRunner } from "./game/runner";
import { createGameStore } from "./game/store";
import { parseUrlParams } from "./params";
import { createRenderer } from "./render/app";
import { DebugPanel } from "./ui/DebugPanel";
import { Dump } from "./ui/Dump";
import { Hud } from "./ui/Hud";
import { Shop } from "./ui/Shop";
import "./styles.css";

interface DebugHandle {
  runner: GameRunner;
  state: () => GameState;
  hash: () => string;
  ready: boolean;
}

declare global {
  interface Window {
    __td?: DebugHandle;
  }
}

const REJECT_MESSAGES: Record<RejectReason, string> = {
  outside: "Fuera del mapa",
  on_path: "No se puede construir sobre el camino",
  occupied: "Celda ocupada",
  no_gold: "Oro insuficiente",
  unknown_tower: "Torre desconocida",
};

async function main(): Promise<void> {
  const params = parseUrlParams(location.search);
  const initial = createInitialState({ seed: params.seed, mapId: params.map, gold: params.gold, startWave: params.wave });
  const store = createGameStore(initial);
  const runner = new GameRunner(initial, {
    speed: params.speed,
    bot: params.bot ? createBot("trivial") : undefined,
    onState: store.setState,
  });
  window.__td = { runner, state: store.state, hash: () => hashState(store.state()), ready: false };

  const mapEl = document.getElementById("map")!;
  const hudEl = document.getElementById("hud")!;

  let noticeTimer = 0;
  const notify = (msg: string): void => {
    store.setNotice(msg);
    clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => store.setNotice(null), 1500);
  };

  const renderer = await createRenderer(mapEl, {
    mapId: initial.mapId as MapId,
    onCellTap: (cell) => {
      const tower = store.selectedTower();
      if (!tower) return;
      const cmd = { type: "build" as const, tick: runner.state.tick, playerId: 0, tower, x: cell.x, y: cell.y };
      const reason = validateBuild(runner.state, cmd);
      if (reason) {
        notify(REJECT_MESSAGES[reason]);
        return;
      }
      runner.enqueue(cmd);
      if (runner.paused || runner.speed === 0) runner.stepAndPublish();
    },
  });

  createEffect(() => renderer.setHoverTower(store.selectedTower()));
  createEffect(() => {
    renderer.sync(store.state(), store.showRanges());
    document.documentElement.dataset["tick"] = String(store.state().tick);
  });

  const actions = {
    togglePause: () => {
      runner.paused = !runner.paused;
      store.setPaused(runner.paused);
    },
    stepOnce: () => runner.stepAndPublish(),
  };
  window.addEventListener("keydown", (e) => {
    if (e.code === "Backquote" || e.key === "~" || e.key === "`") {
      e.preventDefault();
      store.setDebugOpen(!store.debugOpen());
    } else if (e.key === " " && store.debugOpen()) {
      e.preventDefault();
      actions.togglePause();
    } else if (e.key === "." && store.debugOpen()) {
      actions.stepOnce();
    }
  });

  render(
    () => (
      <>
        <Hud store={store} />
        <Shop store={store} />
        <Show when={store.debugOpen()}>
          <DebugPanel store={store} actions={actions} />
        </Show>
        <Show when={params.dump}>
          <Dump store={store} />
        </Show>
      </>
    ),
    hudEl,
  );

  if (params.tick > 0) runner.fastForward(params.tick);
  if (params.speed === 0) {
    runner.paused = true;
    store.setPaused(true);
  }
  runner.start();
  requestAnimationFrame(() => {
    window.__td!.ready = true;
    document.documentElement.dataset["ready"] = "1";
  });
}

void main();
