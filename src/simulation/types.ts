export type CellType = 'cable' | 'inverter' | 'delay';

export interface Cell {
  type: CellType;
  state: boolean; // true = an, false = aus
}

// Unendliches Grid — leere Zellen existieren nicht in der Map
export type Grid = Map<string, Cell>;
