import { Application, Container, Graphics, type FederatedPointerEvent } from "pixi.js";
import { FP, TOWERS, getMap, isBuildable, pathCells, type GameState, type MapId, type Point, type TowerKind } from "@td/sim";
import { COLORS } from "./colors";
import { EntityLayer } from "./entities";
import { drawMap } from "./map";

/** World units: pixels per cell before the responsive scale is applied. */
const BASE = 48;

export interface RendererOptions {
  mapId: MapId;
  onCellTap: (cell: Point) => void;
  /** Screen position (CSS pixels within the map element) of each kill, for floating labels. */
  onKills?: (positions: Point[]) => void;
}

export interface Renderer {
  sync(state: GameState, showRanges: boolean): void;
  setHoverTower(kind: TowerKind | null): void;
  setSelectedCell(cell: Point | null): void;
}

export async function createRenderer(container: HTMLElement, opts: RendererOptions): Promise<Renderer> {
  const app = new Application();
  await app.init({
    resizeTo: container,
    background: COLORS.background,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  container.appendChild(app.canvas);

  const map = getMap(opts.mapId);
  const world = new Container();
  const mapLayer = new Graphics();
  const hover = new Graphics();
  const selection = new Graphics();
  const entities = new EntityLayer(BASE);
  const cells = pathCells(opts.mapId);
  entities.setExit(cells[cells.length - 1]!);
  drawMap(mapLayer, opts.mapId, BASE);
  world.addChild(mapLayer, entities.ranges, entities.towers, entities.enemies, selection, hover);
  app.stage.addChild(world);

  const layout = (): void => {
    const cell = Math.max(4, Math.min(app.screen.width / map.width, app.screen.height / map.height));
    world.scale.set(cell / BASE);
    world.position.set(
      Math.floor((app.screen.width - cell * map.width) / 2),
      Math.floor((app.screen.height - cell * map.height) / 2),
    );
  };
  layout();
  app.renderer.on("resize", layout);

  let hoverTower: TowerKind | null = "archer";
  let lastState: GameState | null = null;
  const cellFromEvent = (e: FederatedPointerEvent): Point | null => {
    const local = world.toLocal(e.global);
    const x = Math.floor(local.x / BASE);
    const y = Math.floor(local.y / BASE);
    return x >= 0 && y >= 0 && x < map.width && y < map.height ? { x, y } : null;
  };
  const drawHover = (cell: Point | null): void => {
    hover.clear();
    if (!cell || !lastState) return;
    const free = isBuildable(opts.mapId, cell.x, cell.y) && !lastState.towers.some((t) => t.x === cell.x && t.y === cell.y);
    hover.rect(cell.x * BASE, cell.y * BASE, BASE, BASE).stroke({ width: 2, color: free ? COLORS.hover : COLORS.exit });
    if (!free || !hoverTower) return;
    const def = TOWERS[hoverTower];
    const cx = (cell.x + 0.5) * BASE;
    const cy = (cell.y + 0.5) * BASE;
    if (def.range > 0) hover.circle(cx, cy, (def.range / FP) * BASE).stroke({ width: 1, color: COLORS.range, alpha: 0.5 });
    if (def.auraRadius > 0) {
      const side = (def.auraRadius * 2 + 1) * BASE;
      hover.rect(cx - side / 2, cy - side / 2, side, side).stroke({ width: 1, color: COLORS.aura, alpha: 0.6 });
    }
  };

  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;
  app.stage.on("pointermove", (e) => {
    if (e.pointerType === "mouse") drawHover(cellFromEvent(e));
  });
  app.stage.on("pointerleave", () => drawHover(null));
  app.stage.on("pointertap", (e) => {
    const cell = cellFromEvent(e);
    if (cell) opts.onCellTap(cell);
    drawHover(null);
  });

  return {
    sync(state, showRanges) {
      lastState = state;
      const kills = entities.sync(state, showRanges);
      if (kills.length > 0 && opts.onKills) {
        opts.onKills(kills.map((k) => {
          const global = world.toGlobal({ x: k.x, y: k.y });
          return { x: global.x, y: global.y };
        }));
      }
    },
    setHoverTower(kind) {
      hoverTower = kind;
    },
    setSelectedCell(cell) {
      selection.clear();
      if (cell) selection.rect(cell.x * BASE, cell.y * BASE, BASE, BASE).stroke({ width: 3, color: COLORS.hover });
    },
  };
}
