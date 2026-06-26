export type CellType = 'cable' | 'inverter' | 'delay';

export interface Cell {
  type:    CellType;
  state:   boolean;
  /**
   * Zelle ist dauerhaft auf ON erzwungen — verhält sich wie eine externe Quelle.
   * Das gesamte Netz dieser Zelle wird als "driven" behandelt und von der
   * Passive Rule ausgenommen. Jacobi überspringt erzwungene Netze.
   */
  forced?: boolean;
}

export type Grid = Map<string, Cell>;
