// Kein React-Import — nur Canvas-API!
import type { Grid } from '../simulation/types';
import { fromKey } from '../simulation/grid';
import { type Camera, worldToScreen } from './coordinates';

export type { Camera };

const CELL_COLORS: Record<string, { on: string; off: string; glow: string }> = {
  cable:    { on: '#00ff88', off: '#0b2e1a', glow: 'rgba(0,255,136,.35)'  },
  inverter: { on: '#ff9900', off: '#2a1500', glow: 'rgba(255,153,0,.35)'  },
  delay:    { on: '#bb44ff', off: '#1d0035', glow: 'rgba(187,68,255,.35)' },
};
const CELL_ICONS: Record<string, string> = { cable: '━', inverter: '◇', delay: '▷' };

function drawRoundedRect(
  ctx: CanvasRenderingContext2D, x: number, y: number,
  w: number, h: number, r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  grid: Grid, cam: Camera,
  width: number, height: number,
): void {
  const z = cam.zoom;
  ctx.fillStyle = '#0b0b1e';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#13133a'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = Math.floor(cam.x); gx <= cam.x + width / z + 1; gx++) {
    const [sx] = worldToScreen(gx, 0, cam);
    ctx.moveTo(sx + .5, 0); ctx.lineTo(sx + .5, height);
  }
  for (let gy = Math.floor(cam.y); gy <= cam.y + height / z + 1; gy++) {
    const [, sy] = worldToScreen(0, gy, cam);
    ctx.moveTo(0, sy + .5); ctx.lineTo(width, sy + .5);
  }
  ctx.stroke();

  for (const [k, cell] of grid) {
    const [cx, cy] = fromKey(k);
    const [sx, sy] = worldToScreen(cx, cy, cam);
    const c = CELL_COLORS[cell.type];
    const p = Math.max(1.5, z * .07), rw = z - p * 2, rh = z - p * 2;
    const r = Math.min(4, rw * .2);

    if (cell.state && z >= 10) { ctx.shadowColor = c.glow; ctx.shadowBlur = z * .6; }
    ctx.fillStyle = cell.state ? c.on : c.off;
    drawRoundedRect(ctx, sx + p, sy + p, rw, rh, r);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (z >= 20) {
      ctx.fillStyle    = cell.state ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.12)';
      ctx.font         = `${Math.min(z * .38, 16)}px monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(CELL_ICONS[cell.type], sx + z / 2, sy + z / 2);
    }
  }
}
