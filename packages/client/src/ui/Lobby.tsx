import { For, Show, createSignal, onMount } from "solid-js";
import type { RoomMetadata } from "@td/server/protocol";
import { PLAYER_LIMIT } from "@td/server/protocol";
import { MAP_IDS, PLAYER_COLORS } from "@td/sim";
import { cssColor } from "./colors";
import type { NetStore } from "../net/store";

export interface LobbyActions {
  create(name: string, isPrivate: boolean, map: string): Promise<void>;
  join(code: string, name: string): Promise<void>;
  listRooms(): Promise<RoomMetadata[]>;
  start(): void;
  kick(playerId: number): void;
  leave(): Promise<void>;
  setReady(ready: boolean): void;
  setColor(color: number): void;
}

export function Lobby(props: { net: NetStore; actions: LobbyActions; defaultName: string; initialCode?: string | undefined }) {
  return (
    <Show when={props.net.roomInfo()} fallback={<Menu {...props} />}>
      {(info) => <RoomLobby net={props.net} actions={props.actions} info={info()} />}
    </Show>
  );
}

function Menu(props: { net: NetStore; actions: LobbyActions; defaultName: string; initialCode?: string | undefined }) {
  const [name, setName] = createSignal(props.defaultName);
  const [code, setCode] = createSignal(props.initialCode ?? "");
  const [map, setMap] = createSignal<string>(MAP_IDS[0]!);
  const [rooms, setRooms] = createSignal<RoomMetadata[]>([]);
  const refresh = async (): Promise<void> => {
    try {
      setRooms(await props.actions.listRooms());
    } catch {
      props.net.setError((current) => current ?? "No se pudo conectar con el servidor");
    }
  };
  onMount(() => void refresh());
  return (
    <div class="lobby">
      <h2>Likeus TD · Co-op</h2>
      <label class="field">
        Nombre
        <input type="text" maxLength={16} value={name()} onInput={(e) => setName(e.currentTarget.value)} />
      </label>
      <label class="field">
        Mapa
        <select value={map()} onChange={(e) => setMap(e.currentTarget.value)}>
          <For each={MAP_IDS}>{(id) => <option value={id}>{id}</option>}</For>
        </select>
      </label>
      <div class="row">
        <button type="button" disabled={props.net.busy()} onClick={() => void props.actions.create(name(), false, map())}>
          Crear sala pública
        </button>
        <button type="button" disabled={props.net.busy()} onClick={() => void props.actions.create(name(), true, map())}>
          Crear sala privada
        </button>
      </div>
      <form
        class="row"
        onSubmit={(e) => {
          e.preventDefault();
          void props.actions.join(code().toUpperCase(), name());
        }}
      >
        <input
          type="text"
          placeholder="CÓDIGO"
          maxLength={4}
          class="code-input"
          value={code()}
          onInput={(e) => setCode(e.currentTarget.value.toUpperCase())}
        />
        <button type="submit" disabled={props.net.busy() || code().length !== 4}>
          Unirse
        </button>
      </form>
      <div class="row between">
        <span>Salas públicas</span>
        <button type="button" class="small" onClick={() => void refresh()}>
          Actualizar
        </button>
      </div>
      <ul class="rooms">
        <For each={rooms()} fallback={<li class="muted">No hay salas públicas abiertas</li>}>
          {(room) => (
            <li>
              <span class="code">{room.code}</span>
              <span>
                {room.map} · {room.players}/{PLAYER_LIMIT} asientos · {room.connected} conectado{room.connected === 1 ? "" : "s"} ·{" "}
                {room.phase === "lobby" ? "en espera" : `oleada ${room.wave}`}
              </span>
              <button type="button" class="small" disabled={props.net.busy()} onClick={() => void props.actions.join(room.code, name())}>
                Unirse
              </button>
            </li>
          )}
        </For>
      </ul>
      <Show when={props.net.error()}>{(msg) => <p class="error">{msg()}</p>}</Show>
      <p class="muted">
        <a href="?">Volver al modo solo</a>
      </p>
    </div>
  );
}

function RoomLobby(props: { net: NetStore; actions: LobbyActions; info: NonNullable<ReturnType<NetStore["roomInfo"]>> }) {
  const isCreator = () => props.info.you === props.info.creator;
  const me = () => props.info.players.find((p) => p.playerId === props.info.you);
  const notReady = () => props.info.players.filter((p) => p.playerId !== props.info.creator && p.connected && !p.ready);
  return (
    <div class="lobby">
      <h2>
        Sala <span class="code big">{props.info.code}</span>
      </h2>
      <p class="muted">Compartí el código o el link para que se unan hasta {PLAYER_LIMIT} jugadores.</p>
      <ul class="players">
        <For each={props.info.players}>
          {(p) => (
            <li classList={{ offline: !p.connected }}>
              <span style={{ color: cssColor(PLAYER_COLORS[p.color] ?? PLAYER_COLORS[0]) }}>
                {p.name}
                {p.playerId === props.info.creator ? " (anfitrión)" : ""}
                {p.playerId === props.info.you ? " (vos)" : ""}
              </span>
              <span class="muted">
                {p.connected ? "conectado" : "desconectado"}
                {p.playerId !== props.info.creator && p.connected ? (p.ready ? " · listo" : " · no listo") : ""}
              </span>
              <Show when={isCreator() && p.playerId !== props.info.you}>
                <button type="button" class="small" onClick={() => props.actions.kick(p.playerId)}>
                  Expulsar
                </button>
              </Show>
            </li>
          )}
        </For>
      </ul>
      <div class="row swatches">
        <span class="muted">Tu color</span>
        <For each={[...PLAYER_COLORS.keys()]}>
          {(color) => (
            <button
              type="button"
              class="swatch"
              classList={{ selected: me()?.color === color }}
              disabled={props.info.players.some((p) => p.playerId !== props.info.you && p.color === color)}
              style={{ background: cssColor(PLAYER_COLORS[color]!) }}
              title={`Color ${color + 1}`}
              onClick={() => props.actions.setColor(color)}
            />
          )}
        </For>
      </div>
      <div class="row">
        <Show
          when={isCreator()}
          fallback={
            <button type="button" class="primary" onClick={() => props.actions.setReady(!me()?.ready)}>
              {me()?.ready ? "Listo ✓ (cancelar)" : "Listo"}
            </button>
          }
        >
          <button type="button" class="primary" disabled={notReady().length > 0} onClick={() => props.actions.start()}>
            Empezar
          </button>
          <Show when={notReady().length > 0}>
            <span class="muted">
              Falta que estén listos:{" "}
              {notReady()
                .map((p) => p.name)
                .join(", ")}
            </span>
          </Show>
        </Show>
        <button type="button" onClick={() => void props.actions.leave()}>
          Salir
        </button>
      </div>
      <Show when={props.net.error()}>{(msg) => <p class="error">{msg()}</p>}</Show>
    </div>
  );
}
