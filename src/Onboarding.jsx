// Onboarding — invite the user to add themselves first.

function Onboarding({ onSubmit, onSkip }) {
  const [name, setName] = React.useState('');
  const [birth, setBirth] = React.useState('');
  const inputRef = React.useRef(null);

  React.useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = () => onSubmit({ name: window.capitalizeName(name.trim()) || 'Me', birth: birth.trim() });

  return (
    <div className="onb-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="onb-card">
        <div className="onb-eyebrow">Lineage Tracker · Begin</div>
        <h1 className="onb-title">Start with <em>yourself</em>.</h1>
        <p className="onb-sub">
          A family tree grows outward from a single person. Place yourself at the heart of the canvas; everyone else can branch out from there.
        </p>

        <div className="onb-grid">
          <div className="field" style={{margin:0}}>
            <label className="field-label">Your name</label>
            <input
              ref={inputRef}
              className="field-input"
              placeholder="e.g. Eleanor Hayes"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
          <div className="field" style={{margin:0}}>
            <label className="field-label">Birth year (optional)</label>
            <input
              className="field-input"
              placeholder="e.g. 1992"
              value={birth}
              onChange={(e) => setBirth(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
        </div>

        <div className="onb-actions">
          <button className="tbtn primary" onClick={submit}>
            Plant the tree →
          </button>
          <button className="tbtn onb-skip" onClick={onSkip}>
            Skip — start with empty canvas
          </button>
        </div>
      </div>
    </div>
  );
}

window.Onboarding = Onboarding;
