import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gunzipSync, gzipSync } from "node:zlib";
import type { Deck, DoctrineKind } from "@td/sim";
import type { DailyEntry, DeckMode } from "../protocol";
import { RETENTION, daysMs } from "./retention";
import { cappedXp } from "./xp";

/**
 * A guest (one per browser) or an account. Guests turn into accounts when they link a provider; an account may hold
 * several ways in (Discord and Google), and logging in with any of them opens it.
 */
export interface Subject {
  id: number;
  kind: "guest" | "account";
  /** Providers this account can log in with, in the order they were linked. */
  linked: string[];
  name: string;
  xp: number;
  /** The last deck played per mode, so it follows the account to another browser. */
  decks: Partial<Record<DeckMode, Deck>>;
}

export interface GameRecord {
  id: number;
  playedAt: number;
  mode: string;
  map: string;
  seed: number;
  /** Names of everyone who played, this player included. */
  players: string[];
  result: "won" | "lost";
  wave: number;
  xp: number;
  /** Null once the replay expired. */
  replayId: number | null;
  replayExpiresAt: number | null;
  deck: Deck | null;
  doctrines: DoctrineKind[];
}

export interface NewGame {
  playedAt: number;
  day: string;
  mode: string;
  map: string;
  seed: number;
  players: string[];
  result: "won" | "lost";
  wave: number;
  xp: number;
}

const MAX_DAILY_ENTRIES = 100;

const SCHEMA = `
create table if not exists subjects (
  id integer primary key autoincrement,
  kind text not null,
  name text not null,
  xp integer not null default 0,
  created integer not null,
  last_active integer not null,
  decks text
);
create table if not exists identities (
  provider text not null,
  provider_id text not null,
  subject_id integer not null,
  linked integer not null,
  primary key (provider, provider_id)
);
create table if not exists sessions (token text primary key, subject_id integer not null, last_used integer not null);
create table if not exists replays (id integer primary key autoincrement, data blob not null, created integer not null);
create table if not exists games (
  id integer primary key autoincrement,
  subject_id integer not null,
  played_at integer not null,
  mode text not null,
  map text not null,
  seed integer not null,
  players text not null,
  result text not null,
  wave integer not null,
  xp integer not null,
  replay_id integer not null,
  deck text,
  doctrines text not null default '[]'
);
create table if not exists xp_days (subject_id integer not null, day text not null, xp integer not null, primary key (subject_id, day));
create table if not exists daily (day text not null, name text not null, score integer not null, ticks integer not null);
`;

interface SubjectRow {
  id: number;
  kind: "guest" | "account";
  name: string;
  xp: number;
  decks: string | null;
}

/** What a purge removed, for the server log. */
export interface Purged {
  replays: number;
  guests: number;
  sessions: number;
}

/**
 * Everything accounts keep, in one SQLite file (node:sqlite, no extra service). Every method is synchronous and small;
 * callers treat a thrown error as "accounts are down" and keep the game going without them.
 */
