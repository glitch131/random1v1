'use client';

import { useEffect, useRef, useState } from 'react';
import CopyButton from '@/components/CopyButton';

const CODE_SPLIT = /(\b\d{4}-\d{4}-\d{4}\b)/;
const CODE_EXACT = /^\d{4}-\d{4}-\d{4}$/;

function MessageText({ text }) {
  return text.split(CODE_SPLIT).map((part, i) =>
    CODE_EXACT.test(part) ? (
      <CopyButton
        key={i}
        text={part}
        label={`${part}, tap to copy`}
        copiedLabel={`${part}, copied`}
        className="mx-0.5 my-0.5 inline-block rounded bg-loot px-2 py-0.5 font-semibold tabular-nums text-storm-950 hover:bg-[#FFD36E]"
      />
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function ChatBox({ messages, onSend, disabled, opponentName }) {
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function onScroll() {
    const el = listRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function submit(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    const res = await onSend(value);
    setSending(false);
    if (res.ok) {
      setText('');
      setError(null);
      stickToBottom.current = true;
    } else {
      setError(res.error);
    }
  }

  return (
    <section aria-label="Match chat" className="flex min-h-[26rem] flex-col border border-storm-800 bg-storm-900 lg:h-[34rem]">
      <div
        ref={listRef}
        onScroll={onScroll}
        className="flex-1 space-y-3 overflow-y-auto p-4"
        role="log"
        aria-live="polite"
      >
        {messages.map((m) =>
          m.kind === 'system' ? (
            <p key={m.id} className="mx-auto max-w-md text-center text-xs leading-relaxed text-haze">
              {m.text}
            </p>
          ) : (
            <div key={m.id} className={`flex flex-col ${m.mine ? 'items-end' : 'items-start'}`}>
              <span className={`mb-1 text-xs ${m.mine ? 'text-shield' : 'text-rival'}`}>
                {m.mine ? 'You' : m.author || opponentName}
              </span>
              <p
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-[0.95rem] leading-snug ${
                  m.mine ? 'rounded-br-sm bg-shield/15' : 'rounded-bl-sm bg-rival/15'
                }`}
              >
                <MessageText text={m.text} />
              </p>
            </div>
          )
        )}
      </div>

      <form onSubmit={submit} className="border-t border-storm-800 p-3">
        {error && (
          <p role="alert" className="mb-2 text-xs text-alert">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <label htmlFor="chat-input" className="sr-only">
            Message
          </label>
          <input
            id="chat-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={280}
            disabled={disabled}
            autoComplete="off"
            placeholder="Message, or paste an island code like 1234-5678-9012"
            className="min-w-0 flex-1 rounded-md border border-storm-600 bg-storm-950 px-3 py-2.5 text-ice placeholder:text-storm-600 focus:border-loot focus:outline-none disabled:opacity-50"
          />
          <button type="submit" disabled={disabled || sending || !text.trim()} className="btn-loot px-4 py-2.5">
            Send
          </button>
        </div>
      </form>
    </section>
  );
}
