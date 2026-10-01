import { For, Show, createSignal, onCleanup, untrack } from "solid-js";
import {
  waveDef,
  validateCommand,
  type RejectReason,
  MAPS,
  DETOUR,
  AFFIXES,
  ARMOR_LABELS,
  ECONOMY,
  ENEMIES,
  TICKS_PER_SECOND,
  WAVES,
  bossAffix,
  callWaveBonus,
  upcomingWaves,
  type Branch,
} from "@td/sim";
import type { GameStore } from "../game/store";
import type { NetStore } from "../net/store";
import { ReportButton } from "./ReportDialog";
import { playerCss } from "./colors";

export interface EconomyActions {
  /** Coop only: sends a bug report with the game attached. */
  report?: (message: string) => void;
  callWave: () => void;
  /** The host opens a detour of the map between waves. */
  openDetour?: (detour: number) => void;
  /** Coop only: the host hands the role on. */
  passHost?: (to: number) => void;
  gift: (to: number, amount: number) => void;
  sell: (towerId: number) => void;
  upgrade: (towerId: number, branch?: Branch) => void;
  /** Absent when this player may not change the pace (coop guests). */
  setSpeed?: (speed: number) => void;
  speed?: () => number;
}

/**
 * The top bar wraps when it carries many buttons (host, detours, speed). Everything placed below it reads
 * --topbar-h, so it is kept to the bar's real height instead of a fixed guess.
 */
function trackTopbarHeight(el: HTMLElement): void {
  const root = document.documentElement;
  const observer = new ResizeObserver(() => root.style.setProperty("--topbar-h", `${el.offsetHeight}px`));
  observer.observe(el);
  onCleanup(() => {
    observer.disconnect();
    root.style.removeProperty("--topbar-h");
  });
}

const DETOUR_SHOWN: (RejectReason | null)[] = [null, "no_gold", "detour_blocked"];

export function Hud(props: { store: GameStore; net?: NetStore; economy?: EconomyActions }) {
  const s = () => props.store.state();
  const room = () => props.net?.roomInfo() ?? null;
  const countdownTicks = () => (s().nextWaveTick === null ? null : s().nextWaveTick! - s().tick);
  const wavePending = () => {
    const left = countdownTicks();
    return s().status === "playing" && waveDef(s(), s().wave + 1) !== null && left !== null && left > 0 && s().wavesClosed === s().wave;
  };
  const isHost = () => s().host === props.store.you;
  /** The sim's own answer to opening this detour now; the button shows when the only obstacle is gold or a tower in the way. */
  const detourReject = (detour: number) => validateCommand(s(), { type: "openDetour", tick: s().tick, playerId: props.store.you, detour });
  const nameOf = (id: number): string => room()?.players.find((p) => p.playerId === id)?.name ?? `Jugador ${id + 1}`;
  const bonus = () => callWaveBonus(countdownTicks() ?? 0);
  const countdownSeconds = () => Math.ceil((countdownTicks() ?? 0) / TICKS_PER_SECOND);
  const others = () => s().players.filter((p) => p.id !== props.store.you);
  const canGift = () => s().wave >= ECONOMY.giftFromWave && others().length > 0;
  const seconds = () => (s().tick / TICKS_PER_SECOND).toFixed(1);
  return (
    <>
      <div class="topbar" ref={trackTopbarHeight}>
        <span class="gold">Oro {props.store.gold()}</span>
        <span class="lives">Vidas {s().lives}</span>
        <span>
          Oleada {s().wave}
          {s().mode === "endless" ? " · infinito" : `/${WAVES.length}`}
        </span>
        <span>Enemigos {s().enemies.length}</span>
        <span>
          Tick {s().tick} ({seconds()}s)
        </span>
        <Show when={wavePending()}>
          <span class="countdown">
            {s().wave === 0 ? "Primera" : "Próxima"} oleada en {countdownSeconds()} s
          </span>
        </Show>
        <Show when={props.economy && wavePending() && isHost()}>
          <button type="button" class="inline" onClick={() => props.economy!.callWave()}>
            Llamar oleada +{bonus()}
          </button>
        </Show>
        <Show when={props.economy?.openDetour && isHost()}>
          <For each={MAPS[s().mapId].detours}>
            {(detour, i) => (
              <Show when={DETOUR_SHOWN.includes(detourReject(i()))}>
                <button
                  type="button"
                  class="inline detour"
                  disabled={detourReject(i()) !== null}
                  title="Alarga el camino para siempre; sus celdas tienen que estar libres"
                  onClick={() => props.economy!.openDetour!(i())}
                >
                  Abrir {detour.label} ({DETOUR.cost})
                </button>
              </Show>
            )}
          </For>
        </Show>
        <Show when={room() && !isHost()}>
          <span class="muted">Anfitrión: {nameOf(s().host)}</span>
        </Show>
        <Show when={props.economy?.passHost && isHost() && others().length > 0}>
          <HostControl others={others().map((p) => p.id)} nameOf={nameOf} pass={props.economy!.passHost!} />
        </Show>
        <Show when={props.economy && canGift()}>
          <GiftControl
            others={others().map((p) => p.id)}
            names={room()?.players ?? []}
            max={props.store.gold()}
            gift={props.economy!.gift}
          />
        </Show>
        <Show when={!s().ranked}>
          <span class="dev">sin récords</span>
        </Show>
        <Show when={props.economy?.speed}>
          {(speed) => (
            <span class="speed">
              <For each={[1, 2, 4]}>
                {(s) => (
                  <button
                    type="button"
                    class="inline"
                    classList={{ active: speed()() === s }}
                    disabled={!props.economy?.setSpeed}
                    onClick={() => props.economy?.setSpeed?.(s)}
                  >
                    {s}×
                  </button>
                )}
              </For>
            </span>
          )}
        </Show>
        <Show when={props.economy?.report}>{(send) => <ReportButton send={send()} />}</Show>
        <Show when={room()}>
          {(info) => (
            <>
              <span class="dev">
                sala {info().code} · {info().players.filter((p) => p.connected).length}/{info().players.length} jugadores
              </span>
              <span class="mates">
                <For each={s().players.filter((p) => p.id !== props.store.you)}>
                  {(p) => (
                    <span
                      classList={{ offline: !info().players.find((i) => i.playerId === p.id)?.connected }}
                      style={{ color: playerCss(s(), p.id) }}
                    >
                      {info().players.find((i) => i.playerId === p.id)?.name ?? `Jugador ${p.id + 1}`} {p.gold}
                    </span>
                  )}
                </For>
              </span>
            </>
          )}
        </Show>
        <span class="status" classList={{ won: s().status === "won", lost: s().status === "lost" }}>
          {s().status === "playing" ? (props.store.paused() ? "pausa" : "") : s().status === "won" ? "VICTORIA" : "DERROTA"}
        </span>
      </div>
      <WavePreview store={props.store} />
      <Show when={props.store.notice()}>{(msg) => <div class="toast">{msg()}</div>}</Show>
    </>
  );
}

