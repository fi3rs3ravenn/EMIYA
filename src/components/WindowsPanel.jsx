/**
 * WindowsPanel — список активных окон + detected state.
 *
 * Props:
 *   apps:    [{ app, type, minutes }]
 *   states:  [string]
 *   activeMinutes: number
 */

const formatMinutes = (m) => {
  if (typeof m !== 'number') return '—';
  if (m < 60) return `${m.toFixed(1)}m`;
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return `${h}h${min}m`;
};

const cleanName = (name) => {
  if (!name) return '—';
  return name.replace(/\.exe$/i, '');
};

export default function WindowsPanel({ apps, states, activeMinutes }) {
  const list = (apps ?? []).slice(0, 6);
  const stateText = states && states.length > 0 ? states.join(' / ') : 'normal';

  return (
    <div className="panel">
      <div className="panel__header">
        <span>ACTIVE WINDOWS</span>
        <span style={{ color: 'var(--text-faint)', fontSize: 9 }}>
          {formatMinutes(activeMinutes)} TOTAL
        </span>
      </div>
      <div className="panel__body">
        {list.length === 0 ? (
          <div style={{ color: 'var(--text-faint)', fontSize: 11, padding: 8, textAlign: 'center' }}>
            нет данных
          </div>
        ) : (
          <div className="windows-list">
            {list.map((p, i) => (
              <div
                key={`${p.app}-${i}`}
                className={`windows-row ${i === 0 ? 'windows-row--active' : ''}`}
              >
                <span className="windows-row__name">{cleanName(p.app)}</span>
                <span className="windows-row__type">{p.type ?? 'other'}</span>
                <span className="windows-row__time">{formatMinutes(p.minutes)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="detected-state">
          DETECTED · {stateText.toUpperCase()}
        </div>
      </div>
    </div>
  );
}
