import { render } from "solid-js/web";
import { Show, createEffect, createRoot, createSignal } from "solid-js";
import { ECONOMY, createBot, createInitialState, hashState, validateBuild, validateCommand, type Command, type GameState, type MapId, type TowerKind } from "@td/sim";
import type { CommandReject, SnapshotMessage } from "@td/server/protocol";
import { GameRunner } from "./game/runner";
import { createGameStore, type GameStore } from "./game/store";
import { Connection, type RoomHandlers } from "./net/connection";
import { createNetStore, type NetStore } from "./net/store";
import { parseUrlParams, type UrlParams } from "./params";
import { createRenderer, type Renderer } from "./render/app";
import { Chat } from "./ui/Chat";
import { DebugPanel, type DebugActions } from "./ui/DebugPanel";
import { Dump } from "./ui/Dump";
import { Hud, type EconomyActions } from "./ui/Hud";
import { Lobby, type LobbyActions } from "./ui/Lobby";
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

const REJECT_MESSAGES: Record<CommandReject, string> = {
  outside: "Fuera del mapa",
  on_path: "No se puede construir sobre el camino",
  occupied: "Celda ocupada",
  no_gold: "Oro insuficiente",
  unknown_tower: "Torre desconocida",
  no_player: "Todavía no estás en la partida",
  wave_not_pending: "No hay oleada pendiente",
  already_called: "Ya pediste esta oleada",
  gift_too_early: `Los regalos se habilitan en la oleada ${ECONOMY.giftFromWave}`,
  bad_amount: "Cantidad inválida",
  no_tower: "Esa torre ya no existe",
  not_owner: "Esa torre no es tuya",
  wave_in_progress: "Todavía quedan enemigos de esta oleada",
  rate_limited: "Demasiado rápido, esperá un momento",
  not_playing: "La partida todavía no empezó",
  bad_shape: "Comando inválido",
};

const NOTICE_MS = 1500;
const DEFAULT_TOWER: TowerKind = "archer";

interface Game {
  store: GameStore;
  runner: GameRunner;
}

const mapEl = document.getElementById("map")!;
const hudEl = document.getElementById("hud")!;

function markReady(): void {
  requestAnimationFrame(() => {
    if (window.__td) window.__td.ready = true;
    document.documentElement.dataset["ready"] = "1";
  });
}

function exposeForTools(game: Game): void {
  window.__td = { runner: game.runner, state: game.store.state, hash: () => hashState(game.store.state()), ready: false };
}

function makeNotifier(game: Game): (msg: string) => void {
  let timer = 0;
  return (msg) => {
    game.store.setNotice(msg);
    clearTimeout(timer);
    timer = window.setTimeout(() => game.store.setNotice(null), NOTICE_MS);
  };
}

/** Tapping a tower selects it (so it can be sold); tapping elsewhere clears the selection. Returns true when a tower was selected. */
function selectTowerAt(game: Game, cell: { x: number; y: number }): boolean {
  const tower = game.store.state().towers.find((t) => t.x === cell.x && t.y === cell.y);
  game.store.setSelectedTowerId(tower?.id ?? null);
  return tower !== undefined;
}

/** Keeps the Pixi scene in sync with the store; a root so the effects have an owner. */
function bindRenderer(renderer: Renderer, game: Game): void {
  createRoot(() => {
    createEffect(() => renderer.setHoverTower(game.store.selectedTower()));
    createEffect(() => {
      const tower = game.store.selectedOwnTower();
      renderer.setSelectedCell(tower ? { x: tower.x, y: tower.y } : null);
    });
    createEffect(() => {
      renderer.sync(game.store.state(), game.store.showRanges());
      document.documentElement.dataset["tick"] = String(game.store.state().tick);
    });
  });
}

function debugActions(game: Game): DebugActions {
  return {
    togglePause: () => {
      if (game.runner.remote) return;
      game.runner.paused = !game.runner.paused;
      game.store.setPaused(game.runner.paused);
    },
    stepOnce: () => {
      if (!game.runner.remote) game.runner.stepAndPublish();
    },
  };
}

