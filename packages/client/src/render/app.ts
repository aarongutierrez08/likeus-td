import { Application, Container, Graphics, type FederatedPointerEvent } from "pixi.js";
import {
  ABILITIES,
  FP,
  TOWERS,
  abilityLevel,
  TOWER_KINDS,
  getMap,
  hasAura,
  hasWall,
  isBuildable,
  isPathCell,
  pathCells,
  type AbilityKind,
  type EnemyKind,
  type GameState,
  type RouteKey,
  routeOf,
  type MapId,
  type Point,
  type TowerKind,
} from "@td/sim";
import { COLORS } from "./colors";
import { EntityLayer } from "./entities";
import { drawMap } from "./map";

/** World units: pixels per cell before the responsive scale is applied. */
const BASE = 48;

export interface RendererOptions {
  mapId: MapId;
  /** Returns true to keep the reach preview on that cell, so a touch player sees it without a mouse hover. */
  onCellTap: (cell: Point) => boolean;
  /** Screen position (CSS pixels within the map element) and enemy kind of each kill, for floating labels. */
  onKills?: (kills: (Point & { kind: EnemyKind; owner: number | null })[]) => void;
}

export interface Renderer {
  sync(state: GameState, showRanges: boolean): void;
  setHoverTower(kind: TowerKind | null): void;
  /** Ability being aimed and its level: the hover shows where it would land and how far it reaches. */
  setAimAbility(aim: { kind: AbilityKind; level: number } | null): void;
  /** Cell where the reach of the chosen tower is drawn, if any. */
  previewCell(): Point | null;
  setSelectedCell(cell: Point | null): void;
  /** Draws the reach of that tower until it is deselected. */
  setSelectedTowerId(id: number | null): void;
  destroy(): void;
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
  let drawnRoute: RouteKey = opts.mapId;
  drawMap(mapLayer, drawnRoute, BASE);
  world.addChild(mapLayer, entities.effects, entities.ranges, entities.towers, entities.enemies, selection, hover);
  app.stage.addChild(world);

  const layout = (): void => {
    const cell = Math.max(4, Math.min(app.screen.width / map.width, app.screen.height / map.height));
    world.scale.set(cell / BASE);
    world.position.set(Math.floor((app.screen.width - cell * map.width) / 2), Math.floor((app.screen.height - cell * map.height) / 2));
  };
  layout();
  app.renderer.on("resize", layout);

  let hoverTower: TowerKind | null = TOWER_KINDS[0]!;
  let lastState: GameState | null = null;
  let lastShowRanges = false;
  let previewCell: Point | null = null;
  let aim: { kind: AbilityKind; level: number } | null = null;
  const drawAim = (cell: Point): void => {
    const target = ABILITIES[aim!.kind].target;
    const fits = target === "path" ? isPathCell(drawnRoute, cell.x, cell.y) : true;
    hover.rect(cell.x * BASE, cell.y * BASE, BASE, BASE).stroke({ width: 2, color: fits ? COLORS.hover : COLORS.exit });
    const radius = abilityLevel(aim!.kind, aim!.level).radius;
    if (fits && radius > 0)
      hover
        .circle((cell.x + 0.5) * BASE, (cell.y + 0.5) * BASE, (radius / FP) * BASE)
        .stroke({ width: 2, color: COLORS.blast, alpha: 0.8 });
  };
  const cellFromEvent = (e: FederatedPointerEvent): Point | null => {
    const local = world.toLocal(e.global);
    const x = Math.floor(local.x / BASE);
    const y = Math.floor(local.y / BASE);
    return x >= 0 && y >= 0 && x < map.width && y < map.height ? { x, y } : null;
  };
  const drawHover = (cell: Point | null): void => {
    hover.clear();
    previewCell = null;
    if (!cell || !lastState) return;
    if (aim) return drawAim(cell);
    const wanted = hoverTower ? TOWERS[hoverTower] : null;
    const placeable = wanted && hasWall(wanted) ? isPathCell(drawnRoute, cell.x, cell.y) : isBuildable(drawnRoute, cell.x, cell.y);
    const free = placeable && !lastState.towers.some((t) => t.x === cell.x && t.y === cell.y);
    hover.rect(cell.x * BASE, cell.y * BASE, BASE, BASE).stroke({ width: 2, color: free ? COLORS.hover : COLORS.exit });
    if (!free || !hoverTower) return;
    previewCell = cell;
    const def = TOWERS[hoverTower];
    const cx = (cell.x + 0.5) * BASE;
    const cy = (cell.y + 0.5) * BASE;
    const reach = Math.max(def.range, def.controlRange, def.revealRange);
    if (reach > 0) hover.circle(cx, cy, (reach / FP) * BASE).stroke({ width: 1, color: COLORS.range, alpha: 0.5 });
    if (hasAura(def)) {
      const side = (def.auraRadius * 2 + 1) * BASE;
      hover.rect(cx - side / 2, cy - side / 2, side, side).stroke({ width: 1, color: COLORS.aura, alpha: 0.6 });
    }
  };

  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;
  app.stage.on("pointermove", (e) => {
    if (e.pointerType === "mouse") drawHover(cellFromEvent(e));
  });
  app.stage.on("pointerleave", (e) => {
    if (e.pointerType === "mouse") drawHover(null);
  });
  app.stage.on("pointertap", (e) => {
    const cell = cellFromEvent(e);
    drawHover(cell && opts.onCellTap(cell) ? cell : null);
  });

  return {
    sync(state, showRanges) {
      lastState = state;
      const route = routeOf(state);
      if (route !== drawnRoute) {
        drawnRoute = route;
        drawMap(mapLayer, route, BASE);
      }
      lastShowRanges = showRanges;
      if (previewCell) drawHover(previewCell);
      const kills = entities.sync(state, showRanges);
      if (kills.length > 0 && opts.onKills) {
        opts.onKills(
          kills.map((k) => {
            const global = world.toGlobal({ x: k.x, y: k.y });
            return { x: global.x, y: global.y, kind: k.kind, owner: k.owner };
          }),
        );
      }
    },
    setHoverTower(kind) {
      hoverTower = kind;
      drawHover(kind ? previewCell : null);
    },
    previewCell: () => previewCell,
    setAimAbility(next) {
      if (next?.kind === aim?.kind && next?.level === aim?.level) return;
      aim = next;
      hover.clear();
    },
    setSelectedTowerId(id) {
      entities.selectedTowerId = id;
      if (lastState) entities.sync(lastState, lastShowRanges);
    },
    setSelectedCell(cell) {
      selection.clear();
      if (cell) selection.rect(cell.x * BASE, cell.y * BASE, BASE, BASE).stroke({ width: 3, color: COLORS.hover });
    },
    destroy() {
      app.renderer.off("resize", layout);
      app.destroy(true, { children: true });
    },
  };
}
