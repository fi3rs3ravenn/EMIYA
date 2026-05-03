/**
 * AsciiArtZone — placeholder для будущего mood-зависимого ASCII.
 *
 * Сейчас рисует один из 6 базовых паттернов в зависимости от mood-зоны.
 * В будущем backend будет генерировать арт через L0 — заменишь на проп.
 *
 * Props:
 *   current: { energy, focus, openness }
 */

const PATTERNS = {
  /* low / low / low — упадок, разреженная сетка */
  low_low_low: `
  ·   ·       ·
       ·          ·
  ·         ·
        ·                ·
  ·   ·          ·
       ·    ·
  ·                  ·`,

  /* high / high / high — разгон, плотный паттерн */
  high_high_high: `
  ▓▒░ ░▒▓░▒░ ▓▒░░▓░
  ░▓▒░▓▒░▓▒░ ▓▒░▓▒░
  ▒▓░▒▓▒░▒▓▒ ░▓▒░▓░
  ▓░▒▓░▒▓░▒▓ ░▓░▒▓░
  ▒▓░▒░▓▒░▓▒ ░▓▒░▓░
  ░▓▒░▓░▒▓░▒ ▓▒░▓▒░
  ▓▒░▓▒░▓▒░▓ ▒░▓▒░▓`,

  /* mid / mid / mid — нейтральный геометрический */
  mid_mid_mid: `
  ┌─────────────┐
  │ · · · · · · │
  │ ·         · │
  │   ╱─────╲   │
  │   │  ●  │   │
  │   ╲─────╱   │
  │ ·         · │
  │ · · · · · · │
  └─────────────┘`,

  /* low / high / low — холодная сосредоточенность */
  cold_focus: `
       │
       │
   ────┼────
       │
       │
       ▼
       ●
       ▲
       │
   ────┼────
       │
       │`,

  /* high / low / high — расхристанная */
  scattered: `
  ▓ ░  ▒  ▓░  ▒
       ░▓ ░ ▒
   ▒  ░▓  ▒░ ▓
  ░▒    ▓ ▒
   ▓  ▒  ░  ▒░
  ▒░ ▓ ░  ▒  ░`,

  /* fallback */
  default: `
  ·  ·  ·  ·  ·
  ·     ●     ·
  ·  ·  ·  ·  ·`,
};

const zone = (v) => (v < 0.4 ? 'low' : v < 0.6 ? 'mid' : 'high');

export default function AsciiArtZone({ current }) {
  const e = current?.energy   ?? 0.5;
  const f = current?.focus    ?? 0.5;
  const o = current?.openness ?? 0.5;

  const ez = zone(e), fz = zone(f), oz = zone(o);

  let pattern;
  if (ez === 'low' && fz === 'low' && oz === 'low') pattern = PATTERNS.low_low_low;
  else if (ez === 'high' && fz === 'high' && oz === 'high') pattern = PATTERNS.high_high_high;
  else if (ez === 'mid' && fz === 'mid' && oz === 'mid') pattern = PATTERNS.mid_mid_mid;
  else if (ez === 'low' && fz === 'high' && oz === 'low') pattern = PATTERNS.cold_focus;
  else if (ez === 'high' && fz === 'low' && oz === 'high') pattern = PATTERNS.scattered;
  else pattern = PATTERNS.default;

  return (
    <div className="panel">
      <div className="panel__header">
        <span>STATE GLYPH</span>
        <span style={{ color: 'var(--text-faint)', fontSize: 9 }}>
          {ez.toUpperCase()} · {fz.toUpperCase()} · {oz.toUpperCase()}
        </span>
      </div>
      <div className="panel__body">
        <pre className="ascii-zone">{pattern}</pre>
      </div>
    </div>
  );
}
