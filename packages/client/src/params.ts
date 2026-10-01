import { DOCTRINE_KINDS, TOWER_KINDS, type Deck, type DoctrineKind, type TowerKind } from "@td/sim";
import { parseDeckParam } from "./game/deck";

export type GameMode = "solo" | "coop";

export interface UrlParams {
  mode: GameMode;
  /** Room code to join or reconnect to (coop). */
  room: string | undefined;
  /** Player name shown to others (coop). */
  name: string | undefined;
  seed: number;
  map: string;
  speed: number;
  gold: number | undefined;
  wave: number | undefined;
  tick: number;
  dump: boolean;
  bot: boolean;
  /** Tower preselected in the shop; unknown ids are ignored. */
  tower: TowerKind | undefined;
  /** Solo deck that skips the deck screen: "archer,mage,...;bombard,repair". Null when absent. */
  deck: Deck | null;
  /** Doctrines the solo player starts with: "wideAuras,firstCheap". Unknown names are dropped. */
  doctrines: DoctrineKind[];
  /** True when any dev parameter was used: the game is not eligible for records. */
  usesDevParams: boolean;
}

const DEV_PARAMS = ["gold", "wave", "tick", "tower", "bot", "dump", "deck", "doctrines"] as const;

function intParam(params: URLSearchParams, name: string): number | undefined {
  const raw = params.get(name);
  if (raw === null || raw === "") return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? undefined : n;
}

function floatParam(params: URLSearchParams, name: string): number | undefined {
  const raw = params.get(name);
  if (raw === null || raw === "") return undefined;
  const n = Number.parseFloat(raw);
  return Number.isNaN(n) ? undefined : n;
}

function towerParam(params: URLSearchParams): TowerKind | undefined {
  const raw = params.get("tower");
  return TOWER_KINDS.find((kind) => kind === raw);
}

const ROOM_CODE = /^[A-Z]{4}$/;

function modeParam(params: URLSearchParams): GameMode {
  return params.get("mode") === "coop" ? "coop" : "solo";
}

function roomParam(params: URLSearchParams): string | undefined {
  const raw = params.get("room")?.trim().toUpperCase();
  return raw && ROOM_CODE.test(raw) ? raw : undefined;
}

function nameParam(params: URLSearchParams): string | undefined {
  const raw = params.get("name")?.trim();
  return raw ? raw : undefined;
}

/**
 * Public: ?mode=solo|coop&room=&name=&seed=&map=&speed=. Dev only, solo mode, non-production builds:
 * &gold=&wave=&tick=&dump=1&bot=1&tower=archer|cannon|aura&deck=archer,mage,...;bombard,repair&doctrines=wideAuras,...
 */
export function parseUrlParams(search: string, dev: boolean = import.meta.env.DEV): UrlParams {
  const params = new URLSearchParams(search);
  const mode = modeParam(params);
  const usesDevParams = dev && mode === "solo" && DEV_PARAMS.some((name) => params.has(name));
  const devParams = usesDevParams ? params : new URLSearchParams();
  return {
    mode,
    room: roomParam(params),
    name: nameParam(params),
    seed: intParam(params, "seed") ?? Math.floor(Math.random() * 1_000_000),
    map: params.get("map") ?? "s",
    speed: floatParam(params, "speed") ?? 1,
    gold: intParam(devParams, "gold"),
    wave: intParam(devParams, "wave"),
    tick: intParam(devParams, "tick") ?? 0,
    dump: devParams.get("dump") === "1",
    bot: devParams.get("bot") === "1",
    tower: towerParam(devParams),
    deck: parseDeckParam(devParams.get("deck")),
    doctrines: DOCTRINE_KINDS.filter((kind) => (devParams.get("doctrines") ?? "").split(",").includes(kind)),
    usesDevParams,
  };
}
