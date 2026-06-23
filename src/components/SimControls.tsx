import { useGridStore } from '../store/gridStore';
export function SimControls() {
  const steps = useGridStore(s => s.stepCount);
  const cells = useGridStore(s => s.grid.size);
  const loopError = useGridStore(s => s.loopError);
  return (
    <>
      {loopError && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px',
          background:'#2a0000', borderTop:'1px solid #880000',
          fontFamily:"'Courier New',monospace", fontSize:11, color:'#ff6666', flexShrink:0 }}>
          <span style={{ fontSize:14 }}>⚠</span>
          <strong>SimLoopError —</strong>
          <span>{loopError}</span>
        </div>
      )}
      <div style={{ display:'flex', padding:'3px 10px', background:'#0f0f2a',
        borderTop:'1px solid #1c1c48', fontFamily:"'Courier New',monospace",
        fontSize:10, color:'#334466', flexShrink:0 }}>
        <span>Klick: Platzieren · Gleicher Typ: Zustand umschalten · Rechtsklick / Long-Press: Löschen · Alt+Ziehen: Schwenken · Scroll / Pinch: Zoom</span>
        <div style={{ flex:1 }} />
        <span style={{ marginRight:12 }}>Schritt: <span style={{ color:'#4488cc' }}>{steps}</span></span>
        <span>Zellen: <span style={{ color:'#4488cc' }}>{cells}</span></span>
      </div>
    </>
  );
}
