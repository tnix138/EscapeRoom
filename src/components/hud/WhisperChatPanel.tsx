'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { announcePanelOpen, onOtherPanelOpen } from './panel-focus';
import { useSwipeDismiss } from './use-swipe-dismiss';
import {
  WHISPER_MAX_LENGTH,
  describeSendState,
  unseenMessageCount,
  whisperDraft,
  whisperTypeLabel,
} from './chat-rules';

interface WhisperMessage { id: string; senderName: string; type: 'whisper' | 'ticket_share' | 'system'; text: string; createdAt: number }
interface WhisperChatPanelProps {
  messages: WhisperMessage[];
  currentPlayerName: string;
  couponText: string;
  onSendWhisper: (text: string, shareStub?: boolean) => Promise<void>;
  /** کنترل باز/بسته بودن پنل از بیرون (اختیاری؛ پیش‌فرض کنترل داخلی). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function WhisperChatPanel({
  messages,
  currentPlayerName,
  couponText,
  onSendWhisper,
  open,
  onOpenChange,
}: WhisperChatPanelProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const [text, setText] = useState('');
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [lastSeen, setLastSeen] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const unread = isOpen ? 0 : unseenMessageCount(messages.length, lastSeen);
  /* کشیدنِ سربرگ به سمت لبهٔ چپ (فلشِ تب) پنل را می‌بندد. */
  const swipe = useSwipeDismiss(isOpen, () => setOpen(false), 'start');
  const draft = whisperDraft(text);

  useEffect(() => {
    if (isOpen) {
      setLastSeen(messages.length);
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    if (sendState !== 'sent' && sendState !== 'error') return undefined;
    const timer = window.setTimeout(() => setSendState('idle'), 3200);
    return () => window.clearTimeout(timer);
  }, [sendState]);

  // موج ۱۰: Esc پنل را می‌بندد و فوکوس را به دکمهٔ سربرگ برمی‌گرداند تا بازیکن
  // در حالت صفحه‌کلید داخل پنل گیر نکند.
  useEffect(() => {
    if (!isOpen) return undefined;
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      window.setTimeout(() => toggleRef.current?.focus({ preventScroll: true }), 0);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  function setOpen(next: boolean) {
    if (open === undefined) setInternalOpen(next);
    if (next) {
      setLastSeen(messages.length);
      /* روی گوشی پنل‌ها به تب کنار لبه جمع می‌شوند؛ با باز شدن یکی، بقیه بسته شوند. */
      announcePanelOpen('whisper');
    }
    onOpenChange?.(next);
  }

  // اگر بازیکن پنل دیگری را باز کند، این پنل جمع می‌شود تا صحنه پوشیده نماند.
  useEffect(() => onOtherPanelOpen('whisper', () => setOpen(false)), [open]);

  function toggle() {
    setOpen(!isOpen);
  }

  async function send(shareStub: boolean) {
    if (sendState === 'sending') return;
    if (!shareStub && !draft.canSend) return;
    setSendState('sending');
    try {
      await onSendWhisper(shareStub ? couponText : draft.trimmed, shareStub);
      if (!shareStub) setText('');
      setSendState('sent');
    } catch {
      setSendState('error');
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(false);
  }

  return (
    <>
      {/* روی گوشی، زدن بیرونِ کشو آن را می‌بندد و صحنه آزاد می‌شود */}
      {isOpen && <div className="panel-scrim" aria-hidden="true" onClick={() => setOpen(false)} />}
      <aside className={`whisper-panel ${isOpen ? 'whisper-expanded' : ''}`} aria-label="نجوای گروهی">
      <button
        ref={toggleRef}
        className="whisper-toggle"
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-controls="whisper-body"
        {...swipe}
      >
        <span className="whisper-icon" aria-hidden="true">♧</span>
        <span className="whisper-toggle-text">
          <strong>نجوای گروهی</strong>
          <small>{isOpen ? `${messages.length.toLocaleString('fa')} پیام در این گفتگو` : 'با هم‌تیمی‌هایتان حرف بزنید'}</small>
        </span>
        {unread > 0 && (
          <span className="whisper-count" aria-label={`${unread.toLocaleString('fa')} پیام خوانده‌نشده`}>
            {unread.toLocaleString('fa')}
          </span>
        )}
        <span className={`whisper-chevron ${isOpen ? 'turned' : ''}`} aria-hidden="true">⌃</span>
      </button>

      {isOpen && (
        <div className="whisper-body" id="whisper-body">
          <div className="whisper-messages" ref={scrollRef} role="log" aria-live="polite" aria-relevant="additions" aria-label="پیام‌های نجوای گروهی">
            {messages.length === 0 && (
              <div className="whisper-empty">
                <span aria-hidden="true">❧</span>
                <p>کوچه ساکت است…<br />نخستین نجوا را شما بفرستید.</p>
              </div>
            )}
            {messages.map((message) => (
              <article className={`whisper-message ${message.type === 'system' ? 'system-message' : ''}`} key={message.id}>
                <div>
                  <strong>{message.senderName || currentPlayerName}</strong>
                  <span className={`whisper-type type-${message.type}`}>{whisperTypeLabel(message.type)}</span>
                  <time dateTime={new Date(message.createdAt || Date.now()).toISOString()}>
                    {new Intl.DateTimeFormat('fa', { hour: '2-digit', minute: '2-digit' }).format(message.createdAt || Date.now())}
                  </time>
                </div>
                <p>{message.text}</p>
              </article>
            ))}
          </div>

          <button
            className="whisper-share-coupon"
            type="button"
            onClick={() => void send(true)}
            disabled={sendState === 'sending' || !couponText}
            aria-busy={sendState === 'sending'}
          >
            <span aria-hidden="true">♙</span> مخابرهٔ کوپنِ دست من به گروه <span aria-hidden="true">↗</span>
          </button>

          <form className="whisper-form" onSubmit={submit}>
            <label className="sr-only" htmlFor="whisper-input">پیام نجوا</label>
            <input
              ref={inputRef}
              id="whisper-input"
              value={text}
              maxLength={WHISPER_MAX_LENGTH}
              enterKeyHint="send"
              onChange={(event) => setText(event.target.value)}
              placeholder="آرام بنویسید…"
              aria-describedby="whisper-counter"
            />
            <button type="submit" disabled={sendState === 'sending' || !draft.canSend} aria-label="فرستادن پیام">
              {sendState === 'sending' ? '…' : '←'}
            </button>
          </form>

          <div className="whisper-meta">
            <span id="whisper-counter" className={`whisper-counter ${draft.remaining <= 20 ? 'is-low' : ''}`}>
              {draft.length.toLocaleString('fa')} / {WHISPER_MAX_LENGTH.toLocaleString('fa')}
            </span>
            <span className="whisper-send-status" role="status" aria-live="polite">{describeSendState(sendState)}</span>
          </div>
        </div>
      )}
      </aside>
    </>
  );
}
