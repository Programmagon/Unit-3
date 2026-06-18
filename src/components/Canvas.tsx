import { useRef, useEffect, useCallback } from 'react';
import { useGridStore }  from '../store/gridStore';
import { useUIStore }    from '../store/uiStore';
import { renderFrame }   from '../canvas/renderer';
import { createMouseState, getCellAt, applyWheel, type Tool } from '../canvas/input';
import { key }           from '../simulation/grid';
import type { Camera }   from '../canvas/renderer';

export function Canvas() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const mouseState = useRef(createMouseState());

  const grid       = useGridStore(s => s.grid);
  const setCell    = useGridStore(s => s.setCell);
  const delCell    = useGridStore(s => s.deleteCell);
  const togState   = useGridStore(s => s.toggleState);
  const gridRef    = useRef(grid);
  gridRef.current  = grid; // immer aktuell für Event-Handler

  const tool         = useUIStore(s => s.tool);
  const toolRef      = useRef<Tool>(tool);
  const camera       = useUIStore(s => s.camera);
  const cameraRef    = useRef<Camera>(camera);
  const updateCamera = useUIStore(s => s.updateCamera);

  useEffect(() => { toolRef.current   = tool;   }, [tool]);
  useEffect(() => { cameraRef.current = camera; }, [camera]);

  /* ── Zeichnen ─────────────────────────────────────────── */
  const draw = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderFrame(ctx, gridRef.current, cameraRef.current, c.clientWidth, c.clientHeight);
  }, []);

  useEffect(() => { draw(); }, [draw, grid, camera]);

  /* ── HiDPI-Resize ─────────────────────────────────────── */
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

  /* ── Scroll-Zoom (non-passive) ────────────────────────── */
  useEffect(() => {
    const c = canvasRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      updateCamera(cam => applyWheel(e, c, cam));
    };
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => c.removeEventListener('wheel', onWheel);
  }, [updateCamera]);

  /* ── Maus-Events ──────────────────────────────────────── */
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const m = mouseState.current;
    m.isDown = true; m.button = e.button;
    m.lastX = e.clientX; m.lastY = e.clientY; m.lastCellKey = null;
    m.isPanning = e.button === 1 || (e.button === 0 && e.altKey);
    if (m.isPanning) return;

    const c = canvasRef.current!;
    const [cx, cy] = getCellAt(e.clientX, e.clientY, c, cameraRef.current);
    m.lastCellKey = key(cx, cy);

    if (e.button === 2) {
      delCell(cx, cy);
    } else {
      const t = toolRef.current;
      const g = gridRef.current;
      const k_ = key(cx, cy);
      if (t === 'delete')    { delCell(cx, cy); }
      else if (!g.has(k_))   { setCell(cx, cy, t as any); }
      else {
        const cell = g.get(k_)!;
        if (cell.type === t) { togState(cx, cy); }
        else                 { setCell(cx, cy, t as any, cell.state); }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const m = mouseState.current;
    if (!m.isDown) return;
    const dx = e.clientX - m.lastX, dy = e.clientY - m.lastY;
    m.lastX = e.clientX; m.lastY = e.clientY;
    if (m.isPanning) {
      updateCamera(cam => { cam.x -= dx / cam.zoom; cam.y -= dy / cam.zoom; });
      return;
    }
    const c = canvasRef.current!;
    const [cx, cy] = getCellAt(e.clientX, e.clientY, c, cameraRef.current);
    const ck = key(cx, cy);
    if (ck === m.lastCellKey) return;
    m.lastCellKey = ck;
    if (m.button === 2 || toolRef.current === 'delete') { delCell(cx, cy); }
    else if (!gridRef.current.has(ck))                  { setCell(cx, cy, toolRef.current as any); }
  };

  const handleMouseUp = () => {
    mouseState.current.isDown    = false;
    mouseState.current.isPanning = false;
  };

  return (
    <canvas
      ref={canvasRef}
      style={{ flex: 1, display: 'block', cursor: 'crosshair' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={e => e.preventDefault()}
    />
  );
}
