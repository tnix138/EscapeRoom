'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

interface WhisperMessage { id: string; senderName: string; type: 'whisper' | 'ticket_share' | 'system'; text: string; createdAt: number }
interface WhisperChatPanelProps {
  messages: WhisperMessage[];
  currentPlayerName: string;
  couponText: string;
  onSendWhisper: (text: string, shareStub?: boolean) => Promise<void>;
}

export default function WhisperChatPanel({ messages, currentPlayerName, couponText, onSendWhisper }: WhisperChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const unread = messages.length;

  useEffect(() => {
    if (isOpen) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [isOpen, messages.length]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanText = text.trim();
    if (!cleanText || isSending) return;
    setIsSending(true);
    try {
      await onSendWhisper(cleanText, false);
      setText('');
    } finally {
      setIsSending(false);
    }
  }

  async function shareCoupon() {
    if (isSending) return;
    setIsSending(true);
    try {
      await onSendWhisper(couponText, true);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <aside className={`whisper-panel ${isOpen ? 'whisper-expanded' : ''}`} aria-label="نجوای گروهی">
      <button className="whisper-toggle" type="button" onClick={() => setIsOpen((value) => !value)} aria-expanded={isOpen}>
        <span className="whisper-icon">♧</span><span className="whisper-toggle-text"><strong>نجوای گروهی</strong><small>{isOpen ? `${unread.toLocaleString('fa')} پیام` : 'با هم‌تیمی‌هایتان حرف بزنید'}</small></span>
        {!isOpen && unread > 0 && <span className="whisper-count">{unread.toLocaleString('fa')}</span>}
        <span className={`whisper-chevron ${isOpen ? 'turned' : ''}`}>⌃</span>
      </button>
      {isOpen && <>
        <div className="whisper-messages" ref={scrollRef} aria-live="polite">
          {messages.length === 0 && <div className="whisper-empty"><span>❧</span><p>کوچه ساکت است…<br />نخستین نجوا را شما بفرستید.</p></div>}
          {messages.map((message) => <article className={`whisper-message ${message.type === 'system' ? 'system-message' : ''}`} key={message.id}>
            <div><strong>{message.senderName || currentPlayerName}</strong><time>{new Intl.DateTimeFormat('fa', { hour: '2-digit', minute: '2-digit' }).format(message.createdAt || Date.now())}</time></div>
            <p>{message.text}</p>
          </article>)}
        </div>
        <button className="whisper-share-coupon" type="button" onClick={() => void shareCoupon()} disabled={isSending}>♙ مخابرهٔ کوپنِ دست من به گروه <span>↗</span></button>
        <form className="whisper-form" onSubmit={submit}><input value={text} maxLength={240} onChange={(event) => setText(event.target.value)} placeholder="آرام بنویسید…" aria-label="پیام نجوا" /><button type="submit" disabled={isSending || !text.trim()} aria-label="فرستادن پیام">{isSending ? '…' : '←'}</button></form>
      </>}
    </aside>
  );
}
