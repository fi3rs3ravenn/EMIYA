/**
 * ChatPanel — полноценный чат во всю основную зону.
 * Сохраняет всю текущую логику отправки/приёма сообщений.
 *
 * Props:
 *   messages:    [{ role, content, timestamp, model?, thought? }]
 *   onSend:      (text) => void
 *   isWaiting:   bool
 */

import { useEffect, useRef, useState } from 'react';

const formatTime = (ts) => {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toTimeString().slice(0, 8);
  } catch {
    return '';
  }
};

function ChatMessage({ msg }) {
  const [thoughtOpen, setThoughtOpen] = useState(false);
  const isUser = msg.role === 'user';

  return (
    <div className={`chat-msg ${isUser ? 'chat-msg--user' : 'chat-msg--emiya'}`}>
      <div className="chat-msg__meta">
        <span>{isUser ? 'YOU' : 'EMIYA'}</span>
        {msg.model && <span className="chat-msg__model">{msg.model.toUpperCase()}</span>}
        <span style={{ marginLeft: 'auto' }}>{formatTime(msg.timestamp)}</span>
      </div>
      <div className="chat-msg__body">{msg.content}</div>

      {msg.thought && (
        <div className="chat-thought" onClick={() => setThoughtOpen(!thoughtOpen)}>
          <span className="chat-thought__label">THOUGHT</span>
          {thoughtOpen ? '▼ скрыть' : '▶ показать'}
          {thoughtOpen && (
            <div className="chat-thought__body">{msg.thought}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChatPanel({ messages, onSend, isWaiting }) {
  const [input, setInput]     = useState('');
  const historyRef            = useRef(null);

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || isWaiting) return;
    onSend(text);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="chat-wrap">
      <div className="chat-history" ref={historyRef}>
        {messages.length === 0 ? (
          <div style={{ color: 'var(--text-faint)', textAlign: 'center', padding: 40, letterSpacing: '0.2em' }}>
            DIALOGUE CHANNEL OPEN
          </div>
        ) : (
          messages.map((msg, i) => <ChatMessage key={i} msg={msg} />)
        )}
        {isWaiting && (
          <div className="chat-msg chat-msg--emiya">
            <div className="chat-msg__meta">
              <span>EMIYA</span>
              <span>...</span>
            </div>
            <div className="chat-msg__body" style={{ opacity: 0.5 }}>обдумывает</div>
          </div>
        )}
      </div>

      <div className="chat-input-zone">
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="написать emiya..."
          disabled={isWaiting}
        />
        <button
          className="chat-send"
          onClick={handleSubmit}
          disabled={isWaiting || !input.trim()}
        >
          →
        </button>
      </div>
    </div>
  );
}
