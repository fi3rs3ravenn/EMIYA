import { useState } from 'react';

const CHAIN = ['INPUT', 'L-meta', 'L0/L1', 'validator', 'OUT'];

function normalizeStepName(name) {
  if (name === 'L0' || name === 'L1') return 'L0/L1';
  return name;
}

function getStep(run, label) {
  return run?.steps?.find((step) => normalizeStepName(step.name) === label);
}

export default function PipelineView({ runs }) {
  const [selected, setSelected] = useState(null);
  const run = runs?.length ? runs[runs.length - 1] : null;
  const selectedStep = selected ? getStep(run, selected) : null;

  return (
    <div className="panel pipeline-panel">
      <div className="panel__header">
        <span>PIPELINE</span>
        <span style={{ color: 'var(--text-faint)', fontSize: 9, letterSpacing: '0.15em' }}>
          {run?.status?.toUpperCase?.() ?? 'IDLE'}
        </span>
      </div>
      <div className="panel__body">
        <div className="pipeline-chain">
          {CHAIN.map((label) => {
            const step = getStep(run, label);
            const state = step ? step.status : run?.status === 'active' && label === 'L0/L1' ? 'active' : 'idle';
            return (
              <button
                key={label}
                type="button"
                className={`pipeline-step pipeline-step--${state}`}
                onClick={() => setSelected(selected === label ? null : label)}
              >
                <span className="pipeline-step__label">{label}</span>
                <span className="pipeline-step__latency">
                  {step?.latency_ms != null ? `${step.latency_ms}ms` : '--'}
                </span>
              </button>
            );
          })}
        </div>

        {run ? (
          <div className="pipeline-meta">
            <span>{run.request_id?.slice(0, 8)}</span>
            <span>{run.latency_ms != null ? `${run.latency_ms}ms` : 'running'}</span>
          </div>
        ) : (
          <div className="pipeline-empty">NO REQUESTS</div>
        )}

        {selectedStep ? (
          <pre className="pipeline-details">
            {JSON.stringify(selectedStep.details ?? {}, null, 2)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
