// Kein React-Import — reine Logik!
import type { Grid, CellType } from '../simulation/types';
import { key } from '../simulation/grid';
import { getCellAt, clientToCanvas, zoomAtPoint, type Camera } from './coordinates';

export type Tool = CellType | 'delete';

// ─── applyTool — reine Funktion, kein Store ───────────────────────────
export function applyTool(grid: Grid, cx: number, cy: number, tool: Tool, isDrag = false): boolean {
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

// ─── Konstanten ───────────────────────────────────────────────────────
const TAP_THRESHOLD_PX = 5;
const LONG_PRESS_MS    = 450;

// ─── Interner Pointer-Zustand ─────────────────────────────────────────
interface PointerInfo {
  id: number; type: string;
  startClientX: number; startClientY: number;
  lastClientX:  number; lastClientY:  number;
}

// ─── Callbacks ────────────────────────────────────────────────────────
export interface PointerCallbacks {
  onPlace:  (cx: number, cy: number, isDrag: boolean) => void;
  onDelete: (cx: number, cy: number) => void;
  onPan:    (dx: number, dy: number) => void;
  onZoom:   (factor: number, focalSx: number, focalSy: number) => void;
}

// ─── PointerController ────────────────────────────────────────────────
export class PointerController {
  private readonly pointers  = new Map<number, PointerInfo>();
  private readonly cb:         PointerCallbacks;
  private readonly canvas:     HTMLCanvasElement;
  private readonly getCamera:  () => Camera;
  private readonly getTool:    () => Tool;

  private isPanning    = false;
  private isDragging   = false;
  private isDeleting   = false;
  private dragAxis:    'x' | 'y' | null = null;
  private anchorCell:  [number, number] | null = null;
  private lastCellKey: string | null = null;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private pinchDist  = 0;
  private pinchMidSx = 0;
  private pinchMidSy = 0;

  constructor(
    canvas: HTMLCanvasElement, callbacks: PointerCallbacks,
    getCamera: () => Camera, getTool: () => Tool,
  ) {
    this.canvas = canvas; this.cb = callbacks;
    this.getCamera = getCamera; this.getTool = getTool;
  }

  private cellAt(clientX: number, clientY: number): [number, number] {
    return getCellAt(clientX, clientY, this.canvas, this.getCamera());
  }
  private ck(c: [number, number]) { return `${c[0]},${c[1]}`; }
  private shouldPan(e: PointerEvent): boolean {
    return e.pointerType === 'mouse' && (e.button === 1 || e.altKey);
  }
  private cancelLongPress() {
    if (this.longPressTimer !== null) { clearTimeout(this.longPressTimer); this.longPressTimer = null; }
  }
  private resetSinglePointerState() {
    this.isPanning = false; this.isDragging = false; this.isDeleting = false;
    this.dragAxis = null; this.anchorCell = null; this.lastCellKey = null;
    this.cancelLongPress();
  }

  private applyDragAt(clientX: number, clientY: number) {
    let [cx, cy] = this.cellAt(clientX, clientY);
    if (this.anchorCell !== null) {
      if (this.dragAxis === null) {
        const adx = Math.abs(cx - this.anchorCell[0]);
        const ady = Math.abs(cy - this.anchorCell[1]);
        if (adx !== 0 || ady !== 0) this.dragAxis = adx >= ady ? 'x' : 'y';
      }
      if (this.dragAxis === 'x') cy = this.anchorCell[1];
      if (this.dragAxis === 'y') cx = this.anchorCell[0];
    }
    const k = this.ck([cx, cy]);
    if (k === this.lastCellKey) return;
    this.lastCellKey = k;
    if (this.isDeleting) this.cb.onDelete(cx, cy);
    else                 this.cb.onPlace(cx, cy, true);
  }

  private startPinch() {
    const [a, b] = [...this.pointers.values()];
    this.pinchDist = Math.hypot(b.lastClientX - a.lastClientX, b.lastClientY - a.lastClientY);
    const [mx, my] = clientToCanvas(
      (a.lastClientX + b.lastClientX) / 2,
      (a.lastClientY + b.lastClientY) / 2, this.canvas,
    );
    this.pinchMidSx = mx; this.pinchMidSy = my;
  }

  private updatePinch() {
    if (this.pointers.size < 2) return;
    const [a, b] = [...this.pointers.values()];
    const newDist = Math.hypot(b.lastClientX - a.lastClientX, b.lastClientY - a.lastClientY);
    const [newMx, newMy] = clientToCanvas(
      (a.lastClientX + b.lastClientX) / 2,
      (a.lastClientY + b.lastClientY) / 2, this.canvas,
    );
    if (this.pinchDist > 0) this.cb.onZoom(newDist / this.pinchDist, newMx, newMy);
    this.cb.onPan(newMx - this.pinchMidSx, newMy - this.pinchMidSy);
    this.pinchDist = newDist; this.pinchMidSx = newMx; this.pinchMidSy = newMy;
  }

  pointerDown(e: PointerEvent) {
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const p: PointerInfo = {
      id: e.pointerId, type: e.pointerType,
      startClientX: e.clientX, startClientY: e.clientY,
      lastClientX:  e.clientX, lastClientY:  e.clientY,
    };
    this.pointers.set(e.pointerId, p);

    if (this.pointers.size === 2) { this.resetSinglePointerState(); this.startPinch(); return; }
    if (this.pointers.size > 2) return;

    this.resetSinglePointerState();

    if (this.shouldPan(e)) { this.isPanning = true; return; }

    if (e.pointerType === 'mouse' && e.button === 2) {
      const [cx, cy] = this.cellAt(e.clientX, e.clientY);
      this.isDeleting = true; this.isDragging = true;
      this.anchorCell = [cx, cy]; this.lastCellKey = this.ck([cx, cy]);
      this.cb.onDelete(cx, cy); return;
    }

    if (e.pointerType !== 'mouse') {
      const [cx, cy] = this.cellAt(e.clientX, e.clientY);
      this.longPressTimer = setTimeout(() => {
        if (!this.isDragging) {
          this.cancelLongPress();
          this.isDeleting = true; this.isDragging = true;
          this.anchorCell = [cx, cy]; this.lastCellKey = this.ck([cx, cy]);
          this.cb.onDelete(cx, cy);
        }
      }, LONG_PRESS_MS);
    }
  }

  pointerMove(e: PointerEvent) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const prevX = p.lastClientX, prevY = p.lastClientY;
    p.lastClientX = e.clientX; p.lastClientY = e.clientY;

    if (this.pointers.size >= 2) { this.updatePinch(); return; }

    if (this.isPanning) {
      const [prevSx, prevSy] = clientToCanvas(prevX,     prevY,     this.canvas);
      const [curSx,  curSy]  = clientToCanvas(e.clientX, e.clientY, this.canvas);
      this.cb.onPan(curSx - prevSx, curSy - prevSy); return;
    }

    if (this.isDeleting) { this.applyDragAt(e.clientX, e.clientY); return; }

    const dist = Math.hypot(e.clientX - p.startClientX, e.clientY - p.startClientY);
    if (dist >= TAP_THRESHOLD_PX) {
      this.cancelLongPress();
      if (!this.isDragging) {
        this.isDragging = true;
        const [cx, cy] = this.cellAt(p.startClientX, p.startClientY);
        this.anchorCell = [cx, cy]; this.lastCellKey = this.ck([cx, cy]);
        if (this.getTool() !== 'delete') this.cb.onPlace(cx, cy, false);
      }
      this.applyDragAt(e.clientX, e.clientY);
    }
  }

  pointerUp(e: PointerEvent) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.cancelLongPress();
    this.pointers.delete(e.pointerId);

    if (this.pointers.size <= 1) {
      const wasSingleGesture = !this.isPanning && !this.isDragging && !this.isDeleting;
      if (wasSingleGesture && this.pointers.size === 0) {
        const [cx, cy] = this.cellAt(e.clientX, e.clientY);
        if (e.pointerType === 'mouse' && e.button === 2) this.cb.onDelete(cx, cy);
        else                                              this.cb.onPlace(cx, cy, false);
      }
      if (this.pointers.size === 0) this.resetSinglePointerState();
    }
  }

  pointerCancel(e: PointerEvent) {
    this.pointers.delete(e.pointerId);
    this.cancelLongPress();
    if (this.pointers.size === 0) this.resetSinglePointerState();
  }

  wheel(e: WheelEvent) {
    const [sx, sy] = clientToCanvas(e.clientX, e.clientY, this.canvas);
    this.cb.onZoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, sx, sy);
  }
}
