import { DECK, deckProblem, findPlayer, type Deck, type GameState } from "@td/sim";
import type { DeckMode, HistoryEntry, HistoryItem, Profile, SoloResultMessage, SoloSubmission } from "../protocol";
import { cleanName, dailyBoard, memoryBoard, replaySolo, todayUtc, type BoardStore } from "../solo";
import { newState, providersFromEnv, type Provider } from "./providers";
import { RETENTION } from "./retention";
import { AccountStore, type Subject } from "./store";
import { gameXp, levelOf, xpForLevel } from "./xp";

/**
 * An OAuth round trip in flight: whose session links, where to send the browser back, and the nonce only the browser
 * that started it holds in a cookie, so a provider URL handed to someone else cannot link their identity to this session.
 */
interface PendingLogin {
  token: string;
  provider: string;
  nonce: string;
  returnTo: string;
  expires: number;
}

/**
 * An identity the provider vouched for, waiting for the browser to claim it with its own session. Linking only on that
 * claim means a login link started with someone else's session can never move this browser's account into theirs.
 */
interface PendingClaim {
  token: string;
  provider: string;
  id: string;
  name: string;
  expires: number;
}

const CLAIM_TTL_MS = 60_000;

/**
 * A one-use ticket that starts a provider login. The browser asks for it with its session in a header, then navigates
 * with the ticket in the address: the session itself never shows up in an address, a log or the browser history.
 */
interface LoginTicket {
  token: string;
  provider: string;
  returnTo: string;
  expires: number;
}

const TICKET_TTL_MS = 60_000;
const PURGE_EVERY_MS = 60 * 60_000;
const DECK_TOWERS: Record<DeckMode, number> = { solo: DECK.soloTowers, coop: DECK.coopTowers };

export const LOGIN_COOKIE = "td_login";

const LOGIN_TTL_MS = 10 * 60_000;

export interface AccountsConfig {
  /** SQLite file, or ":memory:" in tests. */
  dbPath: string;
  /** This server's public base URL, for OAuth callbacks. */
  publicUrl: string;
  /** Origins the browser may be sent back to after logging in. */
  clientOrigins: string[];
  env: NodeJS.ProcessEnv;
}

export interface FinishedRoomPlayer {
  /** Session token the player joined with; null for players the accounts service does not know. */
  token: string | null;
  name: string;
  /** Their seat in the sim, for the deck and doctrines they played. */
  playerId: number;
}

/** One player the game is recorded for. */
interface Recorded {
  subjectId: number;
  name: string;
  playerId: number;
}

export type HttpResult = { status: number; body?: unknown; redirect?: string; cookie?: string };

const ok = (body: unknown): HttpResult => ({ status: 200, body });
const fail = (status: number, error: string): HttpResult => ({ status, body: { error } });

/**
 * Guests, accounts, history and experience. Only the server decides what gets recorded: co-op games it ran itself and
 * solo games it replayed itself. When the database cannot be used every call answers "unavailable" and nothing else breaks.
 */
export class Accounts {
  private readonly store: AccountStore | null;
  private readonly providers: Map<string, Provider>;
  private readonly pending = new Map<string, PendingLogin>();
  private readonly claims = new Map<string, PendingClaim>();
  private readonly tickets = new Map<string, LoginTicket>();
  private readonly purgeTimer: NodeJS.Timeout;

  constructor(private readonly config: AccountsConfig) {
    this.providers = providersFromEnv(config.env);
    let store: AccountStore | null = null;
    try {
      store = new AccountStore(config.dbPath);
    } catch (err) {
      console.error(`accounts unavailable: ${String(err)}`);
    }
    this.store = store;
    this.purge();
    this.purgeTimer = setInterval(() => this.purge(), PURGE_EVERY_MS).unref();
  }

  /** Drops expired replays, idle guests and idle sessions; runs on start and every hour. */
  purge(now = Date.now()): void {
    if (!this.store) return;
    try {
      const purged = this.store.purge(now);
      if (purged.replays + purged.guests + purged.sessions > 0)
        console.log(`accounts purge: ${purged.replays} replays, ${purged.guests} guests, ${purged.sessions} sessions`);
    } catch (err) {
      console.error(`accounts purge failed: ${String(err)}`);
    }
  }

  get available(): boolean {
    return this.store !== null;
  }

