const TRAITS = [
  { key: 'curiosity', label: 'CURIOSITY' },
  { key: 'bluntness', label: 'BLUNTNESS' },
  { key: 'warmth', label: 'WARMTH' },
  { key: 'sarcasm', label: 'SARCASM' },
  { key: 'formality', label: 'FORMALITY' },
];

const PRESETS = ['default', 'unhinged', 'professional', 'tired friend'];

function describeTrait(key, value) {
  if (key === 'curiosity') {
    if (value > 66) return 'notices details';
    if (value < 34) return 'does not pull';
    return 'asks rarely';
  }
  if (key === 'bluntness') {
    if (value > 66) return 'cuts direct';
    if (value < 34) return 'soft edge';
    return 'plain speech';
  }
  if (key === 'warmth') {
    if (value > 66) return 'warmer';
    if (value < 34) return 'cold distance';
    return 'brief warmth';
  }
  if (key === 'sarcasm') {
    if (value > 66) return 'more bite';
    if (value < 34) return 'dry only';
    return 'light irony';
  }
  if (value > 66) return 'formal';
  if (value < 34) return 'loose';
  return 'controlled';
}

export default function PersonalityPanel({ traits, onChange, onPreset }) {
  const current = traits ?? {};

  const updateTrait = (key, value) => {
    onChange?.({ ...current, [key]: Number(value) });
  };

  return (
    <div className="panel">
      <div className="panel__header">
        <span>PERSONALITY</span>
        <span style={{ color: 'var(--text-faint)', fontSize: 9, letterSpacing: '0.2em' }}>
          SPRINT 2
        </span>
      </div>
      <div className="panel__body">
        <div className="trait-presets">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className="trait-preset"
              onClick={() => onPreset?.(preset)}
            >
              {preset}
            </button>
          ))}
        </div>

        <div className="trait-list">
          {TRAITS.map(({ key, label }) => {
            const value = current[key] ?? 0;
            return (
              <label key={key} className="trait-row">
                <span className="trait-row__top">
                  <span className="trait-row__label">{label}</span>
                  <span className="trait-row__value">{value}</span>
                </span>
                <input
                  className="trait-row__slider"
                  type="range"
                  min="0"
                  max="100"
                  value={value}
                  onChange={(event) => updateTrait(key, event.target.value)}
                />
                <span className="trait-row__hint">{describeTrait(key, value)}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
