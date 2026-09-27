import { dumpState } from "@td/sim";
import type { GameStore } from "../game/store";

export function Dump(props: { store: GameStore }) {
  return (
    <pre class="dump" id="dump">
      {dumpState(props.store.state())}
    </pre>
  );
}
