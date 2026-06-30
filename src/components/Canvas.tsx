import { useRef, useEffect, useCallback } from 'react';
import { useGridStore }      from '../store/gridStore';
import { useUIStore }        from '../store/uiStore';
import { renderFrame }       from '../canvas/renderer';
import { PointerController } from '../canvas/input';
import { zoomAtPoint }       from '../canvas/coordinates';
import type { Camera }       from '../canvas/coordinates';
import type { Tool }         from '../canvas/input';

// Kamera-Startwert — lebt als Ref, kein Zustand, keine React-Re-Renders
const INITIAL_CAMERA: Camera = { x: -15, y: -9, zoom: 36 };

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctrlRef   = useRef<PointerController | null>(null);

  // ── Kamera als Ref — direktes Mutieren, kein Zustand ─────────────────
  // Pan und Zoom mutieren cameraRef.current direkt und setzen dirtyRef=true.
  // Der rAF-Loop zeichnet den nächsten Frame wenn dirty — kein React-Overhead.
  const cameraRef = useRef<Camera>({ ...INITIAL_CAMERA });
  const dirtyRef  = useRef(true);
  const rafRef    = useRef(0);

  // ── Grid aus Zustand (nur für Platzieren/Löschen nötig) ───────────────
  const grid         = useGridStore(s => s.grid);
  const setCell      = useGridStore(s => s.setCell);
  const delCell      = useGridStore(s => s.deleteCell);
  const toggleForced = useGridStore(s => s.toggleForced);
  const gridRef      = useRef(grid);
  gridRef.current    = grid; // immer aktuell für Event-Handler

  // ── Werkzeug ──────────────────────────────────────────────────────────
  const tool      = useUIStore(s => s.tool);
  const toolRef   = useRef<Tool>(tool);
  useEffect(() => { toolRef.current = tool; }, [tool]);

  // ── Zeichnen ──────────────────────────────────────────────────────────
  // Liest ausschließlich aus Refs — kein React-Kontext nötig.
  const draw = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderFrame(ctx, gridRef.current, cameraRef.current, c.clientWidth, c.clientHeight);
  }, []); // keine Deps — liest aus stabilen Refs

  // ── rAF-Loop ──────────────────────────────────────────────────────────
  // Zeichnet nur wenn dirty, entkoppelt Drawing von React-Render-Zyklen.
  // Pan/Zoom: dirty=true → nächster Frame → draw. Kein Zustand, kein Re-Render.
  useEffect(() => {
    dirtyRef.current = true;
    const loop = () => {
      if (dirtyRef.current) { draw(); dirtyRef.current = false; }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // Grid-Änderung (Zustand) → dirty markieren → rAF zeichnet nächsten Frame
  useEffect(() => { dirtyRef.current = true; }, [grid]);

  // ── HiDPI-Resize ──────────────────────────────────────────────────────
  useEffect(() => {
    const c = canvasRef.current!;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      c.width  = c.clientWidth  * dpr;
      c.height = c.clientHeight * dpr;
      dirtyRef.current = true;
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  // ── PointerController einrichten ──────────────────────────────────────
  useEffect(() => {
    const c = canvasRef.current!;

    const ctrl = new PointerController(
      c,
      {
        onPlace: (cx, cy, isDrag) => {
          const t  = toolRef.current;
          const g  = gridRef.current;
          const k  = `${cx},${cy}`;

          if (t === 'delete') { delCell(cx, cy); return; }

          if (!g.has(k)) {
            setCell(cx, cy, t);
          } else if (!isDrag) {
            const cell = g.get(k)!;
            if (cell.type === t) {
              // Gleicher Typ + Tap → Forced togglen (⊕ an/aus)
              toggleForced(cx, cy);
            } else {
              // Anderer Typ → Typ wechseln, Force zurücksetzen
              setCell(cx, cy, t, cell.state);
            }
          }
        },

        onDelete: (cx, cy) => delCell(cx, cy),

        // Kamera direkt mutieren — kein Zustand, kein Re-Render
        onPan: (dx, dy) => {
          const cam = cameraRef.current;
          cam.x -= dx / cam.zoom;
          cam.y -= dy / cam.zoom;
          dirtyRef.current = true;
        },

        onZoom: (factor, focalSx, focalSy) => {
          zoomAtPoint(cameraRef.current, factor, focalSx, focalSy);
          dirtyRef.current = true;
        },
      },
      () => cameraRef.current,
      () => toolRef.current,
    );

    ctrlRef.current = ctrl;

    const onWheel = (e: WheelEvent) => { e.preventDefault(); ctrl.wheel(e); };
    c.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      c.removeEventListener('wheel', onWheel);
      ctrlRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stabil — Callbacks schließen über Refs

  // ── Pointer-Events ───────────────────────────────────────────────────
  const fwd = (fn: (e: PointerEvent) => void) =>
    (e: React.PointerEvent<HTMLCanvasElement>) => fn(e.nativeEvent);

  return (
    <canvas
      ref={canvasRef}
      style={{ cursor: 'crosshair' }}
      onPointerDown={fwd(e  => ctrlRef.current?.pointerDown(e))}
      onPointerMove={fwd(e  => ctrlRef.current?.pointerMove(e))}
      onPointerUp={fwd(e    => ctrlRef.current?.pointerUp(e))}
      onPointerCancel={fwd(e => ctrlRef.current?.pointerCancel(e))}
      onContextMenu={e => e.preventDefault()}
    />
  );
}
