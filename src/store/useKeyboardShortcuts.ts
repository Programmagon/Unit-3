import { useEffect } from 'react';
import { useUIStore }   from './uiStore';
import { useGridStore } from './gridStore';

/**
 * Zentraler Keyboard-Shortcut-Hook.
 *
 * Vorher waren Space/[.] in Toolbar.tsx registriert, obwohl sie zu
 * SimBar gehören — eine versteckte Abhängigkeit. Jetzt lebt die
 * gesamte Tastatur-Logik an einer Stelle (App.tsx), unabhängig davon
 * welche Komponente die zugehörigen Buttons rendert.
 */
export function useKeyboardShortcuts() {
  const setTool    = useUIStore(s => s.setTool);
  const step       = useGridStore(s => s.step);
  const running    = useGridStore(s => s.isRunning);
  const setRunning = useGridStore(s => s.setRunning);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      // Werkzeuge
      if (e.key === '1') setTool('cable');
      if (e.key === '2') setTool('inverter');
      if (e.key === '3') setTool('delay');
      if (e.key === 'e' || e.key === 'E') setTool('delete');

      // Simulation
      if (e.key === ' ') { e.preventDefault(); setRunning(!running); }
      if (e.key === '.' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (!running) step();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, setTool, setRunning, step]);
}