  /** The daily boards: in the database when it is up, in memory when it is not or when it breaks mid-run. */
  get boards(): BoardStore {
    const store = this.store;
    if (!store) return memoryBoard;
    const fallback = <T>(work: () => T, otherwise: () => T): T => {
      try {
        return work();
      } catch (err) {
        console.error(`accounts error: ${String(err)}`);
        return otherwise();
      }
    };
    return {
      addDaily: (day, entry) =>
        fallback(
          () => store.addDaily(day, entry),
          () => memoryBoard.addDaily(day, entry),
        ),
      dailyTop: (day, limit) =>
        fallback(
          () => store.dailyTop(day, limit),
          () => memoryBoard.dailyTop(day, limit),
        ),
    };
  }

  private subjectOf(token: string | null): Subject | null {
    if (!token || !this.store) return null;
    try {
      return this.store.subjectByToken(token);
    } catch (err) {
      console.error(`accounts error: ${String(err)}`);
      return null;
    }
  }

  private guard(work: (store: AccountStore) => HttpResult): HttpResult {
    if (!this.store) return fail(503, "las cuentas no están disponibles");
    try {
      return work(this.store);
    } catch (err) {
      console.error(`accounts error: ${String(err)}`);
      return fail(503, "las cuentas no están disponibles");
    }
  }

  private profileOf(subject: Subject): Profile {
    const level = levelOf(subject.xp);
    return {
      kind: subject.kind,
      linked: subject.linked,
      name: subject.name,
      xp: subject.xp,
      level,
      levelXp: xpForLevel(level),
      nextLevelXp: xpForLevel(level + 1),
      providers: [...this.providers.keys()],
      decks: subject.decks,
      retention: { replayDays: RETENTION.replayDays, idleGuestDays: RETENTION.idleGuestDays, emptyGuestDays: RETENTION.emptyGuestDays },
    };
  }

  private withSubject(token: string | null, work: (store: AccountStore, subject: Subject) => HttpResult): HttpResult {
    return this.guard((store) => {
      const subject = token ? store.subjectByToken(token) : null;
      return subject ? work(store, subject) : fail(401, "sesión inválida");
    });
  }

  createGuest(name: unknown, now = Date.now()): HttpResult {
    return this.guard((store) => {
      const { token, subject } = store.createGuest(cleanName(name) === "Anónimo" ? "Jugador" : cleanName(name), now);
      return ok({ token, profile: this.profileOf(subject) });
    });
  }

  me(token: string | null): HttpResult {
    return this.withSubject(token, (_store, subject) => ok(this.profileOf(subject)));
  }

  update(token: string | null, body: { name?: unknown; deck?: { mode?: unknown; deck?: unknown } }): HttpResult {
    return this.withSubject(token, (store, subject) => {
      if (body?.deck !== undefined) {
        const mode = body.deck?.mode;
        const deck = body.deck?.deck as Deck | undefined;
        if ((mode !== "solo" && mode !== "coop") || deckProblem(deck, DECK_TOWERS[mode]) !== null) return fail(400, "mazo inválido");
        store.setDeck(subject.id, mode, { towers: [...deck!.towers], abilities: [...deck!.abilities] });
      }
      if (body?.name !== undefined) store.rename(subject.id, cleanName(body.name));
      return ok(this.profileOf(store.subject(subject.id)!));
    });
  }

  history(token: string | null): HttpResult {
    return this.withSubject(token, (store, subject) => {
      const items: HistoryItem[] = store
        .history(subject.id)
        .map(({ playedAt, mode, map, seed, players, result, wave, xp, replayId, replayExpiresAt, deck, doctrines }) => ({
          playedAt,
          mode,
          map,
          seed,
          players,
          deck,
          doctrines,
          result,
          wave,
          xp,
          replayId,
          replayExpiresAt,
        }));
      return ok(items);
    });
  }

  logout(token: string | null): HttpResult {
    return this.withSubject(token, (store) => {
      store.logout(token!);
      return ok({});
    });
  }

  deleteAccount(token: string | null): HttpResult {
    return this.withSubject(token, (store, subject) => {
      store.deleteSubject(subject.id);
      return ok({});
    });
  }

  replay(id: number): HttpResult {
    return this.guard((store) => {
      const data = Number.isInteger(id) ? store.replay(id) : null;
      return data ? ok(data) : fail(404, "replay inexistente");
    });
  }

