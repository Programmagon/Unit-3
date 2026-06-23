import { useRef, useEffect, useCallback } from 'react';
import { useGridStore }    from '../store/gridStore';
import { useUIStore }      from '../store/uiStore';
import { renderFrame }     from '../canvas/renderer';
import { PointerController } from '../canvas/input';
import { zoomAtPoint }     from '../canvas/coordinates';
import type { Camera }     from '../canvas/coordinates';
import type { Tool }       from '../canvas/input';

export function Canvas() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const ctrlRef      = useRef<PointerController | null>(null);

  // ── Store-Selektoren ──────────────────────────────────────────────
  const grid       = useGridStore(s => s.grid);
  const setCell    = useGridStore(s => s.setCell);
  const delCell    = useGridStore(s => s.deleteCell);
  const togState   = useGridStore(s => s.toggleState);
  const gridRef    = useRef(grid);
  gridRef.current  = grid;

  const tool         = useUIStore(s => s.tool);
  const toolRef      = useRef<Tool>(tool);
  const camera       = useUIStore(s => s.camera);
  const cameraRef    = useRef<Camera>(camera);
  const updateCamera = useUIStore(s => s.updateCamera);

  useEffect(() => { toolRef.current   = tool;   }, [tool]);
  useEffect(() => { cameraRef.current = camera; }, [camera]);

  // ── Zeichnen ──────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderFrame(ctx, gridRef.current, cameraRef.current, c.clientWidth, c.clientHeight);
  }, []);

  useEffect(() => { draw(); }, [draw, grid, camera]);

  // ── HiDPI-Resize ──────────────────────────────────────────────────
  useEffect(() => {
    const c = canvasRef.current!;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      c.width  = c.clientWidth  * dpr;
      c.height = c.clientHeight * dpr;
      draw();
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, [draw]);

  // ── PointerController einrichten ──────────────────────────────────
  useEffect(() => {
    const c = canvasRef.current!;

    const ctrl = new PointerController(
      c,
      {
        // onPlace: Zelle setzen, typ wechseln oder State toggeln
        onPlace: (cx, cy, isDrag) => {
          const t = toolRef.current;
          if (t === 'delete') { delCell(cx, cy); return; }
          const g  = gridRef.current;
          const k  = `${cx},${cy}`;
          if (!g.has(k)) {
            setCell(cx, cy, t);
          } else if (!isDrag) {
            const cell = g.get(k)!;
            if (cell.type === t) togState(cx, cy);
            else                 setCell(cx, cy, t, cell.state);
          }
        },

        // onDelete: immer löschen, unabhängig vom aktiven Tool
        onDelete: (cx, cy) => delCell(cx, cy),

        // onPan: Delta in Canvas-Pixel → Kamera verschieben
        onPan: (dx, dy) => updateCamera(cam => {
          cam.x -= dx / cam.zoom;
          cam.y -= dy / cam.zoom;
        }),

        // onZoom: Faktor + Fokuspunkt in Canvas-Pixel → Kamera zoomen
        onZoom: (factor, focalSx, focalSy) => updateCamera(cam => {
          zoomAtPoint(cam, factor, focalSx, focalSy);
        }),
      },
      () => cameraRef.current,
      () => toolRef.current,
    );

    ctrlRef.current = ctrl;

    // Mausrad als non-passive Listener (preventDefault nötig)
    const onWheel = (e: WheelEvent) => { e.preventDefault(); ctrl.wheel(e); };
    c.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      c.removeEventListener('wheel', onWheel);
      ctrlRef.current = null;
    };
  // Callbacks sind stabil (Store-Actions + updateCamera ändern sich nie)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── React Pointer-Event-Handler (dünne Weiterleitungsschicht) ─────
  // Canvas.tsx kennt keine Gesten-Logik mehr — alles läuft durch den Controller.
  const onPointerDown   = (e: React.PointerEvent<HTMLCanvasElement>) =>
    ctrlRef.current?.pointerDown(e.nativeEvent);
  const onPointerMove   = (e: React.PointerEvent<HTMLCanvasElement>) =>
    ctrlRef.current?.pointerMove(e.nativeEvent);
  const onPointerUp     = (e: React.PointerEvent<HTMLCanvasElement>) =>
    ctrlRef.current?.pointerUp(e.nativeEvent);
  const onPointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) =>
    ctrlRef.current?.pointerCancel(e.nativeEvent);

  return (
    <canvas
      ref={canvasRef}
      style={{ flex: 1, display: 'block', cursor: 'crosshair', touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={e => e.preventDefault()}
    />
  );
}
