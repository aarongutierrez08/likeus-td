import { Show, createSignal } from "solid-js";

/** "Reportar problema": free text sent with the game state so the bug can be replayed. */
export function ReportButton(props: { send: (message: string) => void }) {
  const [open, setOpen] = createSignal(false);
  const [text, setText] = createSignal("");
  const submit = (): void => {
    props.send(text().trim());
    setText("");
    setOpen(false);
  };
  return (
    <>
      <button type="button" class="inline report-toggle" onClick={() => setOpen(!open())}>
        Reportar problema
      </button>
      <Show when={open()}>
        <form
          class="report-dialog"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <textarea
            rows={3}
            maxLength={2000}
            placeholder="¿Qué pasó? (se adjunta la partida para reproducirla)"
            value={text()}
            onInput={(e) => setText(e.currentTarget.value)}
          />
          <div class="row">
            <button type="submit" class="inline">
              Enviar
            </button>
            <button type="button" class="inline" onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </form>
      </Show>
    </>
  );
}
