import { render } from "solid-js/web";
import { Show, createEffect, createRoot, createSignal } from "solid-js";
import {
  ABILITIES,
  DECK,
  ECONOMY,
  ENEMIES,
  attenuatedBounty,
  createBot,
  dumpState,
  DEFAULT_MAP,
  createInitialState,
  dailyStart,
  dailySeed,
  soloStart,
  deckProblem,
  findPlayer,
  hashState,
  validateBuild,
  validateCommand,
  type AbilityKind,
  type Command,
  type Deck,
  type EnemyKind,
  type GameState,
  type Point,
  type ChooseDoctrineCommand,
  type RerollDoctrinesCommand,
  type UpgradeAbilityCommand,
  type UseAbilityCommand,
} from "@td/sim";
import type { CommandReject, CommandRequest, SnapshotMessage, SoloResultMessage } from "@td/server/protocol";
import { GameRunner } from "./game/runner";
import { createGameStore, type GameStore } from "./game/store";
import { Connection, type RoomHandlers } from "./net/connection";
import { captureErrors, recentErrors } from "./net/errors";
import { createNetStore, type NetStore } from "./net/store";
import { parseUrlParams, type SoloKind, type UrlParams } from "./params";
import { createRenderer, type Renderer } from "./render/app";
import { drawSoloColor, playerCss } from "./ui/colors";
import { Chat } from "./ui/Chat";
import { DebugPanel, type DebugActions } from "./ui/DebugPanel";
import { Dump } from "./ui/Dump";
import { EndScreen, type EndActions } from "./ui/EndScreen";
import { createFloatingLabels } from "./ui/FloatingLabels";
import { Hud, type EconomyActions } from "./ui/Hud";
import { Lobby, type LobbyActions } from "./ui/Lobby";
import { DeckScreen } from "./ui/DeckScreen";
import { DoctrinePanel, type DoctrineActions } from "./ui/DoctrinePanel";
import { adoptAccountDecks, readDeck, writeDeck } from "./game/deck";
import { claimLogin, loadProfile, loadReplay, readReplayFile, readSession, submitSolo, todayUtc, type Profile } from "./net/account";
import { ProfileButton } from "./ui/ProfilePanel";
import { AbilityBar, pickAbility, type AbilityActions, type AbilityRequest } from "./ui/AbilityBar";
import { Shop } from "./ui/Shop";
import { TowerPanel } from "./ui/TowerPanel";
import "./styles.css";

interface DebugHandle {
  runner: GameRunner;
  state: () => GameState;
  hash: () => string;
  ready: boolean;
  /** Cell where the map draws the chosen tower's reach, if any. */
  preview?: () => Point | null;
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
  not_host: "Solo el anfitrión llama la oleada",
  gift_too_early: `Los regalos se habilitan en la oleada ${ECONOMY.giftFromWave}`,
  bad_amount: "Cantidad inválida",
  no_tower: "Esa torre ya no existe",
  not_owner: "Esa torre no es tuya",
  wave_in_progress: "Todavía quedan enemigos de esta oleada",
  max_level: "La torre ya está al máximo",
  not_on_path: "Eso va sobre el camino",
  wall_active: "Ya tenés una tranquera en pie",
  wall_cooldown: "Tu tranquera cayó hace poco, esperá",
  wall_under_attack: "No se vende una tranquera mientras la golpean",
  unknown_command: "Esa acción no existe en esta versión",
  branch_required: "El último nivel elige una rama",
  bad_branch: "Esa rama no existe",
  unknown_ability: "Habilidad desconocida",
  ability_cooldown: "Todavía se está recargando",
  bad_target: "Tiene que ser una torre tuya que ataque",
  not_in_deck: "Esa carta no está en tu mazo",
  bad_deck: "Ese mazo no vale",
  no_offer: "No hay doctrinas para elegir ahora",
  bad_doctrine: "Esa doctrina no está en la oferta",
  already_rerolled: "Ya cambiaste la oferta una vez",
  bad_detour: "Ese desvío no existe en este mapa",
  already_open: "Ese desvío ya está abierto",
  detour_blocked: "Hay torres en el desvío o en el tramo que saltea",
  rate_limited: "Demasiado rápido, esperá un momento",
  not_playing: "La partida todavía no empezó",
  bad_shape: "Comando inválido",
};

const NOTICE_MS = 1500;

interface Game {
  store: GameStore;
  runner: GameRunner;
  labels: ReturnType<typeof createFloatingLabels>;
  abilities: AbilityActions;
  doctrines: DoctrineActions;
}