const PREVIEW_WAVES = 3;

/** The next waves: how many of what, and their armor, so the player picks the right attack type. */
function WavePreview(props: { store: GameStore }) {
  const waves = () => (props.store.state().status === "playing" ? upcomingWaves(props.store.state(), PREVIEW_WAVES) : []);
  return (
    <Show when={waves().length > 0}>
      <div class="wave-preview">
        <For each={waves()}>
          {(w) => (
            <div class="row">
              <b>{w.number}</b>
              <For each={w.def.groups}>
                {(g) => (
                  <span style={{ color: `#${ENEMIES[g.kind].color.toString(16).padStart(6, "0")}` }} title={ENEMIES[g.kind].line}>
                    {g.count} {ENEMIES[g.kind].label} <span class="muted">({ARMOR_LABELS[ENEMIES[g.kind].armor]})</span>
                    <Show when={g.kind === "boss"}>
                      <span class="muted"> · {AFFIXES[bossAffix(props.store.state().seed, w.number)].label}</span>
                    </Show>
                  </span>
                )}
              </For>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}

/** The host picks who takes the role; the select keeps its value across ticks. */
function HostControl(props: { others: number[]; nameOf: (id: number) => string; pass: (to: number) => void }) {
  const [to, setTo] = createSignal(untrack(() => props.others[0] ?? 0));
  return (
    <form
      class="gift"
      onSubmit={(e) => {
        e.preventDefault();
        props.pass(to());
      }}
    >
      <select value={to()} onChange={(e) => setTo(Number(e.currentTarget.value))}>
        <For each={props.others}>{(id) => <option value={id}>{props.nameOf(id)}</option>}</For>
      </select>
      <button type="submit" class="inline">
        Ceder anfitrión
      </button>
    </form>
  );
}

function GiftControl(props: {
  others: number[];
  names: { playerId: number; name: string }[];
  max: number;
  gift: (to: number, amount: number) => void;
}) {
  const [to, setTo] = createSignal(untrack(() => props.others[0] ?? 0));
  const [amount, setAmount] = createSignal(10);
  const label = (id: number): string => props.names.find((p) => p.playerId === id)?.name ?? `Jugador ${id + 1}`;
  return (
    <form
      class="gift"
      onSubmit={(e) => {
        e.preventDefault();
        props.gift(to(), amount());
      }}
    >
      <select value={to()} onChange={(e) => setTo(Number(e.currentTarget.value))}>
        <For each={props.others}>{(id) => <option value={id}>{label(id)}</option>}</For>
      </select>
      <input type="number" min={1} max={props.max} value={amount()} onInput={(e) => setAmount(Number(e.currentTarget.value))} />
      <button type="submit" class="inline" disabled={amount() < 1 || amount() > props.max}>
        Regalar
      </button>
    </form>
  );
}
