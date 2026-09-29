import { PLAYER_COLORS, TEAM_OWNER, type GameState } from "@td/sim";

export function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/** The player's color as CSS, or a neutral gray for the team and for players who left. */
export function playerCss(state: GameState, playerId: number): string {
  const player = state.players.find((p) => p.id === playerId);
  if (playerId === TEAM_OWNER || !player) return "#8a8f9a";
  return cssColor(PLAYER_COLORS[player.color] ?? PLAYER_COLORS[0]);
}

export const PREFERRED_COLOR_KEY = "td.color";

export function readPreferredColor(): number | undefined {
  try {
    const raw = localStorage.getItem(PREFERRED_COLOR_KEY);
    return raw === null ? undefined : Number.parseInt(raw, 10);
  } catch {
    return undefined;
  }
}

export function writePreferredColor(color: number): void {
  try {
    localStorage.setItem(PREFERRED_COLOR_KEY, String(color));
  } catch {
    /* private mode: the preference is simply not kept */
  }
}
