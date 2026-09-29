import { For, createSignal } from "solid-js";

export interface FloatingLabel {
  id: number;
  x: number;
  y: number;
  text: string;
  color?: string | undefined;
}

const LABEL_MS = 900;

/** Short-lived texts over the map (gold earned, rejections). DOM, so no text is drawn on the canvas. */
export function createFloatingLabels() {
  const [labels, setLabels] = createSignal<FloatingLabel[]>([]);
  let nextId = 1;
  const push = (x: number, y: number, text: string, color?: string): void => {
    const id = nextId++;
    setLabels((list) => [...list, { id, x, y, text, color }]);
    setTimeout(() => setLabels((list) => list.filter((l) => l.id !== id)), LABEL_MS);
  };
  const View = () => (
    <div class="floating">
      <For each={labels()}>{(l) => <span style={{ left: `${l.x}px`, top: `${l.y}px`, color: l.color }}>{l.text}</span>}</For>
    </div>
  );
  return { push, View };
}
