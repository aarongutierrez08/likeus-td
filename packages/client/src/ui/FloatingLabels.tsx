import { For, createSignal } from "solid-js";

export interface FloatingLabel {
  id: number;
  x: number;
  y: number;
  text: string;
}

const LABEL_MS = 900;

/** Short-lived texts over the map (gold earned, rejections). DOM, so no text is drawn on the canvas. */
export function createFloatingLabels() {
  const [labels, setLabels] = createSignal<FloatingLabel[]>([]);
  let nextId = 1;
  const push = (x: number, y: number, text: string): void => {
    const id = nextId++;
    setLabels((list) => [...list, { id, x, y, text }]);
    setTimeout(() => setLabels((list) => list.filter((l) => l.id !== id)), LABEL_MS);
  };
  const View = () => (
    <div class="floating">
      <For each={labels()}>{(l) => <span style={{ left: `${l.x}px`, top: `${l.y}px` }}>{l.text}</span>}</For>
    </div>
  );
  return { push, View };
}
