import { useGridStore } from '../store/gridStore';

/**
 * Simulations-Steuerung: Play/Pause, Schritt, Hz-Slider, Reset.
 * Auf Mobile (< 600px) blendet CSS .hz-control und .reset-btn aus —
 * kein JS-Prop nötig.
 */
export function SimBar() {
  const step       = useGridStore(s => s.step);
  const running    = useGridStore(s => s.isRunning);
  const setRunning = useGridStore(s => s.setRunning);
  const hz         = useGridStore(s => s.hz);
  const setHz      = useGridStore(s => s.setHz);
  const clear      = useGridStore(s => s.clear);

  return (
    <div style={{
      display:     'flex',
      alignItems:  'center',
      gap:         6,
      padding:     '0 8px',
      flexShrink:  0,
    }}>
      {/* Schritt */}
      <button
        className="sim-btn"
        onClick={() => { if (!running) step(); }}
        disabled={running}
        style={{
          background:  'transparent',
          color:       running ? 'var(--border-ui)' : 'var(--sim-blue)',
          borderColor: running ? 'var(--border-ui)' : 'var(--sim-blue)',
        }}
      >
        ⏭<span className="shortcut"> [.]</span>
        <span> Schritt</span>
      </button>

      {/* Play / Pause */}
      <button
        className="sim-btn"
        onClick={() => setRunning(!running)}
        style={{
          background:  running ? 'var(--sim-red)' : 'var(--sim-green)',
          color:       '#000',
          fontWeight:  'bold',
          border:      'none',
        }}
      >
        {running ? '⏸ Pause' : '▶ Play'}
        <span className="shortcut"> [Space]</span>
      </button>

      {/* Hz-Slider — wird auf Mobile via CSS ausgeblendet */}
      <label className="hz-control" style={{
        display:     'flex',
        alignItems:  'center',
        gap:         5,
        fontSize:    11,
        color:       'var(--text-muted)',
        whiteSpace:  'nowrap',
      }}>
        <input
          type="range"
          min={1} max={30} value={hz}
          onChange={e => setHz(+e.target.value)}
          style={{ width: 65, accentColor: 'var(--accent)' }}
        />
        <span style={{ color: 'var(--sim-blue)', minWidth: 32 }}>{hz} Hz</span>
      </label>

      {/* Reset — wird auf Mobile via CSS ausgeblendet */}
      <button
        className="sim-btn reset-btn"
        onClick={clear}
        style={{
          background:  'transparent',
          color:       'var(--cell-delete)',
          borderColor: '#662222',
        }}
      >
        🗑 Reset
      </button>
    </div>
  );
}
