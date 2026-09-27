import { render } from "solid-js/web";
import { Show, createEffect, createRoot, createSignal } from "solid-js";
import {
  ECONOMY,
  ENEMIES,
  attenuatedBounty,
  TOWER_KINDS,
  createBot,
  dumpState,
  createInitialState,
  hashState,
  validateBuild,
  validateCommand,
  type Command,
  type GameState,
  type TowerKind,
} from "@td/sim";
import type { CommandReject, SnapshotMessage } from "@td/server/protocol";
import { GameRunner } from "./game/runner";
import { createGameStore, type GameStore } from "./game/store";
import { Connection, type RoomHandlers } from "./net/connection";
import { captureErrors, recentErrors } from "./net/errors";
import { createNetStore, type NetStore } from "./net/store";
import { parseUrlParams, type UrlParams } from "./params";
import { createRenderer, type Renderer } from "./render/app";
import { Chat } from "./ui/Chat";
import { DebugPanel, type DebugActions } from "./ui/DebugPanel";
import { Dump } from "./ui/Dump";
import { EndScreen, type EndActions } from "./ui/EndScreen";
import { createFloatingLabels } from "./ui/FloatingLabels";
import { Hud, type EconomyActions } from "./ui/Hud";
import { Lobby, type LobbyActions } from "./ui/Lobby";
import { Shop } from "./ui/Shop";
import { TowerPanel } from "./ui/TowerPanel";
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
  max_level: "La torre ya está al máximo",
  rate_limited: "Demasiado rápido, esperá un momento",
  not_playing: "La partida todavía no empezó",
  bad_shape: "Comando inválido",
};

const NOTICE_MS = 1500;
const DEFAULT_TOWER: TowerKind = TOWER_KINDS[0]!;

