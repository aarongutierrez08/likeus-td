import { For, Show, createSignal } from "solid-js";
import type { RoomMetadata } from "@td/server/protocol";
import { PLAYER_LIMIT } from "@td/server/protocol";
import type { NetStore } from "../net/store";

export interface LobbyActions {
  create(name: string, isPrivate: boolean): Promise<void>;
  join(code: string, name: string): Promise<void>;
  listRooms(): Promise<RoomMetadata[]>;
  start(): void;
  kick(playerId: number): void;
  leave(): Promise<void>;
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
  const [rooms, setRooms] = createSignal<RoomMetadata[]>([]);
  const refresh = async (): Promise<void> => {
    try {
      setRooms(await props.actions.listRooms());
    } catch {
      props.net.setError((current) => current ?? "No se pudo conectar con el servidor");
    }
  };
  void refresh();
  return (
    <div class="lobby">
      <h2>Likeus TD · Co-op</h2>
      <label class="field">
        Nombre
        <input type="text" maxLength={16} value={name()} onInput={(e) => setName(e.currentTarget.value)} />
      </label>
      <div class="row">
        <button type="button" disabled={props.net.busy()} onClick={() => void props.actions.create(name(), false)}>
          Crear sala pública
        </button>
        <button type="button" disabled={props.net.busy()} onClick={() => void props.actions.create(name(), true)}>
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
                {room.players}/{PLAYER_LIMIT} · {room.phase === "lobby" ? "en espera" : `oleada ${room.wave}`}
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
              <span>
                {p.name}
                {p.playerId === props.info.creator ? " (anfitrión)" : ""}
                {p.playerId === props.info.you ? " (vos)" : ""}
              </span>
              <span class="muted">{p.connected ? "conectado" : "desconectado"}</span>
              <Show when={isCreator() && p.playerId !== props.info.you}>
                <button type="button" class="small" onClick={() => props.actions.kick(p.playerId)}>
                  Expulsar
                </button>
              </Show>
            </li>
          )}
        </For>
      </ul>
      <div class="row">
        <Show when={isCreator()} fallback={<span class="muted">Esperando a que el anfitrión empiece…</span>}>
          <button type="button" class="primary" onClick={() => props.actions.start()}>
            Empezar
          </button>
        </Show>
        <button type="button" onClick={() => void props.actions.leave()}>
          Salir
        </button>
      </div>
      <Show when={props.net.error()}>{(msg) => <p class="error">{msg()}</p>}</Show>
    </div>
  );
}
