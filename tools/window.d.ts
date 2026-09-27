/** Debug handle the client exposes for the dev scripts (see packages/client/src/main.tsx). */
interface TdDebugState {
  tick: number;
  towers: unknown[];
  players: { id: number; gold: number }[];
  wave: number;
  waveCalls: number[];
}

interface Window {
  __td?: { state(): TdDebugState; hash(): string; ready: boolean };
}
