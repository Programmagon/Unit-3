// Kein React-Import — reine Logik!
import type { Grid, CellType } from "../simulation/types";
import { key } from "../simulation/grid";
import { getCellAt, clientToCanvas, type Camera } from "./coordinates";

export type Tool = CellType | "delete";

// ─── applyTool ────────────────────────────────────────────────────────
export function applyTool(
  grid: Grid,
  cx: number,
  cy: number,
  tool: Tool,
  isDrag = false,
): boolean {
  const k = key(cx, cy);
  if (tool === "delete") {
    if (!grid.has(k)) return false;
    grid.delete(k);
    return true;
  }
  if (!grid.has(k)) {
    grid.set(k, { type: tool, state: false });
    return true;
  }
  if (!isDrag) {
    const cell = grid.get(k)!;
    if (cell.type === tool) {
      grid.set(k, { ...cell, state: !cell.state });
    } else {
      grid.set(k, { type: tool, state: cell.state });
    }
    return true;
  }
  return false;
}

// ─── Bresenham-Liniensegment ──────────────────────────────────────────
/**
 * Gibt alle Gitterzellen auf dem Segment (x0,y0)→(x1,y1) zurück.
 * Wird genutzt um Lücken bei schnellen Pointer-Bewegungen zu füllen.
 */
function bresenham(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): [number, number][] {
  const cells: [number, number][] = [];
  const dx = Math.abs(x1 - x0),
    sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0),
    sy = y0 < y1 ? 1 : -1;
  let err = dx + dy,
    x = x0,
    y = y0;
  while (true) {
    cells.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return cells;
}

// ─── Konstanten ───────────────────────────────────────────────────────
/** Pixel-Bewegung ab pointerdown bis Drag beginnt (gerätespezifisch) */
const TAP_THRESHOLD: Record<string, number> = {
  mouse: 5, // Maus: präzise, 5px reichen
  touch: 12, // Finger: ungenau, größere Toleranz
  pen: 8,
};
const DEFAULT_TAP_THRESHOLD = 8;

/** ms bis Long-Press-Löschen auf Touch aktiv wird */
const LONG_PRESS_MS = 450;

/**
 * Mindest-Verhältnis dominante/nicht-dominante Achsenbewegung vor Achslock.
 * 1.5 = dominante Achse muss 50% mehr Bewegung haben als die andere.
 * Verhindert versehentliches Sperren bei diagonaler Touch-Bewegung.
 */
const AXIS_DOMINANCE_RATIO = 1.5;

/** Mindestabstand vom Ankerpunkt (in Zellen) bevor Achse gesperrt wird */
const AXIS_MIN_CELLS = 2;

// ─── Interner Pointer-Zustand ─────────────────────────────────────────
interface PointerInfo {
  id: number;
  type: string;
  startClientX: number;
  startClientY: number;
  lastClientX: number;
  lastClientY: number;
}

// ─── Callbacks ────────────────────────────────────────────────────────
export interface PointerCallbacks {
  onPlace: (cx: number, cy: number, isDrag: boolean) => void;
  onDelete: (cx: number, cy: number) => void;
  /** Delta in Canvas-Pixel — Empfänger mutiert Camera direkt */
  onPan: (dx: number, dy: number) => void;
  /** Faktor + Fokuspunkt in Canvas-Pixel — Empfänger mutiert Camera direkt */
  onZoom: (factor: number, focalSx: number, focalSy: number) => void;
}

// ─── PointerController ────────────────────────────────────────────────
export class PointerController {
  private readonly pointers = new Map<number, PointerInfo>();
  private readonly cb: PointerCallbacks;
  private readonly canvas: HTMLCanvasElement;
  private readonly getCamera: () => Camera;
  private readonly getTool: () => Tool;

  // Einzel-Pointer-Zustand
  private isPanning = false;
  private isDragging = false;
  private isDeleting = false;
  private dragAxis: "x" | "y" | null = null;
  private anchorCell: [number, number] | null = null;
  /** Letzte platzierte Zelle — Startpunkt für Bresenham-Interpolation */
  private lastCellPos: [number, number] | null = null;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;

