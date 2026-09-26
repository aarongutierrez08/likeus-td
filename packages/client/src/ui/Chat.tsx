import { For, Show, createSignal } from "solid-js";
import { MAX_CHAT_LENGTH } from "@td/server/protocol";
import type { NetStore } from "../net/store";

export function Chat(props: { net: NetStore; send: (text: string) => void }) {
  const [open, setOpen] = createSignal(false);
  const [draft, setDraft] = createSignal("");
  const submit = (): void => {
    const text = draft().trim();
    if (text.length === 0) return;
    props.send(text);
    setDraft("");
  };
  return (
    <div class="chat" classList={{ open: open() }}>
      <button type="button" class="chat-toggle" onClick={() => setOpen(!open())}>
        Chat ({props.net.chat().length})
      </button>
      <Show when={open()}>
        <ul class="chat-log">
          <For each={props.net.chat()}>
            {(msg) => (
              <li>
                <b>{msg.name}:</b> {msg.text}
              </li>
            )}
          </For>
        </ul>
        <form
          class="row"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input type="text" maxLength={MAX_CHAT_LENGTH} value={draft()} placeholder="Mensaje" onInput={(e) => setDraft(e.currentTarget.value)} />
          <button type="submit" class="small">
            Enviar
          </button>
        </form>
      </Show>
    </div>
  );
}
