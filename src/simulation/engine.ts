// Kein React-Import — reine Logik!
import type { Grid } from "./types";
import { key, fromKey, DIRS4 } from "./grid";

// ─── Fehlertyp ────────────────────────────────────────────────────────

/**
 * Wird geworfen wenn Jacobi nach n+1 Durchläufen nicht konvergiert.
 * Tritt auf bei kombinatorischen Schleifen ohne Verzögerer (z.B. A = NOT(A)).
 * SR-Latches ([C][][I]/[I][][C]) sind kein LoopError — sie konvergieren
 * sofort sobald einer der Zustände bereits stabil ist (Initialisierung aus prev).
 */
export class SimLoopError extends Error {
  constructor() {
    super(
      "Kombinatorische Schleife ohne Verzögerer — " +
        "füge einen Verzögerer in die Schleife ein.",
    );
    this.name = "SimLoopError";
  }
}

// ─── Interne Typen ────────────────────────────────────────────────────

type EdgeType = "INVERT" | "BUFFER" | "DELAY";

interface Edge {
  src: string;
  type: EdgeType;
}

interface SimGraph {
  cellToNet: Map<string, string>;
  netIds: string[];
  netState: Map<string, boolean>;
  inEdges: Map<string, Edge[]>;
  driven: Set<string>;
}

// ─── Union-Find (Pfadkompression + Union-by-Rank) ─────────────────────

function makeUF(keys: string[]) {
  const parent = new Map(keys.map((k) => [k, k]));
  const rnk = new Map(keys.map((k) => [k, 0]));

  function find(k: string): string {
    if (parent.get(k) !== k) parent.set(k, find(parent.get(k)!));
    return parent.get(k)!;
  }

  function union(a: string, b: string) {
    const ra = find(a),
      rb = find(b);
    if (ra === rb) return;
    const rra = rnk.get(ra)!,
      rrb = rnk.get(rb)!;
    if (rra < rrb) parent.set(ra, rb);
    else if (rra > rrb) parent.set(rb, ra);
    else {
      parent.set(rb, ra);
      rnk.set(ra, rra + 1);
    }
  }

  return { find, union };
}

// ─── Compile-Phase ────────────────────────────────────────────────────

function compile(grid: Grid): SimGraph {
  const keys = [...grid.keys()];
  const uf = makeUF(keys);

  // Schritt 1 — direkte Nachbarn → selbes Netz
  for (const k of keys) {
    const [x, y] = fromKey(k);
    for (const [dx, dy] of DIRS4) {
      const nk = key(x + dx, y + dy);
      if (grid.has(nk)) uf.union(k, nk);
    }
  }

  // Schritt 2 — Inverter [lücke] Inverter → selbes Netz (Merge-Regel)
  const seenMerge = new Set<string>();
  for (const [k, a] of grid) {
    if (a.type !== "inverter") continue;
    const [x, y] = fromKey(k);
    for (const [dx, dy] of DIRS4) {
      const gapKey = key(x + dx, y + dy);
      const farKey = key(x + 2 * dx, y + 2 * dy);
      if (grid.has(gapKey) || !grid.has(farKey)) continue;
      if (grid.get(farKey)!.type !== "inverter") continue;
      const pid = k < farKey ? `${k}|${farKey}` : `${farKey}|${k}`;
      if (seenMerge.has(pid)) continue;
      seenMerge.add(pid);
      uf.union(k, farKey);
    }
  }

  // Schritt 3 — Netz-IDs
  const cellToNet = new Map<string, string>(keys.map((k) => [k, uf.find(k)]));
  const netIds = [...new Set(cellToNet.values())];

  // Schritt 4 — Anfangszustand (OR über alle Zellen des Netzes)
  const netState = new Map<string, boolean>(netIds.map((n) => [n, false]));
  for (const [k, cell] of grid)
    if (cell.state) netState.set(cellToNet.get(k)!, true);

  // Schritt 5 — Kanten-Erkennung
  //   INVERT: Inverter → Kabel   (physische Seite egal)
  //   DELAY:  Delay    → Kabel
  //   BUFFER: Delay    → Inverter
  //   Kabel  | Kabel  → keine Kante
  const inEdges = new Map<string, Edge[]>(netIds.map((n) => [n, []]));
  const seenEdge = new Set<string>();

  for (const [k, a] of grid) {
    const [x, y] = fromKey(k);
    for (const [dx, dy] of DIRS4) {
      const gapKey = key(x + dx, y + dy);
      const farKey = key(x + 2 * dx, y + 2 * dy);
      if (grid.has(gapKey) || !grid.has(farKey)) continue;
      const pid = k < farKey ? `${k}|${farKey}` : `${farKey}|${k}`;
      if (seenEdge.has(pid)) continue;
      seenEdge.add(pid);

      const b = grid.get(farKey)!;
      const an = cellToNet.get(k)!;
      const bn = cellToNet.get(farKey)!;
      if (an === bn) continue;

      const at = a.type,
        bt = b.type;

      if (at === "inverter" && bt === "cable")
        inEdges.get(bn)!.push({ src: an, type: "INVERT" });
      else if (at === "cable" && bt === "inverter")
        inEdges.get(an)!.push({ src: bn, type: "INVERT" });
      else if (at === "delay" && bt === "cable")
        inEdges.get(bn)!.push({ src: an, type: "DELAY" });
      else if (at === "cable" && bt === "delay")
        inEdges.get(an)!.push({ src: bn, type: "DELAY" });
      else if (at === "delay" && bt === "inverter")
        inEdges.get(bn)!.push({ src: an, type: "BUFFER" });
      else if (at === "inverter" && bt === "delay")
        inEdges.get(an)!.push({ src: bn, type: "BUFFER" });
    }
  }

  // Schritt 6 — Driven-Netze
  const driven = new Set(netIds.filter((n) => inEdges.get(n)!.length > 0));

  return { cellToNet, netIds, netState, inEdges, driven };
}