  // Pinch-Zustand
  private pinchDist = 0;
  private pinchMidSx = 0;
  private pinchMidSy = 0;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: PointerCallbacks,
    getCamera: () => Camera,
    getTool: () => Tool,
  ) {
    this.canvas = canvas;
    this.cb = callbacks;
    this.getCamera = getCamera;
    this.getTool = getTool;
  }

  // ─── Hilfsfunktionen ────────────────────────────────────────────────

  private cellAt(clientX: number, clientY: number): [number, number] {
    return getCellAt(clientX, clientY, this.canvas, this.getCamera());
  }

  private tapThreshold(pointerType: string): number {
    return TAP_THRESHOLD[pointerType] ?? DEFAULT_TAP_THRESHOLD;
  }

  private shouldPan(e: PointerEvent): boolean {
    return e.pointerType === "mouse" && (e.button === 1 || e.altKey);
  }

  private cancelLongPress() {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  private resetSinglePointerState() {
    this.isPanning = false;
    this.isDragging = false;
    this.isDeleting = false;
    this.dragAxis = null;
    this.anchorCell = null;
    this.lastCellPos = null;
    this.cancelLongPress();
  }

  // ─── Drag-Platzieren: Bresenham + Achslock ──────────────────────────

  /**
   * Berechnet Zielzelle, wendet Achslock an (nur beim Platzieren),
   * und interpoliert mit Bresenham zwischen letzter und aktueller Zelle.
   */
  private applyDragAt(clientX: number, clientY: number) {
    let [cx, cy] = this.cellAt(clientX, clientY);

    // Achslock — NUR beim Platzieren, nicht beim Löschen
    if (!this.isDeleting && this.anchorCell !== null) {
      if (this.dragAxis === null) {
        const adx = Math.abs(cx - this.anchorCell[0]);
        const ady = Math.abs(cy - this.anchorCell[1]);
        const dominant = Math.max(adx, ady);
        // Achse erst sperren wenn Bewegung eindeutig genug ist:
        // min. AXIS_MIN_CELLS Abstand UND klare Dominanz (AXIS_DOMINANCE_RATIO)
        if (dominant >= AXIS_MIN_CELLS) {
          if (adx > ady * AXIS_DOMINANCE_RATIO) this.dragAxis = "x";
          else if (ady > adx * AXIS_DOMINANCE_RATIO) this.dragAxis = "y";
          // Diagonal → Achse noch offen, nächste Bewegung entscheidet
        }
      }
      if (this.dragAxis === "x") cy = this.anchorCell[1]; // horizontal → Y klemmen
      if (this.dragAxis === "y") cx = this.anchorCell[0]; // vertikal  → X klemmen
    }

    // Bresenham-Interpolation: alle Zellen zwischen lastCellPos und (cx,cy)
    const from = this.lastCellPos ?? [cx, cy];
    const path = bresenham(from[0], from[1], cx, cy);

    // Ersten Eintrag überspringen (= lastCellPos, bereits verarbeitet)
    const start = this.lastCellPos !== null ? 1 : 0;
    for (let i = start; i < path.length; i++) {
      const [ix, iy] = path[i];
      if (this.isDeleting) this.cb.onDelete(ix, iy);
      else this.cb.onPlace(ix, iy, true);
    }

    this.lastCellPos = [cx, cy];
  }

  // ─── Pinch ──────────────────────────────────────────────────────────

  private startPinch() {
    const [a, b] = [...this.pointers.values()];
    this.pinchDist = Math.hypot(
      b.lastClientX - a.lastClientX,
      b.lastClientY - a.lastClientY,
    );
    const [mx, my] = clientToCanvas(
      (a.lastClientX + b.lastClientX) / 2,
      (a.lastClientY + b.lastClientY) / 2,
      this.canvas,
    );
    this.pinchMidSx = mx;
    this.pinchMidSy = my;
  }

  private updatePinch() {
    if (this.pointers.size < 2) return;
    const [a, b] = [...this.pointers.values()];
    const newDist = Math.hypot(
      b.lastClientX - a.lastClientX,
      b.lastClientY - a.lastClientY,
    );
    const [newMx, newMy] = clientToCanvas(
      (a.lastClientX + b.lastClientX) / 2,
      (a.lastClientY + b.lastClientY) / 2,
      this.canvas,
    );
    if (this.pinchDist > 0)
      this.cb.onZoom(newDist / this.pinchDist, newMx, newMy);
    this.cb.onPan(newMx - this.pinchMidSx, newMy - this.pinchMidSy);
    this.pinchDist = newDist;
    this.pinchMidSx = newMx;
    this.pinchMidSy = newMy;
  }

  // ─── Öffentliche Event-Handler ──────────────────────────────────────

  pointerDown(e: PointerEvent) {
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    const p: PointerInfo = {
      id: e.pointerId,
      type: e.pointerType,
      startClientX: e.clientX,
      startClientY: e.clientY,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
    };
    this.pointers.set(e.pointerId, p);

    if (this.pointers.size === 2) {
      this.resetSinglePointerState();
      this.startPinch();
      return;
    }
    if (this.pointers.size > 2) return;

    this.resetSinglePointerState();

    if (this.shouldPan(e)) {
      this.isPanning = true;
      return;
    }

    // Rechtsklick → sofort Löschen-Drag
    if (e.pointerType === "mouse" && e.button === 2) {
      const [cx, cy] = this.cellAt(e.clientX, e.clientY);
      this.isDeleting = true;
      this.isDragging = true;
      this.anchorCell = [cx, cy];
      this.lastCellPos = [cx, cy];
      this.cb.onDelete(cx, cy);
      return;
    }

    // Long-Press → Löschen auf Touch/Stift
    if (e.pointerType !== "mouse") {
      const [cx, cy] = this.cellAt(e.clientX, e.clientY);
      this.longPressTimer = setTimeout(() => {
        if (!this.isDragging) {
          this.cancelLongPress();
          this.isDeleting = true;
          this.isDragging = true;
          this.anchorCell = [cx, cy];
          this.lastCellPos = [cx, cy];
          this.cb.onDelete(cx, cy);
        }
      }, LONG_PRESS_MS);
    }
  }

  pointerMove(e: PointerEvent) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const prevX = p.lastClientX,
      prevY = p.lastClientY;
    p.lastClientX = e.clientX;
    p.lastClientY = e.clientY;

    if (this.pointers.size >= 2) {
      this.updatePinch();
      return;
    }

    // Pan
    if (this.isPanning) {
      const [prevSx, prevSy] = clientToCanvas(prevX, prevY, this.canvas);
      const [curSx, curSy] = clientToCanvas(e.clientX, e.clientY, this.canvas);
      this.cb.onPan(curSx - prevSx, curSy - prevSy);
      return;
    }

    // Löschen-Drag
    if (this.isDeleting) {
      this.applyDragAt(e.clientX, e.clientY);
      return;
    }

    // Tap-vs-Drag-Schwelle (gerätespezifisch)
    const dist = Math.hypot(
      e.clientX - p.startClientX,
      e.clientY - p.startClientY,
    );
    if (dist >= this.tapThreshold(p.type)) {
      this.cancelLongPress();

      if (!this.isDragging) {
        this.isDragging = true;
        const [cx, cy] = this.cellAt(p.startClientX, p.startClientY);
        this.anchorCell = [cx, cy];
        this.lastCellPos = [cx, cy]; // Startpunkt für Bresenham
        // Ankerzelle wie Tap behandeln (Toggle erlaubt)
        if (this.getTool() !== "delete") this.cb.onPlace(cx, cy, false);
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
      const wasTap = !this.isPanning && !this.isDragging && !this.isDeleting;
      if (wasTap && this.pointers.size === 0) {
        const [cx, cy] = this.cellAt(e.clientX, e.clientY);
        if (e.pointerType === "mouse" && e.button === 2)
          this.cb.onDelete(cx, cy);
        else this.cb.onPlace(cx, cy, false);
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
