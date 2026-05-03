/**
 * BankBlock — переиспользуемый блок (как BANK 1 / BANK 2 на референсе).
 *
 * Props:
 *   title:  string
 *   lines:  [{ text, muted? }]
 */

export default function BankBlock({ title, lines }) {
  return (
    <div className="bank">
      <div className="bank__title">{title}</div>
      {lines && lines.length > 0 ? (
        lines.map((line, i) => (
          <div
            key={i}
            className={`bank__line ${line.muted ? 'bank__line--muted' : ''}`}
          >
            {line.text}
          </div>
        ))
      ) : (
        <div className="bank__line bank__line--muted">—</div>
      )}
    </div>
  );
}
