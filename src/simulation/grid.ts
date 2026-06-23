import type { Grid, CellType } from './types';
export const key     = (x: number, y: number): string      => `${x},${y}`;
export const fromKey = (k: string): [number, number]        => k.split(',').map(Number) as [number, number];
export const DIRS4: ReadonlyArray<[number, number]> = [[1,0],[-1,0],[0,1],[0,-1]];
export const getCell    = (g: Grid, x: number, y: number) => g.get(key(x, y));
export const hasCell    = (g: Grid, x: number, y: number) => g.has(key(x, y));
export const deleteCell = (g: Grid, x: number, y: number) => { g.delete(key(x, y)); };
export function setCell(g: Grid, x: number, y: number, type: CellType, state = false): void {
  g.set(key(x, y), { type, state });
}
export function toggleCellState(g: Grid, x: number, y: number): void {
  const cell = g.get(key(x, y));
  if (cell) g.set(key(x, y), { ...cell, state: !cell.state });
}
