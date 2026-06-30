import { useGridStore } from '../store/gridStore';

/**
 * Statusleiste — Loop-Error-Banner + Zähler + Hilfetext.
 *
 * CSS-Klassen steuern die Sichtbarkeit auf Mobile:
 *   .hint-text  → ausgeblendet auf Mobile (< 600px)
 *   .step-overlay in .canvas-area → übernimmt Zähler auf Mobile
 */
export function SimControls() {
  const steps     = useGridStore(s => s.stepCount);
  const cells     = useGridStore(s => s.grid.size);
  const loopError = useGridStore(s => s.loopError);

  return (
    <div className="status-bar">
      {/* Loop-Error — immer sichtbar wenn gesetzt */}
      {loopError && (
        <div className="loop-error">
          <span style={{ fontSize: 14 }}>⚠</span>
          <strong>SimLoopError —</strong>
          <span>{loopError}</span>
        </div>
      )}

      {/* Zähler + Hilfetext */}
      <div className="status-row">
        <span className="hint-text">
          Klick: Platzieren · Gleicher Typ ⊕: Force · Rechtsklick/Long-Press: Löschen ·
          Alt+Drag: Schwenken · Scroll/Pinch: Zoom
        </span>
        <span style={{ color: 'var(--text-dim)', marginRight: 12 }}>
          Schritt: <span style={{ color: 'var(--sim-blue)' }}>{steps}</span>
        </span>
        <span style={{ color: 'var(--text-dim)' }}>
          Zellen: <span style={{ color: 'var(--sim-blue)' }}>{cells}</span>
        </span>
      </div>
    </div>
  );
}
