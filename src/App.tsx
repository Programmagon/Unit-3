import { useEffect, useRef } from 'react';
import { Canvas }       from './components/Canvas';
import { Toolbar }      from './components/Toolbar';
import { SimControls }  from './components/SimControls';
import { useGridStore } from './store/gridStore';

export default function App() {
  const step      = useGridStore(s => s.step);
  const isRunning = useGridStore(s => s.isRunning);
  const hz        = useGridStore(s => s.hz);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simulations-Schleife lebt in App, nicht in der Simulation selbst
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(step, 1000 / hz);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, hz, step]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh',
      background: '#0b0b1e', overflow: 'hidden' }}>
      <Toolbar />
      <Canvas />
      <SimControls />
    </div>
  );
}
