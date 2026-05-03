/**
 * MoodInfluence — список последних nudge событий.
 * Показывает что толкает её настроение из реального мира.
 *
 * Props:
 *   events: [{ source, axis, delta, timestamp }]
 */

const formatTime = (ts) => {
  if (!ts) return '—';
  try {
    const d = typeof ts === 'string' ? new Date(ts) : new Date();
    return d.toTimeString().slice(0, 8);
  } catch {
    return '—';
  }
};

export default function MoodInfluence({ events }) {
  const list = events?.slice(-8).reverse() ?? [];

  return (
    <div className="panel">
      <div className="panel__header">
        <span>MOOD INFLUENCE</span>
        <span style={{ color: 'var(--text-faint)', fontSize: 9 }}>
          {list.length}
        </span>
      </div>
      <div className="panel__body">
        {list.length === 0 ? (
          <div style={{ color: 'var(--text-faint)', fontSize: 11, padding: 8, textAlign: 'center' }}>
            нет событий
          </div>
        ) : (
          <div className="influence-list">
            {list.map((ev, i) => (
              <div key={i} className="influence-row">
                <span className="influence-row__source">
                  {ev.source ?? '—'}
                </span>
                <span className={`influence-row__delta ${ev.delta >= 0 ? 'influence-row__delta--pos' : 'influence-row__delta--neg'}`}>
                  {ev.axis}{ev.delta >= 0 ? '+' : ''}{ev.delta?.toFixed(1) ?? '0'}
                </span>
                <span className="influence-row__time">
                  {formatTime(ev.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
