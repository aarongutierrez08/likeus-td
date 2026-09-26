import { matchMaker } from "@colyseus/core";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "./protocol";

const MAX_ATTEMPTS = 50;

export function randomRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function isRoomCode(value: string): boolean {
  return value.length === ROOM_CODE_LENGTH && [...value].every((ch) => ROOM_CODE_ALPHABET.includes(ch));
}

/** A code no live room is using. Collisions are rare (24^4 codes) but checked anyway. */
async function isTaken(code: string): Promise<boolean> {
  try {
    return (await matchMaker.getRoomById(code)) !== undefined;
  } catch {
    return false;
  }
}

export async function uniqueRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = randomRoomCode();
    if (!(await isTaken(code))) return code;
  }
  throw new Error("could not allocate a room code");
}
