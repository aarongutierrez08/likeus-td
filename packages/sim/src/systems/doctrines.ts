import { hasAura, hasIncome, hasWall, type DoctrineDef, type DoctrineFit } from "../balance/define";
import { DOCTRINE, DOCTRINE_KINDS, DOCTRINES, type DoctrineKind } from "../balance/doctrines";
import { towerDef } from "../balance/towers";
import { rollInt } from "../rng";
import type { GameState, Player } from "../types";

type NumericEffect = "auraRadius" | "wallHpPct" | "interestPct" | "interestCapGold" | "firstTowerDiscountPct" | "abilityCooldownPct";

/** Sum of one effect over the doctrines of a tower owner or player; 0 for the team and for players without doctrines. */
export function doctrineEffect(state: GameState, owner: number, effect: NumericEffect): number {
  const player = state.players.find((p) => p.id === owner);
  if (!player || player.doctrines.length === 0) return 0;
  return player.doctrines.reduce((sum, kind) => sum + DOCTRINES[kind][effect], 0);
}

/** Doctrines of this owner, for effects that are not a plain number. */
export function doctrinesOf(state: GameState, owner: number): DoctrineDef[] {
  const kinds = state.players.find((p) => p.id === owner)?.doctrines;
  return kinds && kinds.length > 0 ? kinds.map((kind) => DOCTRINES[kind]) : NONE;
}

const NONE: DoctrineDef[] = [];

/** What this player has built that a doctrine can fit. */
function fitsOf(state: GameState, playerId: number): Set<DoctrineFit> {
  const fits = new Set<DoctrineFit>();
  for (const tower of state.towers) {
    if (tower.owner !== playerId) continue;
    const def = towerDef(tower);
    if (hasAura(def)) fits.add("aura");
    if (hasWall(def)) fits.add("wall");
    if (hasIncome(def)) fits.add("income");
    if (def.attackType === "explosive") fits.add("explosive");
  }
  return fits;
}

/** What a draw picks from: not taken, and not the offer being rerolled while that still leaves a full offer. */
function pools(state: GameState, player: Player, exclude: readonly DoctrineKind[]): { pool: DoctrineKind[]; fitting: DoctrineKind[] } {
  const fits = fitsOf(state, player.id);
  const open = DOCTRINE_KINDS.filter((kind) => !player.doctrines.includes(kind));
  const fresh = open.filter((kind) => !exclude.includes(kind));
  const pool = fresh.length >= DOCTRINE.offerSize ? fresh : open;
  const fitting = pool.filter((kind) => DOCTRINES[kind].fits !== null && fits.has(DOCTRINES[kind].fits));
  return { pool, fitting };
}

/** Three doctrines from the sim RNG: one that fits what the player built when any does, the rest from everything not taken. */
export function drawOffer(state: GameState, player: Player, exclude: readonly DoctrineKind[] = []): DoctrineKind[] {
  const { pool, fitting } = pools(state, player, exclude);
  const offer: DoctrineKind[] = [];
  if (fitting.length > 0) offer.push(fitting[rollInt(state, fitting.length)]!);
  const rest = pool.filter((kind) => !offer.includes(kind));
  while (offer.length < DOCTRINE.offerSize && rest.length > 0) offer.push(rest.splice(rollInt(state, rest.length), 1)[0]!);
  return offer;
}

/** Percent chance that each doctrine shows up in this player's next draw (the reroll, while an offer is open), as the HUD shows it. Taken ones are 0. */
export function doctrineOdds(state: GameState, playerId: number): Record<DoctrineKind, number> {
  const odds = Object.fromEntries(DOCTRINE_KINDS.map((kind) => [kind, 0])) as Record<DoctrineKind, number>;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return odds;
  const { pool, fitting } = pools(state, player, player.doctrineOffer);
  const size = DOCTRINE.offerSize;
  const n = pool.length;
  const f = fitting.length;
  for (const kind of pool) {
    if (n <= size) odds[kind] = 100;
    else if (f === 0) odds[kind] = Math.floor((100 * size) / n);
    else if (fitting.includes(kind)) odds[kind] = Math.floor((100 * (n - 1) + 100 * (f - 1) * (size - 1)) / (f * (n - 1)));
    else odds[kind] = Math.floor((100 * (size - 1)) / (n - 1));
  }
  return odds;
}

/** At the close of every DOCTRINE.everyWaves-th wave with another one to come, each player gets a fresh offer and their reroll back. */
export function offerDoctrines(state: GameState, closedWave: number, hasNext: boolean): void {
  if (closedWave % DOCTRINE.everyWaves !== 0 || !hasNext) return;
  for (const player of state.players) {
    player.doctrineOffer = drawOffer(state, player);
    player.doctrineRerolled = false;
  }
}

/** An offer lasts until the next wave starts; whoever did not pick gets nothing. */
export function expireOffers(state: GameState): void {
  for (const player of state.players) player.doctrineOffer = [];
}
