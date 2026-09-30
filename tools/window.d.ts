/** Debug handle the client exposes for the dev scripts (see packages/client/src/main.tsx). */
interface TdDebugState {
  tick: number;
  status: string;
  towers: { id: number; kind: string; level: number; branch: string | null; x: number; y: number; hp: number; overchargeUntil: number }[];
  enemies: unknown[];
  players: { id: number; gold: number; abilities: Record<string, { level: number; readyTick: number }> }[];
  blasts: unknown[];
  frostZones: unknown[];
  lives: number;
  wave: number;
  waveCalls: number[];
}

interface Window {
  __td?: { state(): TdDebugState; hash(): string; ready: boolean; preview?: () => { x: number; y: number } | null };
}
