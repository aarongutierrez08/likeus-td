import { createSignal } from "solid-js";
import { findPlayer, type GameState, type TowerKind } from "@td/sim";

export function createGameStore(initial: GameState, preselectedTower: TowerKind, you: number) {
  const [state, setState] = createSignal<GameState>(initial);
  const gold = (): number => findPlayer(state(), you)?.gold ?? 0;
  const [selectedTower, setSelectedTower] = createSignal<TowerKind | null>(preselectedTower);
  const [paused, setPaused] = createSignal(false);
  const [showRanges, setShowRanges] = createSignal(false);
  const [debugOpen, setDebugOpen] = createSignal(false);
  const [notice, setNotice] = createSignal<string | null>(null);
  return {
    you,
    state,
    setState,
    gold,
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
