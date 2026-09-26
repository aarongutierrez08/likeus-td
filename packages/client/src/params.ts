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
  /** True when any dev parameter was used: the game is not eligible for records. */
  usesDevParams: boolean;
}

const DEV_PARAMS = ["gold", "wave", "tick", "tower", "bot", "dump"] as const;

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

/**
 * Public: ?seed=&map=&speed=. Dev only (ignored in production builds):
 * &gold=&wave=&tick=&dump=1&bot=1&tower=archer|cannon|aura
 */
export function parseUrlParams(search: string, dev: boolean = import.meta.env.DEV): UrlParams {
  const params = new URLSearchParams(search);
  const usesDevParams = dev && DEV_PARAMS.some((name) => params.has(name));
  const devParams = usesDevParams ? params : new URLSearchParams();
  return {
    seed: intParam(params, "seed") ?? Math.floor(Math.random() * 1_000_000),
    map: params.get("map") ?? "s",
    speed: floatParam(params, "speed") ?? 1,
    gold: intParam(devParams, "gold"),
    wave: intParam(devParams, "wave"),
    tick: intParam(devParams, "tick") ?? 0,
    dump: devParams.get("dump") === "1",
    bot: devParams.get("bot") === "1",
    tower: towerParam(devParams),
    usesDevParams,
  };
}
