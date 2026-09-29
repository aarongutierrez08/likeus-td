/** Debug handle the client exposes for the dev scripts (see packages/client/src/main.tsx). */
interface TdDebugState {
  tick: number;
  status: string;
  towers: { id: number; level: number; branch: string | null; x: number; y: number; hp: number }[];
  enemies: unknown[];
  players: { id: number; gold: number }[];
  wave: number;
  waveCalls: number[];
}

interface Window {
  __td?: { state(): TdDebugState; hash(): string; ready: boolean };
}