type CardCommand = UseAbilityCommand | UpgradeAbilityCommand | ChooseDoctrineCommand | RerollDoctrinesCommand;

/** Checks against the local sim before delivering, so a refused card says why at once and an ability keeps its aim. */
function cardActions(store: GameStore, runner: GameRunner, notify: (msg: string) => void, deliver: (cmd: CardCommand) => void) {
  const run = (cmd: CardCommand): boolean => {
    const reason = validateCommand(runner.state, cmd);
    if (reason) {
      notify(REJECT_MESSAGES[reason]);
      return false;
    }
    deliver(cmd);
    return true;
  };
  const head = () => ({ tick: runner.state.tick, playerId: store.you });
  const abilities: AbilityActions = {
    cast: (req) => run({ type: "useAbility", ...head(), ...req }),
    upgrade: (ability) => void run({ type: "upgradeAbility", ...head(), ability }),
  };
  const doctrines: DoctrineActions = {
    choose: (doctrine) => void run({ type: "chooseDoctrine", ...head(), doctrine }),
    reroll: () => void run({ type: "rerollDoctrines", ...head() }),
  };
  return { abilities, doctrines };
}

/** The request the server expects for a card command: the same payload without tick and player, which the server sets. */
function cardRequest(cmd: CardCommand): CommandRequest {
  switch (cmd.type) {
    case "useAbility":
      return { type: cmd.type, ability: cmd.ability, x: cmd.x, y: cmd.y, towerId: cmd.towerId };
    case "upgradeAbility":
      return { type: cmd.type, ability: cmd.ability };
    case "chooseDoctrine":
      return { type: cmd.type, doctrine: cmd.doctrine };
    case "rerollDoctrines":
      return { type: cmd.type };
  }
}

/** Where the aimed ability goes when that cell is tapped: the cell itself, or the tower on it. Null when it needs a tower and there is none. */
function aimedRequest(game: Game, ability: AbilityKind, cell: Point): AbilityRequest | null {
  if (ABILITIES[ability].target !== "ownTower") return { ability, x: cell.x, y: cell.y };
  const tower = game.store.state().towers.find((t) => t.x === cell.x && t.y === cell.y);
  return tower ? { ability, towerId: tower.id } : null;
}

/** A tap while aiming casts the ability there; it stays aimed if the sim refused it. Returns true when the tap was used. */
function tapAim(game: Game, cell: Point, notify: (msg: string) => void): boolean {
  const ability = game.store.aimingAbility();
  if (!ability) return false;
  const req = aimedRequest(game, ability, cell);
  if (!req) notify(REJECT_MESSAGES.bad_target);
  else if (game.abilities.cast(req)) game.store.setAimingAbility(null);
  return true;
}

const mapEl = document.getElementById("map")!;
const hudEl = document.getElementById("hud")!;

/** This browser's profile, loaded in the background: null while loading or when accounts are down, and the game never waits for it. */
const [profile, setProfile] = createSignal<Profile | null>(null);
/** What the provider said when the browser came back from logging in, shown once in the profile panel. */
const [loginNotice, setLoginNotice] = createSignal<string | null>(null);

/** The profile button shows outside of play (deck screen, lobby, end screen); during a game it would cover the top bar. */
const [profileShown, setProfileShown] = createSignal(true);

/** Back from a provider: the hash carries an identity to claim with this browser's session, or a failure. */
async function finishLogin(): Promise<void> {
  const claim = /claim=([0-9a-f]+)/.exec(location.hash)?.[1];
  const failed = location.hash.includes("login=error");
  if (!claim && !failed) return;
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  if (!claim) {
    setLoginNotice("No se pudo vincular la cuenta. Probá de nuevo desde este panel.");
    return;
  }
  const linked = await claimLogin(claim);
  setLoginNotice(linked ? "Cuenta vinculada" : "No se pudo vincular la cuenta. Cada cuenta admite un solo Discord y un solo Google.");
}

function startAccounts(name: string): void {
  void finishLogin().then(() => showAccounts(name));
}

function showAccounts(name: string): void {
  const root = document.createElement("div");
  document.body.appendChild(root);
  render(
    () => (
      <Show when={profileShown()}>
        <ProfileButton profile={profile} setProfile={setProfile} notice={loginNotice} clearNotice={() => setLoginNotice(null)} />
      </Show>
    ),
    root,
  );
  void loadProfile(name).then((loaded) => {
    setProfile(loaded);
    if (loaded) adoptAccountDecks(loaded.decks);
  });
}

function markReady(): void {
  requestAnimationFrame(() => {
    if (window.__td) window.__td.ready = true;
    document.documentElement.dataset["ready"] = "1";
  });
}