function bindKeyboard(getGame: () => Game | null): void {
  window.addEventListener("keydown", (e) => {
    const game = getGame();
    if (!game) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
    if (e.code === "Backquote" || e.key === "~" || e.key === "`") {
      e.preventDefault();
      game.store.setDebugOpen(!game.store.debugOpen());
    } else if (e.key === " " && game.store.debugOpen()) {
      e.preventDefault();
      debugActions(game).togglePause();
    } else if (e.key === "." && game.store.debugOpen()) {
      debugActions(game).stepOnce();
    }
  });
}

function GameView(props: { game: Game; net?: NetStore; dump: boolean; sendChat?: (text: string) => void; economy: EconomyActions }) {
  const actions = debugActions(props.game);
  return (
    <>
      <Hud store={props.game.store} net={props.net} economy={props.economy} />
      <Shop store={props.game.store} />
      <Show when={props.net && props.sendChat}>
        <Chat net={props.net!} send={props.sendChat!} />
      </Show>
      <Show when={props.game.store.debugOpen()}>
        <DebugPanel store={props.game.store} actions={actions} remote={props.game.runner.remote} />
      </Show>
      <Show when={props.dump}>
        <Dump store={props.game.store} />
      </Show>
    </>
  );
}

async function bootSolo(params: UrlParams): Promise<void> {
  const initial = createInitialState({
    seed: params.seed,
    mapId: params.map,
    gold: params.gold,
    startWave: params.wave,
    ranked: !params.usesDevParams,
  });
  const store = createGameStore(initial, params.tower ?? DEFAULT_TOWER, 0);
  const runner = new GameRunner(initial, {
    speed: params.speed,
    bot: params.bot ? createBot("trivial") : undefined,
    onState: store.setState,
  });
  const game: Game = { store, runner };
  exposeForTools(game);
  const notify = makeNotifier(game);

  const renderer = await createRenderer(mapEl, {
    mapId: initial.mapId as MapId,
    onCellTap: (cell) => {
      if (selectTowerAt(game, cell)) return;
      const tower = store.selectedTower();
      if (!tower) return;
      const cmd = { type: "build" as const, tick: runner.state.tick, playerId: 0, tower, x: cell.x, y: cell.y };
      const reason = validateBuild(runner.state, cmd);
      if (reason) return notify(REJECT_MESSAGES[reason]);
      runner.enqueue(cmd);
      if (runner.paused || runner.speed === 0) runner.stepAndPublish();
    },
  });
  bindRenderer(renderer, game);
  bindKeyboard(() => game);
  const localCommand = (cmd: Command): void => {
    const reason = validateCommand(runner.state, cmd);
    if (reason) return notify(REJECT_MESSAGES[reason]);
    runner.enqueue(cmd);
    if (runner.paused || runner.speed === 0) runner.stepAndPublish();
  };
  const economy: EconomyActions = {
    callWave: () => localCommand({ type: "callWave", tick: 0, playerId: 0 }),
    gift: (to, amount) => localCommand({ type: "gift", tick: 0, playerId: 0, to, amount }),
    sell: (towerId) => {
      store.setSelectedTowerId(null);
      localCommand({ type: "sell", tick: 0, playerId: 0, towerId });
    },
  };
  render(() => <GameView game={game} dump={params.dump} economy={economy} />, hudEl);

  if (params.tick > 0) runner.fastForward(params.tick);
  if (params.speed === 0) {
    runner.paused = true;
    store.setPaused(true);
  }
  runner.start();
  markReady();
}