interface Game {
  store: GameStore;
  runner: GameRunner;
  labels: ReturnType<typeof createFloatingLabels>;
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

/** Every kill pays the same share to every player, so one label per kill is enough. */
function killLabel(game: Game): (positions: { x: number; y: number }[]) => void {
  return (positions) => {
    const state = game.store.state();
    const share = attenuatedBounty(ENEMIES.normal.bounty, state.players.length);
    const rect = mapEl.getBoundingClientRect();
    for (const p of positions) game.labels.push(p.x + rect.left, p.y + rect.top, `+${share}`);
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
      const id = game.store.selectedTowerId();
      const tower = id === null ? undefined : game.store.state().towers.find((t) => t.id === id);
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

function GameView(props: {
  game: Game;
  net?: NetStore;
  dump: boolean;
  sendChat?: (text: string) => void;
  economy: EconomyActions;
  onGiveUp?: () => void;
  end: EndActions;
  endWaitingFor?: () => string | undefined;
}) {
  const actions = () => debugActions(props.game);
  return (
    <>
      <Hud store={props.game.store} net={props.net} economy={props.economy} />
      <TowerPanel
        store={props.game.store}
        actions={props.economy}
        ownerName={(id) => props.net?.roomInfo()?.players.find((p) => p.playerId === id)?.name ?? `Jugador ${id + 1}`}
      />
      <Shop store={props.game.store} />
      <Show when={props.net && props.sendChat}>
        <Chat net={props.net!} send={props.sendChat!} />
      </Show>
      <Show when={props.game.store.debugOpen()}>
        <DebugPanel store={props.game.store} actions={actions()} remote={props.game.runner.remote} />
      </Show>
      <Show when={props.dump}>
        <Dump store={props.game.store} />
      </Show>
      <props.game.labels.View />
      <Show when={props.game.store.state().status !== "playing"}>
        <EndScreen
          state={props.game.store.state()}
          you={props.game.store.you}
          names={props.net ? new Map(props.net.roomInfo()?.players.map((p) => [p.playerId, p.name]) ?? []) : undefined}
          actions={props.end}
          waitingFor={props.endWaitingFor?.()}
        />
      </Show>
      <Show when={props.net?.dropped()}>
        <div class="overlay reconnecting">
          <span>
            Conexión perdida. Reconectando…
            <button type="button" onClick={() => props.onGiveUp?.()}>
              Volver al lobby
            </button>
          </span>
        </div>
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
  const game: Game = { store, runner, labels: createFloatingLabels() };
  exposeForTools(game);
  const notify = makeNotifier(game);

  const renderer = await createRenderer(mapEl, {
    mapId: initial.mapId,
    onKills: killLabel(game),
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
  const [speed, setSpeedSignal] = createSignal(params.speed);
  const economy: EconomyActions = {
    speed,
    setSpeed: (s) => {
      runner.speed = s;
      setSpeedSignal(s);
    },
    callWave: () => localCommand({ type: "callWave", tick: 0, playerId: 0 }),
    gift: (to, amount) => localCommand({ type: "gift", tick: 0, playerId: 0, to, amount }),
    sell: (towerId) => {
      store.setSelectedTowerId(null);
      localCommand({ type: "sell", tick: 0, playerId: 0, towerId });
    },
    upgrade: (towerId) => localCommand({ type: "upgrade", tick: 0, playerId: 0, towerId }),
  };
  const withSeed = (seed: number | null): string => {
    const query = new URLSearchParams(location.search);
    query.delete("tick");
    if (seed === null) query.delete("seed");
    else query.set("seed", String(seed));
    return `?${query.toString()}`;
  };
  const end: EndActions = {
    again: () => location.assign(withSeed(null)),
    repeat: () => location.assign(withSeed(initial.seed)),
  };
  render(() => <GameView game={game} dump={params.dump} economy={economy} end={end} />, hudEl);

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
  const [game, setGameSignal] = createSignal<Game | null>(null);
  let currentGame: Game | null = null;
  const setGame = (next: Game | null): void => {
    currentGame = next;
    setGameSignal(next);
  };
  const [lastCode, setLastCode] = createSignal<string | undefined>(params.room);
  let renderer: Renderer | null = null;
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
      onDesync: (tick, hash, dump) => connection.send("desync", { tick, hash, dump }),
    });
    const created: Game = { store, runner, labels: createFloatingLabels() };
    const notify = makeNotifier(created);
    exposeForTools(created);
    setGame(created);
    void createRenderer(mapEl, {
      mapId: snapshot.state.mapId,
      onKills: killLabel(created),
      onCellTap: (cell) => {
        if (selectTowerAt(created, cell)) return;
        const tower = store.selectedTower();
        if (!tower || net.roomInfo()?.phase !== "playing") return;
        const cmd = { type: "build" as const, tick: runner.state.tick, playerId: snapshot.you, tower, x: cell.x, y: cell.y };
        const reason = validateBuild(runner.state, cmd);
        if (reason) return notify(REJECT_MESSAGES[reason]);
        connection.send("cmd", { type: "build", tower, x: cell.x, y: cell.y });
      },
    }).then((r) => {
      renderer = r;
      bindRenderer(r, created);
    });
    return created;
  };

  /** The room is gone (kicked, server restarted, network): back to the lobby with the code ready to retry. */
  const leaveGame = (message: string): void => {
    renderer?.destroy();
    renderer = null;
    setGame(null);
    net.setDropped(false);
    net.setRoomInfo(null);
    net.setError(message);
    const query = new URLSearchParams({ mode: "coop" });
    if (params.name) query.set("name", params.name);
    history.replaceState(null, "", `?${query.toString()}`);
  };

  const handlers: RoomHandlers = {
    snapshot: (msg) => {
      net.setRoomInfo({
        code: connection.code ?? "",
        players: msg.players,
        you: msg.you,
        creator: msg.creator,
        phase: msg.phase,
        speed: msg.speed,
      });
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
    speed: (speed) => net.setRoomInfo((info) => (info ? { ...info, speed } : info)),
    dropped: () => net.setDropped(true),
    reconnected: () => net.setDropped(false),
    reported: (msg) => {
      const current = game();
      if (current) makeNotifier(current)(`Reporte enviado: ${msg.ref}`);
    },
    left: (_code, kicked) => {
      leaveGame(
        kicked ? "Te expulsaron de la sala" : "Se perdió la conexión con la sala. Si el server sigue en pie, volvé a entrar con el código.",
      );
    },
  };

  const sendReport = (reason: "manual" | "client_error", message: string): void => {
    const current = currentGame;
    if (!current || !connection.room) return;
    connection.send("report", {
      reason,
      message,
      clientTick: current.store.state().tick,
      clientHash: hashState(current.store.state()),
      clientDump: dumpState(current.store.state()),
      errors: recentErrors(),
      userAgent: navigator.userAgent,
    });
  };
  captureErrors((message) => sendReport("client_error", message));

  const guarded = async (task: () => Promise<string>): Promise<void> => {
    net.setBusy(true);
    net.setError(null);
    try {
      const code = await task();
      setLastCode(code);
      updateUrl(code);
    } catch (err) {
      net.setError(err instanceof Error && err.message ? `No se pudo entrar: ${err.message}` : "No se pudo entrar a la sala");
    } finally {
      net.setBusy(false);
    }
  };

  const actions: LobbyActions = {
    create: (name, isPrivate, map) => guarded(() => connection.create({ name, private: isPrivate, map }, handlers)),
    join: (code, name) => guarded(() => connection.join(code, name, handlers)),
    listRooms: () => connection.listRooms(),
    start: () => connection.send("start", {}),
    kick: (playerId) => connection.send("kick", { playerId }),
    setReady: (ready) => connection.send("ready", { ready }),
    leave: async () => {
      await connection.leave();
      location.assign("?mode=coop");
    },
  };

  const isCreator = (): boolean => net.roomInfo()?.you === net.roomInfo()?.creator;
  const me = () => net.roomInfo()?.players.find((p) => p.playerId === net.roomInfo()?.you);
  const notReadyNames = (): string[] => {
    const info = net.roomInfo();
    if (!info) return [];
    return info.players.filter((p) => p.playerId !== info.creator && p.connected && !p.ready).map((p) => p.name);
  };
  bindKeyboard(() => currentGame);
  render(
    () => (
      <>
        <Show when={net.roomInfo()?.phase === "lobby" || !game()}>
          <Lobby net={net} actions={actions} defaultName={defaultName} initialCode={lastCode()} />
        </Show>
        <Show when={game()}>
          {(g) => (
            <GameView
              game={g()}
              net={net}
              dump={false}
              sendChat={(text) => connection.send("chat", { text })}
              economy={{
                report: (message) => sendReport("manual", message),
                callWave: () => connection.send("cmd", { type: "callWave" }),
                gift: (to, amount) => connection.send("cmd", { type: "gift", to, amount }),
                sell: (towerId) => {
                  g().store.setSelectedTowerId(null);
                  connection.send("cmd", { type: "sell", towerId });
                },
                upgrade: (towerId) => connection.send("cmd", { type: "upgrade", towerId }),
                speed: () => net.roomInfo()?.speed ?? 1,
                setSpeed:
                  net.roomInfo()?.you === net.roomInfo()?.creator
                    ? (s) => connection.send("setSpeed", { speed: s as 1 | 2 | 4 })
                    : undefined,
              }}
              onGiveUp={() => void actions.leave()}
              end={{
                again: isCreator() ? () => connection.send("restart", {}) : undefined,
                leave: () => void actions.leave(),
                ready: isCreator()
                  ? undefined
                  : { mine: me()?.ready ?? false, toggle: () => connection.send("ready", { ready: !me()?.ready }) },
                notReady: isCreator() ? notReadyNames() : undefined,
              }}
              endWaitingFor={() => (isCreator() ? undefined : "El anfitrión empieza cuando todos estén listos")}
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
