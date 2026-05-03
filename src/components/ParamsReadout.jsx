/**
 * ParamsReadout — read-only отображение sigma/rho/beta аттрактора.
 * Заменяет MoodTuner — пользователь не управляет настроением вручную.
 *
 * Props:
 *   params: { sigma, rho, beta }
 */

export default function ParamsReadout({ params }) {
  const sigma = params?.sigma ?? 10;
  const rho   = params?.rho   ?? 28;
  const beta  = params?.beta  ?? 2.667;

  return (
    <div className="panel">
      <div className="panel__header">
        <span>ATTRACTOR PARAMS</span>
        <span style={{ color: 'var(--text-faint)', fontSize: 9, letterSpacing: '0.2em' }}>
          READ-ONLY
        </span>
      </div>
      <div className="panel__body">
        <div className="params-readout">
          <div className="params-readout__cell">
            <div className="params-readout__symbol">σ sigma</div>
            <div className="params-readout__value">{sigma.toFixed(2)}</div>
          </div>
          <div className="params-readout__cell">
            <div className="params-readout__symbol">ρ rho</div>
            <div className="params-readout__value">{rho.toFixed(2)}</div>
          </div>
          <div className="params-readout__cell">
            <div className="params-readout__symbol">β beta</div>
            <div className="params-readout__value">{beta.toFixed(3)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
