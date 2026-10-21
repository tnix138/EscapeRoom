/** Decide whether an SSE snapshot is needed for versioned room state or lease-only presence changes. */
export function shouldSendRoomViewUpdate(
  version: number,
  lastSentVersion: number,
  onlineSignature: string,
  lastOnlineSignature: string,
): boolean {
  if (version < lastSentVersion) return false;
  return version > lastSentVersion || onlineSignature !== lastOnlineSignature;
}
