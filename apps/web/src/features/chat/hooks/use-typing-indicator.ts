import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';

const STOP_AFTER_MS = 2500;
const TYPING_TTL_MS = 4000;

/** Ephemeral only (Phase 6: typing indicators are never persisted) — purely
 * a direct room relay the gateway forwards to everyone else already
 * subscribed to the channel. `notifyTyping()` is debounced client-side so a
 * fast typist doesn't spam `chat.typing.start` on every keystroke; a stale
 * "is typing" (the stop event never arrived — a dropped connection, a
 * closed tab) self-expires after `TYPING_TTL_MS` rather than sticking
 * forever. */
export function useTypingIndicator(
  socket: Socket | null,
  channelId: string | undefined,
  currentUserId: string,
) {
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiryTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    setTypingUserIds([]);
    for (const timer of expiryTimers.current.values()) clearTimeout(timer);
    expiryTimers.current.clear();
  }, [channelId]);

  useEffect(() => {
    if (!socket || !channelId) return;

    function clearExpiry(userId: string) {
      const timer = expiryTimers.current.get(userId);
      if (timer) clearTimeout(timer);
      expiryTimers.current.delete(userId);
    }

    function onStarted(payload: { channelId: string; userId: string }) {
      if (payload.channelId !== channelId || payload.userId === currentUserId) return;
      clearExpiry(payload.userId);
      setTypingUserIds((prev) =>
        prev.includes(payload.userId) ? prev : [...prev, payload.userId],
      );
      expiryTimers.current.set(
        payload.userId,
        setTimeout(() => {
          setTypingUserIds((prev) => prev.filter((id) => id !== payload.userId));
        }, TYPING_TTL_MS),
      );
    }
    function onStopped(payload: { channelId: string; userId: string }) {
      if (payload.channelId !== channelId) return;
      clearExpiry(payload.userId);
      setTypingUserIds((prev) => prev.filter((id) => id !== payload.userId));
    }

    socket.on('chat.typing.started', onStarted);
    socket.on('chat.typing.stopped', onStopped);
    return () => {
      socket.off('chat.typing.started', onStarted);
      socket.off('chat.typing.stopped', onStopped);
    };
  }, [socket, channelId, currentUserId]);

  const notifyTyping = useCallback(() => {
    if (!socket || !channelId) return;
    if (!stopTimerRef.current) {
      socket.emit('chat.typing.start', { channelId });
    }
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => {
      socket.emit('chat.typing.stop', { channelId });
      stopTimerRef.current = null;
    }, STOP_AFTER_MS);
  }, [socket, channelId]);

  const notifyStopped = useCallback(() => {
    if (!socket || !channelId) return;
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    socket.emit('chat.typing.stop', { channelId });
  }, [socket, channelId]);

  return { typingUserIds, notifyTyping, notifyStopped };
}
