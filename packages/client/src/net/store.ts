import { createSignal } from "solid-js";
import type { ChatMessage, Phase, PlayerInfo } from "@td/server/protocol";

export interface RoomInfo {
  code: string;
  players: PlayerInfo[];
  you: number;
  creator: number;
  phase: Phase;
}

export const MAX_CHAT_HISTORY = 100;

export function createNetStore() {
  const [roomInfo, setRoomInfo] = createSignal<RoomInfo | null>(null);
  const [chat, setChat] = createSignal<ChatMessage[]>([]);
  const [error, setError] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  const pushChat = (msg: ChatMessage): void => {
    setChat((list) => [...list.slice(-(MAX_CHAT_HISTORY - 1)), msg]);
  };
  return { roomInfo, setRoomInfo, chat, pushChat, error, setError, busy, setBusy };
}

export type NetStore = ReturnType<typeof createNetStore>;
