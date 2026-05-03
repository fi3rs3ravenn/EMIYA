/**
 * LogPanel — таб с логами: mood history, raw responses, debug events.
 *
 * Props:
 *   moodHistory:    [{ timestamp, energy, focus, openness }]
 *   chatLog:        [{ timestamp, source, content, raw_response, model }]
 *   triggerEvents:  [{ timestamp, trigger, message }]
 */

const formatTime = (ts) => {
  if (!ts) return '—';
  try {
    return new Date(ts).toTimeString().slice(0, 8);
  } catch {
    return '—';
  }
};

const trimText = (s, n = 60) => {
  if (!s) return '';
  if (s.length <= n) return s;
  return s.slice(0, n) + '…';
};

export default function LogPanel({ moodHistory, chatLog, triggerEvents }) {
  return (
    <div className="log-wrap">
      <div className="log-section">
        <div className="log-section__title">MOOD HISTORY · LAST 20</div>
        {(!moodHistory || moodHistory.length === 0) ? (
          <div style={{ color: 'var(--text-faint)', fontSize: 11, padding: 8 }}>нет данных</div>
        ) : (
          moodHistory.slice(-20).reverse().map((p, i) => (
            <div key={i} className="log-line">
              <span className="log-line__time">{formatTime(p.timestamp)}</span>
              <span className="log-line__tag">MOOD</span>
              <span className="log-line__body">
                e={p.energy?.toFixed(3) ?? '—'} · f={p.focus?.toFixed(3) ?? '—'} · o={p.openness?.toFixed(3) ?? '—'}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="log-section">
        <div className="log-section__title">CHAT LOG · LAST 30</div>
        {(!chatLog || chatLog.length === 0) ? (
          <div style={{ color: 'var(--text-faint)', fontSize: 11, padding: 8 }}>нет сообщений</div>
        ) : (
          chatLog.slice(-30).reverse().map((m, i) => (
            <div key={i} className="log-line">
              <span className="log-line__time">{formatTime(m.timestamp)}</span>
              <span className="log-line__tag">{(m.source ?? '?').toUpperCase()}</span>
              <span className="log-line__body">{trimText(m.content, 80)}</span>
            </div>
          ))
        )}
      </div>

      <div className="log-section">
        <div className="log-section__title">TRIGGER EVENTS · LAST 10</div>
        {(!triggerEvents || triggerEvents.length === 0) ? (
          <div style={{ color: 'var(--text-faint)', fontSize: 11, padding: 8 }}>нет триггеров</div>
        ) : (
          triggerEvents.slice(-10).reverse().map((t, i) => (
            <div key={i} className="log-line">
              <span className="log-line__time">{formatTime(t.timestamp)}</span>
              <span className="log-line__tag">{(t.trigger ?? 'EVENT').toUpperCase()}</span>
              <span className="log-line__body">{trimText(t.message, 80)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