function bootCoop(params: UrlParams): void {
  const net = createNetStore();
  const connection = new Connection();
  const [game, setGame] = createSignal<Game | null>(null);
  const defaultName = params.name ?? "Jugador";

  const updateUrl = (code: string): void => {
    const query = new URLSearchParams({ mode: "coop", room: code });
    if (params.name) query.set("name", params.name);
    history.replaceState(null, "", `?${query.toString()}`);
  };

  /** Store and runner exist right away so ticks arriving while Pixi boots are applied, not lost. */
  const startGame = (snapshot: SnapshotMessage): Game => {
    const store = createGameStore(snapshot.state, DEFAULT_TOWER, snapshot.you);
    const runner = new GameRunner(snapshot.state, {
      speed: 1,
      remote: true,
      onState: store.setState,
      onDesync: (tick, hash) => connection.send("desync", { tick, hash }),
    });
    const created: Game = { store, runner };
    const notify = makeNotifier(created);
    exposeForTools(created);
    setGame(created);
    void createRenderer(mapEl, {
      mapId: snapshot.state.mapId as MapId,
      onCellTap: (cell) => {
        if (selectTowerAt(created, cell)) return;
        const tower = store.selectedTower();
        if (!tower || net.roomInfo()?.phase !== "playing") return;
        const cmd = { type: "build" as const, tick: runner.state.tick, playerId: snapshot.you, tower, x: cell.x, y: cell.y };
        const reason = validateBuild(runner.state, cmd);
        if (reason) return notify(REJECT_MESSAGES[reason]);
        connection.send("cmd", { type: "build", tower, x: cell.x, y: cell.y });
      },
    }).then((renderer) => bindRenderer(renderer, created));
    return created;
  };

  const handlers: RoomHandlers = {
    snapshot: (msg) => {
      net.setRoomInfo({ code: connection.code ?? "", players: msg.players, you: msg.you, creator: msg.creator, phase: msg.phase });
      const current = game();
      if (current && current.store.you === msg.you) current.runner.replaceState(msg.state);
      else startGame(msg);
    },
    tick: (msg) => game()?.runner.applyTick(msg.tick, msg.commands, msg.hash),
    players: (list) => net.setRoomInfo((info) => (info ? { ...info, players: list } : info)),
    phase: (phase) => net.setRoomInfo((info) => (info ? { ...info, phase } : info)),
    chat: (msg) => net.pushChat(msg),
    rejected: (msg) => {
      const current = game();
      if (current) makeNotifier(current)(REJECT_MESSAGES[msg.reason]);
    },
    left: (_code, kicked) => {
      net.setRoomInfo(null);
      net.setError(kicked ? "Te expulsaron de la sala" : "Se perdió la conexión con la sala");
      history.replaceState(null, "", "?mode=coop");
    },
  };

  const guarded = async (task: () => Promise<string>): Promise<void> => {
    net.setBusy(true);
    net.setError(null);
    try {
      updateUrl(await task());
    } catch (err) {
      net.setError(err instanceof Error && err.message ? `No se pudo entrar: ${err.message}` : "No se pudo entrar a la sala");
    } finally {
      net.setBusy(false);
    }
  };

  const actions: LobbyActions = {
    create: (name, isPrivate) => guarded(() => connection.create({ name, private: isPrivate }, handlers)),
    join: (code, name) => guarded(() => connection.join(code, name, handlers)),
    listRooms: () => connection.listRooms(),
    start: () => connection.send("start", {}),
    kick: (playerId) => connection.send("kick", { playerId }),
    leave: async () => {
      await connection.leave();
      location.assign("?mode=coop");
    },
  };

  bindKeyboard(game);
  render(
    () => (
      <>
        <Show when={net.roomInfo()?.phase === "lobby" || !game()}>
          <Lobby net={net} actions={actions} defaultName={defaultName} initialCode={params.room} />
        </Show>
        <Show when={game()}>
          {(g) => (
            <GameView
              game={g()}
              net={net}
              dump={false}
              sendChat={(text) => connection.send("chat", { text })}
              economy={{
                callWave: () => connection.send("cmd", { type: "callWave" }),
                gift: (to, amount) => connection.send("cmd", { type: "gift", to, amount }),
                sell: (towerId) => {
                  g().store.setSelectedTowerId(null);
                  connection.send("cmd", { type: "sell", towerId });
                },
              }}
            />
          )}
        </Show>
      </>
    ),
    hudEl,
  );

  const initialRoom = params.room;
  if (initialRoom) void guarded(() => connection.rejoin(initialRoom, defaultName, handlers));
  markReady();
}

const params = parseUrlParams(location.search);
if (params.mode === "coop") bootCoop(params);
else void bootSolo(params);
