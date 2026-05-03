/**
 * LorenzPanel — canvas с траекторией аттрактора + бары энергии/фокуса/открытости + raw x/y/z.
 *
 * Props:
 *   trail:    [{ x, y, z, energy, focus, openness, timestamp }]   — последние N точек
 *   current:  { energy, focus, openness, raw_x, raw_y, raw_z }    — текущее состояние
 *   onToggleAscii: () => void
 *   asciiMode: bool
 */

import { useEffect, useRef } from 'react';

const MINT = '#3DDBB1';
const MINT_DIM = 'rgba(61, 219, 177, 0.2)';

export default function LorenzPanel({ trail, current, asciiMode, onToggleAscii }) {
  const canvasRef = useRef(null);

  /* canvas drawing — 3D-в-2D простая ортогональная проекция (x-y plane, z как яркость) */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || asciiMode) return;

    const ctx = canvas.getContext('2d');
    const W = canvas.width  = canvas.offsetWidth  * window.devicePixelRatio;
    const H = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(1, 1);

    ctx.clearRect(0, 0, W, H);

    if (!trail || trail.length === 0) return;

    /* нормализуем raw_x, raw_y, raw_z */
    const xs = trail.map(p => p.x ?? 0);
    const ys = trail.map(p => p.y ?? 0);
    const zs = trail.map(p => p.z ?? 0);

    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const zMin = Math.min(...zs), zMax = Math.max(...zs);

    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    const zRange = zMax - zMin || 1;

    const padding = 24;

    /* trail с угасанием */
    for (let i = 0; i < trail.length; i++) {
      const p = trail[i];
      const t = i / trail.length;             // 0 = старая, 1 = свежая

      const px = padding + ((p.x - xMin) / xRange) * (W - padding * 2);
      const py = padding + ((p.y - yMin) / yRange) * (H - padding * 2);
      const zNorm = (p.z - zMin) / zRange;

      const alpha = 0.05 + 0.5 * t * (0.3 + 0.7 * zNorm);
      ctx.fillStyle = `rgba(61, 219, 177, ${alpha})`;
      ctx.fillRect(px, py, 1.5, 1.5);
    }

    /* текущая точка */
    const last = trail[trail.length - 1];
    if (last) {
      const px = padding + ((last.x - xMin) / xRange) * (W - padding * 2);
      const py = padding + ((last.y - yMin) / yRange) * (H - padding * 2);

      ctx.fillStyle = MINT;
      ctx.shadowColor = MINT;
      ctx.shadowBlur  = 12;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }, [trail, asciiMode]);

  /* ASCII fallback — простая 60×24 проекция */
  const renderAscii = () => {
    if (!trail || trail.length === 0) return ' '.repeat(60).split('').map(() => '·').join('');

    const W = 60, H = 24;
    const grid = Array.from({ length: H }, () => Array(W).fill(' '));

    const xs = trail.map(p => p.x ?? 0);
    const ys = trail.map(p => p.y ?? 0);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);

    const xR = xMax - xMin || 1;
    const yR = yMax - yMin || 1;

    trail.forEach((p, i) => {
      const t = i / trail.length;
      const cx = Math.floor(((p.x - xMin) / xR) * (W - 1));
      const cy = Math.floor(((p.y - yMin) / yR) * (H - 1));
      if (cx < 0 || cx >= W || cy < 0 || cy >= H) return;
      const char = t < 0.3 ? '·' : t < 0.6 ? '∙' : t < 0.9 ? '▒' : '█';
      grid[cy][cx] = char;
    });

    /* пульсирующая текущая точка */
    const last = trail[trail.length - 1];
    if (last) {
      const cx = Math.floor(((last.x - xMin) / xR) * (W - 1));
      const cy = Math.floor(((last.y - yMin) / yR) * (H - 1));
      if (cx >= 0 && cx < W && cy >= 0 && cy < H) {
        grid[cy][cx] = '●';
      }
    }

    return grid.map(row => row.join('')).join('\n');
  };

  const safe = (v, p = 2) => (typeof v === 'number' ? v.toFixed(p) : '—');

  return (
    <div className="panel">
      <div className="panel__header">
        <span>LORENZ STATE</span>
        <button className="panel__header-action" onClick={onToggleAscii}>
          {asciiMode ? 'CANVAS' : 'ASCII'}
        </button>
      </div>

      {asciiMode ? (
        <div className="ascii-zone">{renderAscii()}</div>
      ) : (
        <canvas ref={canvasRef} className="lorenz-canvas" />
      )}

      <div className="mood-bars">
        <div className="mood-bar">
          <span className="mood-bar__label">ENERGY</span>
          <div className="mood-bar__track">
            <div className="mood-bar__fill" style={{ width: `${(current?.energy ?? 0.5) * 100}%` }} />
          </div>
          <span className="mood-bar__value">{Math.round((current?.energy ?? 0.5) * 100)}</span>
        </div>

        <div className="mood-bar">
          <span className="mood-bar__label">FOCUS</span>
          <div className="mood-bar__track">
            <div className="mood-bar__fill" style={{ width: `${(current?.focus ?? 0.5) * 100}%` }} />
          </div>
          <span className="mood-bar__value">{Math.round((current?.focus ?? 0.5) * 100)}</span>
        </div>

        <div className="mood-bar">
          <span className="mood-bar__label">OPENNESS</span>
          <div className="mood-bar__track">
            <div className="mood-bar__fill" style={{ width: `${(current?.openness ?? 0.5) * 100}%` }} />
          </div>
          <span className="mood-bar__value">{Math.round((current?.openness ?? 0.5) * 100)}</span>
        </div>

        <div className="lorenz-raw">
          <span>x {safe(current?.raw_x)}</span>
          <span>y {safe(current?.raw_y)}</span>
          <span>z {safe(current?.raw_z)}</span>
        </div>
      </div>
    </div>
  );
}
