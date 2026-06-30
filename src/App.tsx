import { useEffect, useRef } from 'react';
import { Canvas }       from './components/Canvas';
import { Toolbar }      from './components/Toolbar';
import { SimBar }       from './components/SimBar';
import { SimControls }  from './components/SimControls';
import { useGridStore } from './store/gridStore';
import { useKeyboardShortcuts } from './store/useKeyboardShortcuts';

export default function App() {
  const step      = useGridStore(s => s.step);
  const isRunning = useGridStore(s => s.isRunning);
  const hz        = useGridStore(s => s.hz);
  const steps     = useGridStore(s => s.stepCount);
  const cells     = useGridStore(s => s.grid.size);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Zentrale Tastatur-Shortcuts — unabhängig davon welche Komponente
  // die zugehörigen Buttons rendert (Toolbar / SimBar)
  useKeyboardShortcuts();

  // Simulations-Schleife
  useEffect(() => {
    if (!isRunning) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(step, 1000 / hz);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, hz, step]);

  return (
    /*
      Layout läuft komplett über CSS Grid (index.css, .app-layout).
      Die drei Kinder werden per grid-area positioniert — DOM-Reihenfolge
      bleibt für Tab-Navigation/Screenreader gleich, nur die visuelle
      Anordnung ändert sich responsiv:
        Desktop (≥ 600px):  toolbar → canvas → status
        Mobile  (< 600px):  canvas  → status → toolbar
      Kein JavaScript für Layout-Entscheidungen.
    */
    <div className="app-layout">

      {/* ── Toolbar + SimBar ─────────────────────────────────────
          Desktop: oben, eine Zeile nebeneinander
          Mobile:  unten, zwei Zeilen übereinander (flex-direction: column)
      ────────────────────────────────────────────────────────── */}
      <header className="top-bar">
        <Toolbar />
        <SimBar />
      </header>

      {/* ── Canvas ───────────────────────────────────────────────
          Füllt den verbleibenden Platz (flex: 1).
          .step-overlay: absolut positioniert, nur auf Mobile sichtbar.
      ────────────────────────────────────────────────────────── */}
      <div className="canvas-area">
        <Canvas />
        <div className="step-overlay">
          {steps} Schritte · {cells} Zellen
        </div>
      </div>

      {/* ── Statusleiste ─────────────────────────────────────────
          Loop-Error-Banner + Zähler + Hilfetext.
          Hilfetext wird auf Mobile per CSS ausgeblendet.
      ────────────────────────────────────────────────────────── */}
      <SimControls />

    </div>
  );
}
