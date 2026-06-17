import { create } from 'zustand';
import type { Grid, CellType } from '../simulation/types';
import { key, toggleCellState } from '../simulation/grid';
import { simulationStep, SimLoopError } from '../simulation/engine';

interface GridStore {
  grid:       Grid;
  stepCount:  number;
  isRunning:  boolean;
  hz:         number;
  loopError:  string | null;

  setCell:     (x: number, y: number, type: CellType, state?: boolean) => void;
  deleteCell:  (x: number, y: number) => void;
  toggleState: (x: number, y: number) => void;
  step:        () => void;
  setRunning:  (v: boolean) => void;
  setHz:       (v: number) => void;
  clear:       () => void;
  loadGrid:    (g: Grid) => void;
}

export const useGridStore = create<GridStore>((set, get) => ({
  grid:      new Map(),
  stepCount: 0,
  isRunning: false,
  hz:        5,
  loopError: null,

  setCell: (x, y, type, state = false) =>
    set(s => {
      const g = new Map(s.grid);
      g.set(key(x, y), { type, state });
      return { grid: g };
    }),

  deleteCell: (x, y) =>
    set(s => {
      const g = new Map(s.grid);
      g.delete(key(x, y));
      return { grid: g };
    }),

  toggleState: (x, y) =>
    set(s => {
      const g = new Map(s.grid);
      toggleCellState(g, x, y);
      return { grid: g };
    }),

  step: () => {
    try {
      const newGrid = simulationStep(get().grid);
      set(s => ({ grid: newGrid, stepCount: s.stepCount + 1, loopError: null }));
    } catch (e) {
      if (e instanceof SimLoopError) {
        set({ isRunning: false, loopError: e.message });
      } else {
        throw e;
      }
    }
  },

  // Fehler beim Starten zurücksetzen — der User hat die Schaltung
  // möglicherweise repariert.
  setRunning: v => set({ isRunning: v, ...(v && { loopError: null }) }),

  setHz:    v => set({ hz: v }),
  clear:    () => set({ grid: new Map(), stepCount: 0, isRunning: false, loopError: null }),
  loadGrid: g => set({ grid: g, stepCount: 0, isRunning: false, loopError: null }),
}));
