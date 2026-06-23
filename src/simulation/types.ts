export type CellType = 'cable' | 'inverter' | 'delay';
export interface Cell { type: CellType; state: boolean; }
export type Grid = Map<string, Cell>;
