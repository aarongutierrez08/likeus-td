import { DOCTRINES, TOWERS } from "@td/sim";
import { For, Show, createSignal, onMount, untrack } from "solid-js";
import { deleteAccount, loadHistory, loginUrl, logout, updateProfile, type HistoryItem, type Profile } from "../net/account";

const PROVIDER_LABELS: Record<string, string> = { discord: "Discord", google: "Google", fake: "Prueba (solo desarrollo)" };
const MODE_LABELS: Record<string, string> = { campaign: "campaña", endless: "infinito" };

function date(ms: number): string {
  return new Date(ms).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

/** "Perfil" button and its panel: name, level, linking, history with replays, logout and account deletion. */
export function ProfileButton(props: {
  profile: () => Profile | null;
  setProfile: (p: Profile | null) => void;
  /** What the provider said on the way back from logging in; shown once, cleared when the panel closes. */
  notice: () => string | null;
  clearNotice: () => void;
}) {
  const [open, setOpen] = createSignal(false);
  const [history, setHistory] = createSignal<HistoryItem[] | null>(null);
  const [name, setName] = createSignal("");
  const openPanel = () => {
    setOpen(true);
    setName(props.profile()?.name ?? "");
    void loadHistory().then(setHistory);
  };
  const close = () => {
    setOpen(false);
    props.clearNotice();
  };
  onMount(() => {
    if (untrack(props.notice) !== null) openPanel();
  });
  const save = async () => {
    const updated = await updateProfile({ name: name() });
    if (updated) props.setProfile(updated);
  };
  const remove = async () => {
    if (!confirm("¿Borrar tus datos con todo tu historial? No se puede deshacer.")) return;
    if (await deleteAccount()) location.reload();
  };
  const leave = async () => {
    await logout();
    location.reload();
  };
  return (
    <>
      <button type="button" class="profile-button" onClick={() => (open() ? close() : openPanel())}>
        <Show when={props.profile()} fallback="Perfil">
          {(p) => `${p().name} · nivel ${p().level}`}
        </Show>
      </button>
      <Show when={open()}>
        <div class="profile-panel">
          <Show when={props.notice()}>{(n) => <p class="notice">{n()}</p>}</Show>
          <Show
            when={props.profile()}
            fallback={
              <p class="muted">Las cuentas no están disponibles ahora: jugás como invitado igual, pero esta partida no queda guardada.</p>
            }
          >
            {(p) => (
              <>
                <div class="row">
                  <input type="text" maxLength={16} value={name()} onInput={(e) => setName(e.currentTarget.value)} aria-label="Nombre" />
                  <button type="button" onClick={() => void save()} disabled={!name().trim() || name() === p().name}>
                    Guardar
                  </button>
                </div>
                <p>
                  Nivel {p().level} · {p().xp} de experiencia
                </p>
                <progress max={p().nextLevelXp - p().levelXp} value={p().xp - p().levelXp} />
                <Show
                  when={p().kind === "account"}
                  fallback={
                    <div class="row">
                      <span class="muted">Jugás como invitado. Vinculá una cuenta para no perder tu progreso:</span>
                      <For each={p().providers}>
                        {(provider) => (
                          <button type="button" onClick={() => location.assign(loginUrl(provider))}>
                            {PROVIDER_LABELS[provider] ?? provider}
                          </button>
                        )}
                      </For>
                      <button type="button" class="danger" onClick={() => void remove()}>
                        Borrar mis datos
                      </button>
                    </div>
                  }
                >
                  <div class="row">
                    <span class="muted">Cuenta vinculada con {PROVIDER_LABELS[p().provider ?? ""] ?? p().provider}</span>
                    <button type="button" onClick={() => void leave()}>
                      Cerrar sesión
                    </button>
                    <button type="button" class="danger" onClick={() => void remove()}>
                      Borrar cuenta
                    </button>
                  </div>
                </Show>
                <h4>Historial</h4>
                <ul class="history">
                  <For
                    each={history() ?? []}
                    fallback={<li class="muted">{history() === null ? "Cargando…" : "Todavía no jugaste partidas"}</li>}
                  >
                    {(g) => (
                      <li>
                        <span>
                          {date(g.playedAt)} · {MODE_LABELS[g.mode] ?? g.mode} · {g.map} · {g.result === "won" ? "victoria" : "derrota"} en
                          la oleada {g.wave} · {g.players.join(", ")} · +{g.xp}
                          <small class="muted">
                            {" "}
                            seed {g.seed}
                            {g.deck ? ` · mazo: ${g.deck.towers.map((t) => TOWERS[t].label).join(", ")}` : ""}
                            {g.doctrines.length > 0 ? ` · doctrinas: ${g.doctrines.map((d) => DOCTRINES[d].label).join(", ")}` : ""}
                          </small>
                        </span>
                        <a href={`?replay=${g.replayId}`}>Ver replay</a>
                      </li>
                    )}
                  </For>
                </ul>
              </>
            )}
          </Show>
          <button type="button" onClick={close}>
            Cerrar
          </button>
        </div>
      </Show>
    </>
  );
}