// ─── Step-Phase (Jacobi-Relaxation) ──────────────────────────────────

/**
 * Führt einen Simulations-Schritt aus.
 *
 * Zwei zentrale Design-Entscheidungen:
 *
 * 1. next[] wird aus prev[] initialisiert (nicht aus all-false).
 *    → Stabile Zustände (z.B. SR-Latch mit einer Seite AN) bleiben stabil:
 *      Jacobi konvergiert sofort, da der Snapshot bereits am Fixpunkt liegt.
 *    → Passive Rule wird danach explizit angewendet (passive → false).
 *
 * 2. SimLoopError wird nach der n+1-ten Berechnung geworfen (nicht davor).
 *    → n Netze brauchen maximal n Weiterleitungsschritte zum Konvergieren.
 *      Bug vorher: Throw VOR der Berechnung gab nur n statt n+1 Durchläufe.
 *
 * @throws SimLoopError wenn keine Konvergenz nach n+1 Iterationen.
 */
export function simulationStep(grid: Grid): Grid {
  if (!grid.size) return grid;

  const { cellToNet, netIds, netState, inEdges, driven } = compile(grid);
  const n = netIds.length;

  // prev[] — Zustand vor dem Step (für DELAY-Kanten, unveränderlich)
  const prev = new Map(netState);

  // FIX 1: next[] aus prev initialisieren statt aus all-false.
  // Stabile Schaltungen (SR-Latches etc.) konvergieren dadurch sofort.
  const next = new Map(prev);

  // Passive Rule: Netze ohne eingehenden Kanten → false (Ghost Power Prevention).
  // Muss explizit gesetzt werden, da next aus prev kam.
  for (const netId of netIds) {
    if (!driven.has(netId)) next.set(netId, false);
  }

  // Jacobi-Iteration (maximal n+1 Durchläufe)
  for (let iter = 0; iter <= n; iter++) {
    // snap[] = Momentaufnahme zu Beginn dieser Iteration (Jacobi, nicht Gauss-Seidel)
    const snap = new Map(next);
    let changed = false;

    for (const netId of netIds) {
      if (!driven.has(netId)) continue; // passiv → bleibt false

      let r = false;
      for (const { src, type } of inEdges.get(netId)!) {
        if (type === "INVERT") r = r || !snap.get(src)!;
        else if (type === "BUFFER") r = r || snap.get(src)!;
        else if (type === "DELAY") r = r || prev.get(src)!;
      }

      if (next.get(netId) !== r) {
        next.set(netId, r);
        changed = true;
      }
    }

    if (!changed) break; // konvergiert ✓

    // FIX 2: Throw NACH der Berechnung — nicht davor.
    // Vorher: throw bei iter===n vor dem compute → nur n statt n+1 Durchläufe.
    // Jetzt:  n+1 vollständige Berechnungen bevor der Fehler geworfen wird.
    if (iter === n) throw new SimLoopError();
  }

  const newGrid: Grid = new Map();
  for (const [k, cell] of grid)
    newGrid.set(k, { ...cell, state: next.get(cellToNet.get(k)!)! });
  return newGrid;
}
