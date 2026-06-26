import { useEffect } from 'react';
import { useUIStore }   from '../store/uiStore';
import { useGridStore } from '../store/gridStore';
import type { Tool }    from '../canvas/input';

const TOOLS: { id: Tool; icon: string; label: string; shortcut: string; color: string }[] = [
  { id: 'cable',    icon: '━', label: 'Kabel',      shortcut: '1', color: '#00ff88' },
  { id: 'inverter', icon: '◇', label: 'Umkehrer',   shortcut: '2', color: '#ff9900' },
  { id: 'delay',    icon: '▷', label: 'Verzögerer', shortcut: '3', color: '#bb44ff' },
  { id: 'delete',   icon: '✕', label: 'Löschen',    shortcut: 'E', color: '#ff4455' },
];

export function Toolbar() {
  const tool       = useUIStore(s => s.tool);
  const setTool    = useUIStore(s => s.setTool);
  const step       = useGridStore(s => s.step);
  const running    = useGridStore(s => s.isRunning);
  const setRunning = useGridStore(s => s.setRunning);
  const hz         = useGridStore(s => s.hz);
  const setHz      = useGridStore(s => s.setHz);
  const clear      = useGridStore(s => s.clear);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.key === '1') setTool('cable');
      if (e.key === '2') setTool('inverter');
      if (e.key === '3') setTool('delay');
      if (e.key === 'e' || e.key === 'E') setTool('delete');
      if (e.key === ' ')  { e.preventDefault(); setRunning(!running); }
      if (e.key === '.' || e.key === 'ArrowRight') { e.preventDefault(); if (!running) step(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, setTool, setRunning, step]);

  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 10px',
      background:'#0f0f2a', borderBottom:'1px solid #1c1c48',
      fontFamily:"'Courier New',monospace", flexShrink:0 }}>
      <span style={{ color:'#4455ee', fontWeight:'bold', fontSize:14, marginRight:4 }}>▣ Unit-3</span>
      <div style={{ display:'flex', gap:3 }}>
        {TOOLS.map(t => (
          <button key={t.id} onClick={() => setTool(t.id)} style={{
            padding:'3px 10px', borderRadius:3, cursor:'pointer', fontSize:11,
            fontFamily:'inherit', outline:'none',
            background: tool === t.id ? t.color : 'transparent',
            color:       tool === t.id ? '#000' : t.color,
            border:     `1px solid ${t.color}55`,
            fontWeight:  tool === t.id ? 'bold' : 'normal',
          }}>
            {t.icon} {t.label} <span style={{ opacity:.35 }}>[{t.shortcut}]</span>
          </button>
        ))}
      </div>
      <div style={{ flex:1 }} />
      <button onClick={() => { if (!running) step(); }} disabled={running} style={{
        padding:'3px 10px', borderRadius:3, cursor: running ? 'default' : 'pointer',
        fontFamily:'inherit', fontSize:11, outline:'none', background:'transparent',
        color: running ? '#2a2a5a' : '#4488cc',
        border: `1px solid ${running ? '#1a1a44' : '#4488cc'}`,
      }}>⏭ Schritt [.]</button>
      <button onClick={() => setRunning(!running)} style={{
        padding:'3px 14px', borderRadius:3, cursor:'pointer', fontSize:11,
        fontFamily:'inherit', fontWeight:'bold', border:'none', outline:'none',
        background: running ? '#cc3333' : '#00aa55', color:'#000',
      }}>{running ? '⏸ Pause' : '▶ Play'} [Space]</button>
      <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#445' }}>
        <input type="range" min={1} max={30} value={hz}
          onChange={e => setHz(+e.target.value)}
          style={{ width:65, accentColor:'#4455ee' }} />
        <span style={{ color:'#4488cc', minWidth:32 }}>{hz} Hz</span>
      </label>
      <button onClick={clear} style={{
        padding:'3px 8px', borderRadius:3, cursor:'pointer', fontSize:11,
        fontFamily:'inherit', background:'transparent',
        color:'#cc4444', border:'1px solid #662222', outline:'none',
      }}>🗑 Reset</button>
    </div>
  );
}