  /** The browser holding this session asks to log in with a provider: it gets the address to go to, with a one-use ticket. */
  loginTicket(provider: string, token: string | null, returnTo: unknown, now = Date.now()): HttpResult {
    if (!this.providers.has(provider)) return fail(404, "proveedor no disponible");
    if (
      typeof returnTo !== "string" ||
      !this.config.clientOrigins.some((o) => returnTo === o || returnTo.startsWith(`${o}/`) || returnTo.startsWith(`${o}?`))
    )
      return fail(400, "dirección de vuelta no permitida");
    return this.withSubject(token, () => {
      for (const [id, ticket] of this.tickets) if (ticket.expires < now || ticket.token === token) this.tickets.delete(id);
      const id = newState();
      this.tickets.set(id, { token: token!, provider, returnTo, expires: now + TICKET_TTL_MS });
      return ok({ url: `${this.config.publicUrl}/auth/${provider}/start?ticket=${id}` });
    });
  }

  /** The browser arrives with its ticket: off to the provider, holding the nonce the callback will ask for. */
  startLogin(provider: string, ticketId: string | null, now = Date.now()): HttpResult {
    const p = this.providers.get(provider);
    const ticket = ticketId ? this.tickets.get(ticketId) : undefined;
    if (ticketId) this.tickets.delete(ticketId);
    if (!p || !ticket || ticket.provider !== provider || ticket.expires < now) {
      const home = ticket?.returnTo ?? `${this.config.clientOrigins[0] ?? ""}/`;
      return { status: 302, redirect: `${home}#login=error` };
    }
    for (const [state, login] of this.pending) if (login.expires < now || login.token === ticket.token) this.pending.delete(state);
    const state = newState();
    const nonce = newState();
    this.pending.set(state, { token: ticket.token, provider, nonce, returnTo: ticket.returnTo, expires: now + LOGIN_TTL_MS });
    return { status: 302, redirect: p.authorizeUrl(state, this.callbackUrl(provider)), cookie: this.loginCookie(nonce) };
  }

