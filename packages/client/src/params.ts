import { TOWER_KINDS, type TowerKind } from "@td/sim";

export interface UrlParams {
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
}

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

/** ?seed=&map=&speed=&gold=&wave=&tick=&dump=1&bot=1&tower=archer|cannon|aura */
export function parseUrlParams(search: string): UrlParams {
  const params = new URLSearchParams(search);
  return {
    seed: intParam(params, "seed") ?? Math.floor(Math.random() * 1_000_000),
    map: params.get("map") ?? "s",
    speed: floatParam(params, "speed") ?? 1,
    gold: intParam(params, "gold"),
    wave: intParam(params, "wave"),
    tick: intParam(params, "tick") ?? 0,
    dump: params.get("dump") === "1",
    bot: params.get("bot") === "1",
    tower: towerParam(params),
  };
}
