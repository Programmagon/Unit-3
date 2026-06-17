// Kein React-Import!
import type { Grid, CellType } from '../simulation/types';
import type { Camera } from './renderer';
import { key } from '../simulation/grid';
import { screenToWorld } from './renderer';

export type Tool = CellType | 'delete';

export interface MouseState {
  isDown:      boolean;
  button:      number;
  isPanning:   boolean;
  lastX:       number;
  lastY:       number;
  lastCellKey: string | null;
}

export const createMouseState = (): MouseState => ({
  isDown: false, button: -1, isPanning: false,
  lastX: 0, lastY: 0, lastCellKey: null,
});

export function getCellAt(
  clientX: number, clientY: number,
  canvas: HTMLCanvasElement, cam: Camera,
): [number, number] {
  const rect = canvas.getBoundingClientRect();
  const [wx, wy] = screenToWorld(clientX - rect.left, clientY - rect.top, cam);
  return [Math.floor(wx), Math.floor(wy)];
}

/**
 * Wendet Werkzeug auf Gitterzelle an.
 * Drag=true → nur leere Zellen füllen (kein State-Toggle).
 * @returns true wenn das Grid verändert wurde
 */
export function applyTool(
  grid: Grid, cx: number, cy: number,
  tool: Tool, isDrag = false,
): boolean {
  const k = key(cx, cy);
  if (tool === 'delete') { if (!grid.has(k)) return false; grid.delete(k); return true; }
  if (!grid.has(k)) { grid.set(k, { type: tool, state: false }); return true; }
  if (!isDrag) {
    const cell = grid.get(k)!;
    if (cell.type === tool) { grid.set(k, { ...cell, state: !cell.state }); }
    else                    { grid.set(k, { type: tool, state: cell.state }); }
    return true;
  }
  return false;
}

/**
 * Verarbeitet Scroll → Zoom + Kamera-Verschiebung.
 * Als non-passive Event-Listener registrieren!
 */
export function applyWheel(e: WheelEvent, canvas: HTMLCanvasElement, cam: Camera): void {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const [wx, wy] = screenToWorld(mx, my, cam);
  const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  cam.zoom = Math.max(6, Math.min(120, cam.zoom * f));
  cam.x = wx - mx / cam.zoom;
  cam.y = wy - my / cam.zoom;
}
