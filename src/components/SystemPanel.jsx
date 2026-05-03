/**
 * SystemPanel — CPU / RAM / VRAM / GPU temp + session info.
 *
 * Props:
 *   sys: { cpu_pct, ram_pct, vram_pct, gpu_temp_c, uptime, started_at }
 */

const safe = (v, def = '—', suffix = '') =>
  typeof v === 'number' ? `${Math.round(v)}${suffix}` : def;

const width = (v) => (typeof v === 'number' ? `${Math.max(0, Math.min(100, v))}%` : '0%');

export default function SystemPanel({ sys }) {
  const cpu  = sys?.cpu_pct;
  const ram  = sys?.ram_pct;
  const vram = sys?.vram_pct;
  const temp = sys?.gpu_temp_c;

  return (
    <div className="panel">
      <div className="panel__header">
        <span>SYSTEM</span>
      </div>
      <div className="panel__body">
        <div className="sys-bars">
          <div className="sys-bar">
            <span className="sys-bar__label">CPU</span>
            <div className="sys-bar__track">
              <div
                className={`sys-bar__fill ${cpu > 80 ? 'sys-bar__fill--warn' : ''}`}
                style={{ width: width(cpu) }}
              />
            </div>
            <span className="sys-bar__value">{safe(cpu, '—', '%')}</span>
          </div>

          <div className="sys-bar">
            <span className="sys-bar__label">RAM</span>
            <div className="sys-bar__track">
              <div
                className={`sys-bar__fill ${ram > 85 ? 'sys-bar__fill--warn' : ''}`}
                style={{ width: width(ram) }}
              />
            </div>
            <span className="sys-bar__value">{safe(ram, '—', '%')}</span>
          </div>

          <div className="sys-bar">
            <span className="sys-bar__label">VRAM</span>
            <div className="sys-bar__track">
              <div
                className={`sys-bar__fill ${vram > 85 ? 'sys-bar__fill--warn' : ''}`}
                style={{ width: width(vram) }}
              />
            </div>
            <span className="sys-bar__value">{safe(vram, '—', '%')}</span>
          </div>
        </div>

        <div className="sys-meta">
          <div className="sys-meta__row">
            <span>GPU TEMP</span>
            <span className="sys-meta__value">{safe(temp, '—', '°C')}</span>
          </div>
          <div className="sys-meta__row">
            <span>UPTIME</span>
            <span className="sys-meta__value">{sys?.uptime ?? '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