function exposeForTools(game: Game): void {
  window.__td = { runner: game.runner, state: game.store.state, hash: () => hashState(game.store.state()), ready: false };
}

/** A build refused for lack of gold keeps the reach on the map: the player is planning the next buy. */
function rejectBuild(notify: (msg: string) => void, reason: CommandReject): boolean {
  notify(REJECT_MESSAGES[reason]);
  return reason === "no_gold";
}

function makeNotifier(game: { store: GameStore }): (msg: string) => void {
  let timer = 0;
  return (msg) => {
    game.store.setNotice(msg);
    clearTimeout(timer);
    timer = window.setTimeout(() => game.store.setNotice(null), NOTICE_MS);
  };
}

/** Every kill pays the same share to every player, so one label per kill is enough; it wears the color of whoever landed the kill. */
function killLabel(game: Game): (kills: { x: number; y: number; kind: EnemyKind; owner: number | null }[]) => void {
  return (kills) => {
    const state = game.store.state();
    const rect = mapEl.getBoundingClientRect();
    for (const k of kills) {
      const text = `+${attenuatedBounty(ENEMIES[k.kind].bounty, state.players.length)}`;
      game.labels.push(k.x + rect.left, k.y + rect.top, text, k.owner === null ? undefined : playerCss(state, k.owner));
    }
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
  if (window.__td) window.__td.preview = () => renderer.previewCell();
  createRoot(() => {
    createEffect(() => renderer.setHoverTower(game.store.selectedTower()));
    createEffect(() => {
      const kind = game.store.aimingAbility();
      const player = findPlayer(game.store.state(), game.store.you);
      const level = kind && player ? player.abilities[kind].level : 1;
      renderer.setAimAbility(kind ? { kind, level } : null);
    });
    createEffect(() => {
      const id = game.store.selectedTowerId();
      const tower = id === null ? undefined : game.store.state().towers.find((t) => t.id === id);
      renderer.setSelectedCell(tower ? { x: tower.x, y: tower.y } : null);
      renderer.setSelectedTowerId(tower ? tower.id : null);
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

/** The n-th ability of the player's deck (1-based), as the keys 1, 2… pick it. */
function deckAbility(game: Game, n: number): AbilityKind | undefined {
  return findPlayer(game.store.state(), game.store.you)?.deck.abilities[n - 1];
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
    } else if (e.key === "Escape") {
      game.store.setSelectedTower(null);
      game.store.setSelectedTowerId(null);
      game.store.setAimingAbility(null);
    } else if (/^[1-9]$/.test(e.key) && deckAbility(game, Number(e.key))) {
      pickAbility(game.store, game.abilities, deckAbility(game, Number(e.key))!);
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
  /** Solo ranked games: what the server answered once the game was sent, or what happened to it. */
  submitted?: () => SoloResultMessage | string | null;
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
      <AbilityBar store={props.game.store} actions={props.game.abilities} />
      <DoctrinePanel store={props.game.store} actions={props.game.doctrines} />
      <Shop store={props.game.store} />
      <Show when={props.net && props.sendChat}>
        <Chat net={props.net!} send={props.sendChat!} colorOf={(id) => playerCss(props.game.store.state(), id)} />
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
          submitted={props.submitted?.()}
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

/** Solo opens on the deck screen; a dev URL goes straight to the game with its `deck`, or the last one played. */
function bootSolo(params: UrlParams): void {
  const fromUrl = params.deck && deckProblem(params.deck, DECK.soloTowers) === null ? params.deck : null;
  if (fromUrl || params.usesDevParams) {
    void startSolo(params, fromUrl ?? readDeck("solo"), params.kind);
    return;
  }
  const dispose = render(
    () => (
      <DeckScreen
        onPlay={(deck, kind) => {
          writeDeck("solo", deck);
          dispose();
          void startSolo(params, deck, kind);
        }}
      />
    ),
    hudEl,
  );
}

/** Watches a recorded game: the same start and the same commands, tick by tick, with nobody able to act. */
async function bootReplay(source: number | "file"): Promise<void> {
  const data = source === "file" ? readReplayFile() : await loadReplay(source);
  if (!data) {
    hudEl.textContent =
      source === "file"
        ? "No se pudo abrir el replay: volvé a elegir el archivo desde el perfil."
        : "Ese replay venció, no existe o las cuentas no están disponibles. Si lo descargaste, abrilo desde el perfil.";
    return;
  }
  const initial = data.initialState as GameState;
  const byTick = new Map(data.history.map((h) => [h.tick, h.commands as Command[]]));
  const replayer = { decide: (state: GameState): Command[] => byTick.get(state.tick) ?? [] };
  setProfileShown(false);
  const spectator = -1;
  const store = createGameStore(initial, null, spectator);
  const runner = new GameRunner(initial, { speed: 1, bot: replayer, onState: store.setState });
  const notify = makeNotifier({ store });
  const game: Game = { store, runner, labels: createFloatingLabels(), ...cardActions(store, runner, notify, () => undefined) };
  exposeForTools(game);
  const renderer = await createRenderer(mapEl, { mapId: initial.mapId, onKills: killLabel(game), onCellTap: () => false });
  bindRenderer(renderer, game);
  const [speed, setSpeedSignal] = createSignal(1);
  const economy: EconomyActions = {
    speed,
    setSpeed: (s) => {
      runner.speed = s;
      setSpeedSignal(s);
    },
    callWave: () => undefined,
    gift: () => undefined,
    sell: () => undefined,
    upgrade: () => undefined,
  };
  render(() => <GameView game={game} dump={false} economy={economy} end={{ again: () => location.assign("?") }} />, hudEl);
  notify("Replay: mirá la partida, nadie puede jugar");
  runner.start();
  markReady();
}

async function startSolo(params: UrlParams, deck: Deck, kind: SoloKind): Promise<void> {
  setProfileShown(false);
  const day = todayUtc();
  const mode = kind === "campaign" ? "campaign" : "endless";
  // Dev games keep the first color, so a shot or a dump of the same seed and tick always comes out the same.
  const color = params.usesDevParams ? 0 : drawSoloColor();
  /** A ranked game is built exactly as the server rebuilds it to replay; a dev one, with its overrides and no record. */
  const initial = !params.usesDevParams
    ? kind === "daily"
      ? dailyStart(day, deck, color)
      : soloStart({ seed: params.seed, mapId: params.map, mode, deck, color })
    : createInitialState({
        seed: kind === "daily" ? dailySeed(day) : params.seed,
        mapId: kind === "daily" ? DEFAULT_MAP : params.map,
        mode,
        gold: params.gold,
        startWave: params.wave,
        ranked: !params.usesDevParams,
        deckTowers: DECK.soloTowers,
        players: [{ id: 0, deck, color, doctrines: params.doctrines }],
      });
  const preselected = params.tower && deck.towers.includes(params.tower) ? params.tower : null;
  const store = createGameStore(initial, preselected, 0);
  const runner = new GameRunner(initial, {
    speed: params.speed,
    bot: params.bot ? createBot("trivial") : undefined,
    onState: store.setState,
  });
  const notify = makeNotifier({ store });
  /** Paused or at speed 0 the runner does not tick, so a command steps once to show its effect. */
  const deliverLocal = (cmd: Command): void => {
    runner.enqueue(cmd);
    if (runner.paused || runner.speed === 0) runner.stepAndPublish();
  };
  const game: Game = { store, runner, labels: createFloatingLabels(), ...cardActions(store, runner, notify, deliverLocal) };
  exposeForTools(game);

  const renderer = await createRenderer(mapEl, {
    mapId: initial.mapId,
    onKills: killLabel(game),
    onCellTap: (cell) => {
      if (tapAim(game, cell, notify)) return false;
      if (selectTowerAt(game, cell)) return false;
      const tower = store.selectedTower();
      if (!tower) return false;
      const cmd = { type: "build" as const, tick: runner.state.tick, playerId: 0, tower, x: cell.x, y: cell.y };
      const reason = validateBuild(runner.state, cmd);
      if (reason) return rejectBuild(notify, reason);
      deliverLocal(cmd);
      return false;
    },
  });
  bindRenderer(renderer, game);
  bindKeyboard(() => game);
  const localCommand = (cmd: Command): void => {
    const reason = validateCommand(runner.state, cmd);
    if (reason) return notify(REJECT_MESSAGES[reason]);
    deliverLocal(cmd);
  };
  const [speed, setSpeedSignal] = createSignal(params.speed);
  const economy: EconomyActions = {
    speed,
    setSpeed: (s) => {
      runner.speed = s;
      setSpeedSignal(s);
    },
    callWave: () => localCommand({ type: "callWave", tick: 0, playerId: 0 }),
    openDetour: (detour) => localCommand({ type: "openDetour", tick: 0, playerId: 0, detour }),
    gift: (to, amount) => localCommand({ type: "gift", tick: 0, playerId: 0, to, amount }),
    sell: (towerId) => {
      store.setSelectedTowerId(null);
      localCommand({ type: "sell", tick: 0, playerId: 0, towerId });
    },
    upgrade: (towerId, branch) =>
      localCommand(
        branch ? { type: "upgrade", tick: 0, playerId: 0, towerId, branch } : { type: "upgrade", tick: 0, playerId: 0, towerId },
      ),
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
  /** A ranked game goes to the server once it ends: the server replays it, records it for this browser and pays experience. */
  const [submitted, setSubmitted] = createSignal<SoloResultMessage | string | null>(null);
  if (initial.ranked) {
    createRoot(() =>
      createEffect(() => {
        if (store.state().status === "playing" || submitted() !== null) return;
        setProfileShown(true);
        setSubmitted("Registrando la partida…");
        const name = profile()?.name ?? params.name ?? "Anónimo";
        void submitSolo({ kind, day, seed: initial.seed, map: initial.mapId, name, deck, color, history: runner.history }).then(
          setSubmitted,
        );
      }),
    );
  }
  render(() => <GameView game={game} dump={params.dump} economy={economy} end={end} submitted={submitted} />, hudEl);

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
    const store = createGameStore(snapshot.state, null, snapshot.you);
    const runner = new GameRunner(snapshot.state, {
      speed: 1,
      remote: true,
      onState: store.setState,
      onDesync: (tick, hash, dump) => connection.send("desync", { tick, hash, dump }),
    });
    const notify = makeNotifier({ store });
    const deliver = (cmd: CardCommand): void => connection.send("cmd", cardRequest(cmd));
    const created: Game = { store, runner, labels: createFloatingLabels(), ...cardActions(store, runner, notify, deliver) };
    exposeForTools(created);
    setGame(created);
    void createRenderer(mapEl, {
      mapId: snapshot.state.mapId,
      onKills: killLabel(created),
      onCellTap: (cell) => {
        if (net.roomInfo()?.phase === "playing" && tapAim(created, cell, notify)) return false;
        if (selectTowerAt(created, cell)) return false;
        const tower = store.selectedTower();
        if (!tower || net.roomInfo()?.phase !== "playing") return false;
        const cmd = { type: "build" as const, tick: runner.state.tick, playerId: snapshot.you, tower, x: cell.x, y: cell.y };
        const reason = validateBuild(runner.state, cmd);
        if (reason) return rejectBuild(notify, reason);
        connection.send("cmd", { type: "build", tower, x: cell.x, y: cell.y });
        return false;
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
    phase: (phase) => {
      setProfileShown(phase !== "playing");
      net.setRoomInfo((info) => (info ? { ...info, phase } : info));
    },
    chat: (msg) => net.pushChat(msg),
    rejected: (msg) => {
      const current = game();
      if (current) makeNotifier(current)(REJECT_MESSAGES[msg.reason]);
    },
    speed: (speed) => net.setRoomInfo((info) => (info ? { ...info, speed } : info)),
    host: (creator) => net.setRoomInfo((info) => (info ? { ...info, creator } : info)),
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
    create: (name, isPrivate, map) =>
      guarded(() =>
        connection.create({ name, private: isPrivate, map, deck: readDeck("coop"), token: readSession() ?? undefined }, handlers),
      ),
    join: (code, name) => guarded(() => connection.join(code, name, handlers, readDeck("coop"), readSession() ?? undefined)),
    listRooms: () => connection.listRooms(),
    start: () => connection.send("start", {}),
    kick: (playerId) => connection.send("kick", { playerId }),
    setReady: (ready) => connection.send("ready", { ready }),
    passHost: (to) => connection.send("passHost", { to }),
    setDeck: (deck) => {
      writeDeck("coop", deck);
      connection.send("setDeck", { deck });
    },
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
                passHost: (to) => connection.send("cmd", { type: "passHost", to }),
                openDetour: (detour) => connection.send("cmd", { type: "openDetour", detour }),
                gift: (to, amount) => connection.send("cmd", { type: "gift", to, amount }),
                sell: (towerId) => {
                  g().store.setSelectedTowerId(null);
                  connection.send("cmd", { type: "sell", towerId });
                },
                upgrade: (towerId, branch) =>
                  connection.send("cmd", branch ? { type: "upgrade", towerId, branch } : { type: "upgrade", towerId }),
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
  if (initialRoom) void guarded(() => connection.rejoin(initialRoom, defaultName, handlers, readDeck("coop")));
  markReady();
}

const params = parseUrlParams(location.search);
startAccounts(params.name ?? "Jugador");
if (params.replay !== null) void bootReplay(params.replay);
else if (params.mode === "coop") bootCoop(params);
else bootSolo(params);
