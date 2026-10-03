import { PLAYER_COLORS, TEAM_OWNER, freeColors, type GameState } from "@td/sim";

export function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/** The player's color as CSS, or a neutral gray for the team and for players who left. */
export function playerCss(state: GameState, playerId: number): string {
  const player = state.players.find((p) => p.id === playerId);
  if (playerId === TEAM_OWNER || !player) return "#8a8f9a";
  return cssColor(PLAYER_COLORS[player.color] ?? PLAYER_COLORS[0]);
}

/** A color for a solo game, drawn at random each time; it is never kept. */
export function drawSoloColor(): number {
  const free = freeColors([]);
  return free[Math.floor(Math.random() * free.length)] ?? 0;
}
