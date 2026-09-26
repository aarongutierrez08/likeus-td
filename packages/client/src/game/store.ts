import { createSignal } from "solid-js";
import type { GameState, TowerKind } from "@td/sim";

export function createGameStore(initial: GameState) {
  const [state, setState] = createSignal<GameState>(initial);
  const [selectedTower, setSelectedTower] = createSignal<TowerKind | null>("archer");
  const [paused, setPaused] = createSignal(false);
  const [showRanges, setShowRanges] = createSignal(false);
  const [debugOpen, setDebugOpen] = createSignal(false);
  const [notice, setNotice] = createSignal<string | null>(null);
  return {
    state,
    setState,
    selectedTower,
    setSelectedTower,
    paused,
    setPaused,
    showRanges,
    setShowRanges,
    debugOpen,
    setDebugOpen,
    notice,
    setNotice,
  };
}

export type GameStore = ReturnType<typeof createGameStore>;
