import type { DailyBoard, DailySubmission } from "@td/server/protocol";
import { defaultEndpoint, httpEndpoint } from "./connection";

const base = (): string => `${httpEndpoint(defaultEndpoint())}/daily`;

/** The UTC day the challenge belongs to: the same for every player at once. */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Sends a finished daily game; the server replays it and answers with today's board, or an error text. */
export async function submitDaily(submission: DailySubmission): Promise<DailyBoard | string> {
  try {
    const sent = await fetch(base(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(submission) });
    if (!sent.ok) return ((await sent.json()) as { error?: string }).error ?? "No se pudo enviar";
    const board = await fetch(base());
    return (await board.json()) as DailyBoard;
  } catch {
    return "No se pudo conectar con el servidor";
  }
}