  /** The login nonce cookie; a max age of 0 clears it once the round trip is over. */
  private loginCookie(nonce: string, maxAge = LOGIN_TTL_MS / 1000): string {
    const secure = this.config.publicUrl.startsWith("https:") ? "; Secure" : "";
    return `${LOGIN_COOKIE}=${nonce}; Path=/auth; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
  }

  /** The provider sends the browser back: keep the identity it vouched for and send the browser home to claim it. */
  async finishLogin(
    provider: string,
    code: string | null,
    state: string | null,
    nonce: string | null,
    now = Date.now(),
  ): Promise<HttpResult> {
    const p = this.providers.get(provider);
    const login = state ? this.pending.get(state) : undefined;
    if (state) this.pending.delete(state);
    const problem = !p
      ? "unknown provider"
      : !login
        ? "no login started with this state (opened directly, or the server restarted)"
        : login.provider !== provider
          ? "state started with another provider"
          : login.nonce !== nonce
            ? `login cookie ${nonce ? "does not match" : "missing"} (finished in another browser, or a newer login replaced it)`
            : login.expires < now
              ? "expired"
              : !code
                ? "the provider sent no code (cancelled or refused)"
                : null;
    if (problem || !p || !login || !code) {
      // Back to the game with a notice, not a bare error page; the reason stays in the server log.
      console.warn(`login with ${provider} rejected: ${problem}`);
      const home = login?.returnTo ?? `${this.config.clientOrigins[0] ?? ""}/`;
      return { status: 302, redirect: `${home}#login=error`, cookie: this.loginCookie("", 0) };
    }
    let identity;
    try {
      identity = await p.identify(code, this.callbackUrl(provider));
      if (!identity.id) throw new Error("the provider sent no user id");
    } catch (err) {
      console.error(`login with ${provider} failed: ${String(err)}`);
      return { status: 302, redirect: `${login.returnTo}#login=error`, cookie: this.loginCookie("", 0) };
    }
    for (const [key, claim] of this.claims) if (claim.expires < now) this.claims.delete(key);
    const claim = newState();
    this.claims.set(claim, { token: login.token, provider, id: identity.id, name: cleanName(identity.name), expires: now + CLAIM_TTL_MS });
    return { status: 302, redirect: `${login.returnTo}#claim=${claim}`, cookie: this.loginCookie("", 0) };
  }

  /** The browser back from the provider claims the identity, with its own session: only the session that started it may. */
  claimLogin(token: string | null, claimId: unknown, now = Date.now()): HttpResult {
    const claim = typeof claimId === "string" ? this.claims.get(claimId) : undefined;
    if (claim) this.claims.delete(claimId as string);
    if (!claim || claim.expires < now || claim.token !== token) return fail(400, "vinculación inválida o vencida");
    return this.withSubject(token, (store) => {
      const linked = store.link(claim.token, claim.provider, claim.id, claim.name, now);
      return linked ? ok(this.profileOf(linked)) : fail(409, "esa cuenta ya tiene ese proveedor vinculado");
    });
  }

  private callbackUrl(provider: string): string {
    return `${this.config.publicUrl}/auth/${provider}/callback`;
  }

  /** A solo game: replayed here; recorded for the session's owner when there is one. Daily games also go on the board. */
  submitSolo(token: string | null, submission: SoloSubmission, now = new Date()): HttpResult {
    const subject = this.subjectOf(token);
    const sender = subject ? { key: `subject:${subject.id}`, name: subject.name } : null;
    const result = replaySolo(submission, this.boards, now, sender);
    if (typeof result === "string") return fail(400, result);
    const board = submission.kind === "daily" ? dailyBoard(this.boards, submission.day) : null;
    let xp: number | null = null;
    if (subject) {
      try {
        xp = this.record([{ subjectId: subject.id, name: subject.name, playerId: 0 }], result.start, result.final, submission.history, now);
      } catch (err) {
        console.error(`accounts error: ${String(err)}`);
      }
    }
    const message: SoloResultMessage = { xp, board };
    return ok(message);
  }

  /** A co-op game the server ran to its end: every player it knows gets the game in their history and its experience. */
  recordRoom(players: FinishedRoomPlayer[], start: GameState, final: GameState, history: HistoryEntry[], now = new Date()): void {
    if (!this.store || !final.ranked || final.status === "playing") return;
    try {
      // One person in several seats (tabs of one browser) is recorded once and counts once for the group bonus.
      const known = new Map<number, Recorded>();
      let strangers = 0;
      for (const p of players) {
        const subject = p.token ? this.store.subjectByToken(p.token) : null;
        if (!subject) strangers++;
        else if (!known.has(subject.id)) known.set(subject.id, { subjectId: subject.id, name: p.name, playerId: p.playerId });
      }
      if (known.size > 0)
        this.record(
          [...known.values()],
          start,
          final,
          history,
          now,
          players.map((p) => p.name),
          known.size + strangers,
        );
    } catch (err) {
      console.error(`accounts error: ${String(err)}`);
    }
  }

  /** Stores the replay once and the game once per player. Returns the experience the first player was paid. */
  private record(
    players: Recorded[],
    start: GameState,
    final: GameState,
    history: HistoryEntry[],
    now: Date,
    names: string[] = players.map((p) => p.name),
    group: number = players.length,
  ): number {
    const store = this.store!;
    const replayId = store.saveReplay({ initialState: start, history }, now.getTime());
    const won = final.status === "won";
    const earned = gameXp({ wave: final.wave, won, players: group });
    const game = {
      playedAt: now.getTime(),
      day: todayUtc(now),
      mode: final.mode,
      map: final.mapId,
      seed: final.seed,
      players: names,
      result: won ? ("won" as const) : ("lost" as const),
      wave: final.wave,
      xp: earned,
    };
    let first = 0;
    players.forEach((p, i) => {
      const seat = findPlayer(final, p.playerId);
      const paid = store.recordGame(p.subjectId, game, replayId, { deck: seat?.deck ?? null, doctrines: seat?.doctrines ?? [] });
      if (i === 0) first = paid;
    });
    return first;
  }

  close(): void {
    clearInterval(this.purgeTimer);
    this.store?.close();
  }
}

let current: Accounts | null = null;

/** The accounts service this process runs with; rooms ask for it when a game ends. */
export function setAccounts(accounts: Accounts | null): void {
  current = accounts;
}

export function getAccounts(): Accounts | null {
  return current;
}