export class AccountStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(SCHEMA);
    this.addMissingColumns();
    this.moveIdentities();
  }

  /** Databases from when an account had a single provider kept it on the subject: move it to identities, once. */
  private moveIdentities(): void {
    const columns = (this.db.prepare("pragma table_info(subjects)").all() as { name: string }[]).map((c) => c.name);
    if (!columns.includes("provider")) return;
    this.db.exec(
      "insert or ignore into identities (provider, provider_id, subject_id, linked) select provider, provider_id, id, created from subjects where provider is not null",
    );
    this.db.exec("update subjects set provider = null, provider_id = null where provider is not null");
  }

  /**
   * Older databases get the columns added since, all in one transaction. The new dates start at the moment of the
   * migration, written as the column default so no row is ever left without one: nothing that already existed is purged
   * the day this version starts.
   */
  private addMissingColumns(): void {
    const columnsOf = (table: string) => (this.db.prepare(`pragma table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
    const now = Date.now();
    const add = (table: string, column: string, definition: string) => {
      if (!columnsOf(table).includes(column)) this.db.exec(`alter table ${table} add column ${column} ${definition}`);
    };
    this.inTransaction(() => {
      add("games", "deck", "text");
      add("games", "doctrines", "text not null default '[]'");
      add("subjects", "decks", "text");
      add("subjects", "last_active", `integer not null default ${now}`);
      add("sessions", "last_used", `integer not null default ${now}`);
      add("replays", "created", `integer not null default ${now}`);
    });
  }

  createGuest(name: string, now: number): { token: string; subject: Subject } {
    const id = Number(
      this.db.prepare("insert into subjects (kind, name, created, last_active) values ('guest', ?, ?, ?)").run(name, now, now)
        .lastInsertRowid,
    );
    return { token: this.newSession(id, now), subject: this.subject(id)! };
  }

  /** The session's subject; a session unused for too long no longer opens anything. Using it keeps it alive. */
  subjectByToken(token: string, now = Date.now()): Subject | null {
    const row = this.db.prepare("select subject_id, last_used from sessions where token = ?").get(token) as
      { subject_id: number; last_used: number } | undefined;
    if (!row || row.last_used < now - daysMs(RETENTION.idleSessionDays)) return null;
    if (row.last_used < now - daysMs(1)) this.db.prepare("update sessions set last_used = ? where token = ?").run(now, token);
    return this.subject(row.subject_id);
  }

  subject(id: number): Subject | null {
    const row = this.db.prepare("select id, kind, name, xp, decks from subjects where id = ?").get(id) as SubjectRow | undefined;
    if (!row) return null;
    const linked = this.db.prepare("select provider from identities where subject_id = ? order by linked, rowid").all(id) as {
      provider: string;
    }[];
    const decks = row.decks ? (JSON.parse(row.decks) as Partial<Record<DeckMode, Deck>>) : {};
    return { id: row.id, kind: row.kind, name: row.name, xp: row.xp, decks, linked: [...new Set(linked.map((l) => l.provider))] };
  }

  rename(id: number, name: string): void {
    this.db.prepare("update subjects set name = ? where id = ?").run(name, id);
  }

  setDeck(id: number, mode: DeckMode, deck: Deck): void {
    const decks = { ...this.subject(id)?.decks, [mode]: deck };
    this.db.prepare("update subjects set decks = ? where id = ?").run(JSON.stringify(decks), id);
  }

  /**
   * The browser's session links a provider identity it just proved it owns.
   * - A new identity joins the session's subject: a guest becomes an account, an account gains another way in.
   * - An identity of another account: the two become one. A guest moves into that account; an account the browser was
   *   already using keeps going and takes the other in. Either way the session now speaks for the result.
   */
  link(token: string, provider: string, providerId: string, providerName: string, now = Date.now()): Subject | null {
    return this.inTransaction(() => {
      const current = this.subjectByToken(token);
      if (!current) return null;
      const owner = this.db
        .prepare("select subject_id from identities where provider = ? and provider_id = ?")
        .get(provider, providerId) as { subject_id: number } | undefined;
      if (!owner) {
        // One way in per provider: a second Discord on the same account would only be a mistake to undo later.
        if (current.linked.includes(provider)) return null;
        this.db
          .prepare("insert into identities (provider, provider_id, subject_id, linked) values (?, ?, ?, ?)")
          .run(provider, providerId, current.id, now);
        if (current.kind === "guest") {
          this.db.prepare("update subjects set kind = 'account' where id = ?").run(current.id);
          if (current.name.startsWith("Jugador")) this.rename(current.id, providerName);
        }
        return this.subject(current.id);
      }
      if (owner.subject_id === current.id) return current;
      const [from, to] = current.kind === "guest" ? [current.id, owner.subject_id] : [owner.subject_id, current.id];
      const toLinked = this.subject(to)?.linked ?? [];
      if (this.subject(from)?.linked.some((provider) => toLinked.includes(provider))) return null;
      this.mergeInto(from, to);
      return this.subject(to);
    });
  }

  /**
   * Moves everything one subject has into another: games, ways in, sessions and experience. Its days count against the
   * other's daily cap, so many guests or accounts merged into one earn no more than one would.
   */
  private mergeInto(from: number, to: number): void {
    this.db.prepare("update games set subject_id = ? where subject_id = ?").run(to, from);
    const days = this.db.prepare("select day, xp from xp_days where subject_id = ?").all(from) as { day: string; xp: number }[];
    // Experience earned before days were tracked was already paid under its own cap: it moves whole.
    const untracked = (this.subject(from)?.xp ?? 0) - days.reduce((sum, d) => sum + d.xp, 0);
    let moved = Math.max(0, untracked);
    for (const { day, xp } of days) {
      const paid = cappedXp(xp, this.dayXp(to, day));
      this.addDayXp(to, day, paid);
      moved += paid;
    }
    this.db.prepare("delete from xp_days where subject_id = ?").run(from);
    this.db.prepare("update subjects set xp = xp + ? where id = ?").run(moved, to);
    this.db.prepare("update sessions set subject_id = ? where subject_id = ?").run(to, from);
    this.db.prepare("update identities set subject_id = ? where subject_id = ?").run(to, from);
    this.db.prepare("delete from subjects where id = ?").run(from);
  }

  logout(token: string): void {
    this.db.prepare("delete from sessions where token = ?").run(token);
  }

  /** Removes the subject, its sessions and history, and the replays nobody else's history points at. */
  deleteSubject(id: number): void {
    this.inTransaction(() => this.removeSubject(id));
  }

  private removeSubject(id: number): void {
    const replays = this.db.prepare("select distinct replay_id from games where subject_id = ?").all(id) as { replay_id: number }[];
    this.db.prepare("delete from games where subject_id = ?").run(id);
    for (const { replay_id } of replays) {
      const used = this.db.prepare("select 1 from games where replay_id = ? limit 1").get(replay_id);
      if (!used) this.db.prepare("delete from replays where id = ?").run(replay_id);
    }
    this.db.prepare("delete from xp_days where subject_id = ?").run(id);
    this.db.prepare("delete from sessions where subject_id = ?").run(id);
    this.db.prepare("delete from identities where subject_id = ?").run(id);
    this.db.prepare("delete from subjects where id = ?").run(id);
  }

  /** Stored compressed: a game's JSON shrinks about five times. */
  saveReplay(data: unknown, now = Date.now()): number {
    const packed = gzipSync(JSON.stringify(data));
    return Number(this.db.prepare("insert into replays (data, created) values (?, ?)").run(packed, now).lastInsertRowid);
  }

  /** The replay, or null when it never existed or expired. Rows saved before compression are plain text. */
  replay(id: number): unknown {
    const row = this.db.prepare("select data from replays where id = ?").get(id) as { data: string | Uint8Array } | undefined;
    if (!row) return null;
    const text = typeof row.data === "string" ? row.data : gunzipSync(row.data).toString("utf8");
    return JSON.parse(text) as unknown;
  }

  /** Drops expired replays, idle guests and idle sessions. Accounts and their history are never purged. */
  purge(now = Date.now()): Purged {
    return this.inTransaction(() => {
      const replays = Number(this.db.prepare("delete from replays where created < ?").run(now - daysMs(RETENTION.replayDays)).changes);
      const guests = this.db
        .prepare(
          `select id from subjects where kind = 'guest' and (last_active < ?
             or (last_active < ? and not exists (select 1 from games where games.subject_id = subjects.id)))`,
        )
        .all(now - daysMs(RETENTION.idleGuestDays), now - daysMs(RETENTION.emptyGuestDays)) as { id: number }[];
      for (const { id } of guests) this.removeSubject(id);
      const sessions = Number(
        this.db.prepare("delete from sessions where last_used < ?").run(now - daysMs(RETENTION.idleSessionDays)).changes,
      );
      return { replays, guests: guests.length, sessions };
    });
  }

  /** Records a finished game for one player, paying experience up to the daily cap. Returns what was paid. */
  recordGame(subjectId: number, game: NewGame, replayId: number, play: { deck: Deck | null; doctrines: DoctrineKind[] }): number {
    return this.inTransaction(() => {
      const paid = cappedXp(game.xp, this.dayXp(subjectId, game.day));
      this.db
        .prepare(
          "insert into games (subject_id, played_at, mode, map, seed, players, result, wave, xp, replay_id, deck, doctrines) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          subjectId,
          game.playedAt,
          game.mode,
          game.map,
          game.seed,
          JSON.stringify(game.players),
          game.result,
          game.wave,
          paid,
          replayId,
          play.deck ? JSON.stringify(play.deck) : null,
          JSON.stringify(play.doctrines),
        );
      this.addDayXp(subjectId, game.day, paid);
      this.db.prepare("update subjects set xp = xp + ?, last_active = ? where id = ?").run(paid, game.playedAt, subjectId);
      return paid;
    });
  }

  history(subjectId: number, limit = 50): GameRecord[] {
    const rows = this.db
      .prepare(
        `select games.id, played_at, mode, map, seed, players, result, wave, xp, replay_id, deck, doctrines, replays.created as replay_created
         from games left join replays on replays.id = games.replay_id where subject_id = ? order by games.id desc limit ?`,
      )
      .all(subjectId, limit) as {
      id: number;
      played_at: number;
      mode: string;
      map: string;
      seed: number;
      players: string;
      result: "won" | "lost";
      wave: number;
      xp: number;
      replay_id: number;
      deck: string | null;
      doctrines: string;
      replay_created: number | null;
    }[];
    return rows.map((r) => ({
      id: r.id,
      playedAt: r.played_at,
      mode: r.mode,
      map: r.map,
      seed: r.seed,
      players: JSON.parse(r.players) as string[],
      result: r.result,
      wave: r.wave,
      xp: r.xp,
      replayId: r.replay_created === null ? null : r.replay_id,
      replayExpiresAt: r.replay_created === null ? null : r.replay_created + daysMs(RETENTION.replayDays),
      deck: r.deck ? (JSON.parse(r.deck) as Deck) : null,
      doctrines: JSON.parse(r.doctrines) as DoctrineKind[],
    }));
  }

  /** Keeps only the day's best entries, so the board stays small however many games come in. */
  addDaily(day: string, entry: DailyEntry): void {
    this.db.prepare("insert into daily (day, name, score, ticks) values (?, ?, ?, ?)").run(day, entry.name, entry.score, entry.ticks);
    this.db
      .prepare(
        "delete from daily where day = ? and rowid not in (select rowid from daily where day = ? order by score desc, ticks asc limit ?)",
      )
      .run(day, day, MAX_DAILY_ENTRIES);
  }

  dailyTop(day: string, limit: number): DailyEntry[] {
    return this.db
      .prepare("select name, score, ticks from daily where day = ? order by score desc, ticks asc limit ?")
      .all(day, limit) as unknown as DailyEntry[];
  }

  /** Runs several writes as one: a failure halfway leaves the database as it was, never half moved. */
  private inTransaction<T>(work: () => T): T {
    this.db.exec("begin");
    try {
      const result = work();
      this.db.exec("commit");
      return result;
    } catch (err) {
      this.db.exec("rollback");
      throw err;
    }
  }

  private dayXp(subjectId: number, day: string): number {
    const row = this.db.prepare("select xp from xp_days where subject_id = ? and day = ?").get(subjectId, day) as
      { xp: number } | undefined;
    return row?.xp ?? 0;
  }

  private addDayXp(subjectId: number, day: string, xp: number): void {
    this.db
      .prepare(
        "insert into xp_days (subject_id, day, xp) values (?, ?, ?) on conflict (subject_id, day) do update set xp = xp + excluded.xp",
      )
      .run(subjectId, day, xp);
  }

  private newSession(subjectId: number, now: number): string {
    const token = randomBytes(24).toString("hex");
    this.db.prepare("insert into sessions (token, subject_id, last_used) values (?, ?, ?)").run(token, subjectId, now);
    return token;
  }

  close(): void {
    this.db.close();
  }
}
