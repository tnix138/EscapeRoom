// src/server/realtime/room-hub.ts — انتشار بلادرنگ تغییرات نسخه اتاق برای اتصالات SSE (موج ۳ روی همین سوار می‌شود)
import type { InternalRoomState } from '../../engine/index';

type Listener = (state: InternalRoomState) => void;

const listenersByRoom = new Map<string, Set<Listener>>();

export function subscribeRoom(code: string, listener: Listener): () => void {
  const key = code.toUpperCase();
  const set = listenersByRoom.get(key) ?? new Set<Listener>();
  set.add(listener);
  listenersByRoom.set(key, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) listenersByRoom.delete(key);
  };
}

export function publishRoomUpdate(state: InternalRoomState): void {
  const set = listenersByRoom.get(state.code.toUpperCase());
  if (!set) return;
  for (const listener of [...set]) {
    try {
      listener(state);
    } catch {
      // خطای یک شنونده نباید انتشار برای بقیه را متوقف کند
    }
  }
}

export function roomListenerCount(code: string): number {
  return listenersByRoom.get(code.toUpperCase())?.size ?? 0;
}
