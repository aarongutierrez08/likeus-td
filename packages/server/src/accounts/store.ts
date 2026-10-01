import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Deck, DoctrineKind } from "@td/sim";
import type { DailyEntry } from "../protocol";
import { cappedXp } from "./xp";

/** A guest (one per browser) or an account linked to Discord or Google. Guests turn into accounts when they link. */
export interface Subject {
  id: number;
  kind: "guest" | "account";
  provider: string | null;
  name: string;
  /** Preferred player color index, or null for "first free". */
  color: number | null;
  xp: number;
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
  replayId: number;
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
  provider text,
  provider_id text,
  name text not null,
  color integer,
  xp integer not null default 0,
  created integer not null,
  unique (provider, provider_id)
);
create table if not exists sessions (token text primary key, subject_id integer not null);
create table if not exists replays (id integer primary key autoincrement, data text not null);
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
  provider: string | null;
  name: string;
  color: number | null;
  xp: number;
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
  }

  /** Databases created before the history kept decks and doctrines get those columns, empty for the old games. */
  private addMissingColumns(): void {
    const columns = (this.db.prepare("pragma table_info(games)").all() as { name: string }[]).map((c) => c.name);
    if (!columns.includes("deck")) this.db.exec("alter table games add column deck text");
    if (!columns.includes("doctrines")) this.db.exec("alter table games add column doctrines text not null default '[]'");
  }

  createGuest(name: string, now: number): { token: string; subject: Subject } {
    const id = Number(this.db.prepare("insert into subjects (kind, name, created) values ('guest', ?, ?)").run(name, now).lastInsertRowid);
    return { token: this.newSession(id), subject: this.subject(id)! };
  }

  subjectByToken(token: string): Subject | null {
    const row = this.db.prepare("select subject_id from sessions where token = ?").get(token) as { subject_id: number } | undefined;
    return row ? this.subject(row.subject_id) : null;
  }

  subject(id: number): Subject | null {
    const row = this.db.prepare("select id, kind, provider, name, color, xp from subjects where id = ?").get(id) as SubjectRow | undefined;
    return row ?? null;
  }

  rename(id: number, name: string): void {
    this.db.prepare("update subjects set name = ? where id = ?").run(name, id);
  }

  setColor(id: number, color: number | null): void {
    this.db.prepare("update subjects set color = ? where id = ?").run(color, id);
  }

  /**
   * The browser's guest links a provider identity. A first link turns the guest into the account; a link to an account
   * that already exists moves the guest's history and experience into it. Either way the session now speaks for the account.
   */
  link(token: string, provider: string, providerId: string, providerName: string): Subject | null {
    return this.inTransaction(() => {
      const guest = this.subjectByToken(token);
      if (!guest) return null;
      const existing = this.db.prepare("select id from subjects where provider = ? and provider_id = ?").get(provider, providerId) as
        { id: number } | undefined;
      if (!existing) {
        if (guest.kind === "account") return null;
        this.db
          .prepare("update subjects set kind = 'account', provider = ?, provider_id = ? where id = ?")
          .run(provider, providerId, guest.id);
        if (guest.name.startsWith("Jugador")) this.rename(guest.id, providerName);
        return this.subject(guest.id);
      }
      if (existing.id === guest.id) return guest;
      if (guest.kind === "guest") this.mergeInto(guest.id, existing.id);
      this.db.prepare("update sessions set subject_id = ? where token = ?").run(existing.id, token);
      return this.subject(existing.id);
    });
  }

  /** The guest's days count against the account's daily cap: many guests merged into one account earn no more than one. */
  private mergeInto(from: number, to: number): void {
    this.db.prepare("update games set subject_id = ? where subject_id = ?").run(to, from);
    const days = this.db.prepare("select day, xp from xp_days where subject_id = ?").all(from) as { day: string; xp: number }[];
    let moved = 0;
    for (const { day, xp } of days) {
      const paid = cappedXp(xp, this.dayXp(to, day));
      this.addDayXp(to, day, paid);
      moved += paid;
    }
    this.db.prepare("delete from xp_days where subject_id = ?").run(from);
    this.db.prepare("update subjects set xp = xp + ? where id = ?").run(moved, to);
    this.db.prepare("update sessions set subject_id = ? where subject_id = ?").run(to, from);
    this.db.prepare("delete from subjects where id = ?").run(from);
  }

  logout(token: string): void {
    this.db.prepare("delete from sessions where token = ?").run(token);
  }

  /** Removes the subject, its sessions and history, and the replays nobody else's history points at. */
  deleteSubject(id: number): void {
    return this.inTransaction(() => {
      const replays = this.db.prepare("select distinct replay_id from games where subject_id = ?").all(id) as { replay_id: number }[];
      this.db.prepare("delete from games where subject_id = ?").run(id);
      for (const { replay_id } of replays) {
        const used = this.db.prepare("select 1 from games where replay_id = ? limit 1").get(replay_id);
        if (!used) this.db.prepare("delete from replays where id = ?").run(replay_id);
      }
      this.db.prepare("delete from xp_days where subject_id = ?").run(id);
      this.db.prepare("delete from sessions where subject_id = ?").run(id);
      this.db.prepare("delete from subjects where id = ?").run(id);
    });
  }

  saveReplay(data: unknown): number {
    return Number(this.db.prepare("insert into replays (data) values (?)").run(JSON.stringify(data)).lastInsertRowid);
  }

  replay(id: number): unknown {
    const row = this.db.prepare("select data from replays where id = ?").get(id) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as unknown) : null;
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
      this.db.prepare("update subjects set xp = xp + ? where id = ?").run(paid, subjectId);
      return paid;
    });
  }

  history(subjectId: number, limit = 50): GameRecord[] {
    const rows = this.db
      .prepare(
        "select id, played_at, mode, map, seed, players, result, wave, xp, replay_id, deck, doctrines from games where subject_id = ? order by id desc limit ?",
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
      replayId: r.replay_id,
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

  private newSession(subjectId: number): string {
    const token = randomBytes(24).toString("hex");
    this.db.prepare("insert into sessions (token, subject_id) values (?, ?)").run(token, subjectId);
    return token;
  }

  close(): void {
    this.db.close();
  }
}
