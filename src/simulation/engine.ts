import type { Grid } from './types';
import { key, fromKey, DIRS4 } from './grid';

export class SimLoopError extends Error {
  constructor() {
    super('Kombinatorische Schleife ohne Verzögerer — füge einen Verzögerer in die Schleife ein.');
    this.name = 'SimLoopError';
  }
}

type EdgeType = 'INVERT' | 'BUFFER' | 'DELAY';
interface Edge { src: string; type: EdgeType; }
interface SimGraph {
  cellToNet: Map<string, string>;
  netIds:    string[];
  netState:  Map<string, boolean>;
  inEdges:   Map<string, Edge[]>;
  driven:    Set<string>;
}

function makeUF(keys: string[]) {
  const parent = new Map(keys.map(k => [k, k]));
  const rnk    = new Map(keys.map(k => [k, 0]));
  function find(k: string): string {
    if (parent.get(k) !== k) parent.set(k, find(parent.get(k)!));
    return parent.get(k)!;
  }
  function union(a: string, b: string) {
    const ra = find(a), rb = find(b); if (ra === rb) return;
    const rra = rnk.get(ra)!, rrb = rnk.get(rb)!;
    if      (rra < rrb) parent.set(ra, rb);
    else if (rra > rrb) parent.set(rb, ra);
    else              { parent.set(rb, ra); rnk.set(ra, rra + 1); }
  }
  return { find, union };
}

function compile(grid: Grid): SimGraph {
  const keys = [...grid.keys()];
  const uf   = makeUF(keys);

  for (const k of keys) {
    const [x, y] = fromKey(k);
    for (const [dx, dy] of DIRS4) { const nk = key(x+dx,y+dy); if (grid.has(nk)) uf.union(k,nk); }
  }

  const seenMerge = new Set<string>();
  for (const [k, a] of grid) {
    if (a.type !== 'inverter') continue;
    const [x, y] = fromKey(k);
    for (const [dx, dy] of DIRS4) {
      const gapKey = key(x+dx,y+dy), farKey = key(x+2*dx,y+2*dy);
      if (grid.has(gapKey)||!grid.has(farKey)||grid.get(farKey)!.type!=='inverter') continue;
      const pid = k<farKey?`${k}|${farKey}`:`${farKey}|${k}`;
      if (seenMerge.has(pid)) continue; seenMerge.add(pid); uf.union(k,farKey);
    }
  }

  const cellToNet = new Map<string,string>(keys.map(k=>[k,uf.find(k)]));
  const netIds    = [...new Set(cellToNet.values())];
  const netState  = new Map<string,boolean>(netIds.map(n=>[n,false]));
  for (const [k,cell] of grid) if (cell.state) netState.set(cellToNet.get(k)!,true);

  const inEdges  = new Map<string,Edge[]>(netIds.map(n=>[n,[]]));
  const seenEdge = new Set<string>();
  for (const [k,a] of grid) {
    const [x,y] = fromKey(k);
    for (const [dx,dy] of DIRS4) {
      const gapKey=key(x+dx,y+dy), farKey=key(x+2*dx,y+2*dy);
      if (grid.has(gapKey)||!grid.has(farKey)) continue;
      const pid=k<farKey?`${k}|${farKey}`:`${farKey}|${k}`;
      if (seenEdge.has(pid)) continue; seenEdge.add(pid);
      const b=grid.get(farKey)!, an=cellToNet.get(k)!, bn=cellToNet.get(farKey)!;
      if (an===bn) continue;
      const at=a.type,bt=b.type;
      if      (at==='inverter'&&bt==='cable')    inEdges.get(bn)!.push({src:an,type:'INVERT'});
      else if (at==='cable'   &&bt==='inverter') inEdges.get(an)!.push({src:bn,type:'INVERT'});
      else if (at==='delay'   &&bt==='cable')    inEdges.get(bn)!.push({src:an,type:'DELAY'});
      else if (at==='cable'   &&bt==='delay')    inEdges.get(an)!.push({src:bn,type:'DELAY'});
      else if (at==='delay'   &&bt==='inverter') inEdges.get(bn)!.push({src:an,type:'BUFFER'});
      else if (at==='inverter'&&bt==='delay')    inEdges.get(an)!.push({src:bn,type:'BUFFER'});
    }
  }
  const driven = new Set(netIds.filter(n=>inEdges.get(n)!.length>0));
  return { cellToNet, netIds, netState, inEdges, driven };
}

export function simulationStep(grid: Grid): Grid {
  if (!grid.size) return grid;
  const { cellToNet, netIds, netState, inEdges, driven } = compile(grid);
  const n    = netIds.length;
  const prev = new Map(netState);
  const next = new Map(prev);
  for (const netId of netIds) if (!driven.has(netId)) next.set(netId,false);

  for (let iter=0; iter<=n; iter++) {
    const snap    = new Map(next);
    let changed   = false;
    for (const netId of netIds) {
      if (!driven.has(netId)) continue;
      let r = false;
      for (const {src,type} of inEdges.get(netId)!) {
        if      (type==='INVERT') r=r||!snap.get(src)!;
        else if (type==='BUFFER') r=r|| snap.get(src)!;
        else if (type==='DELAY')  r=r|| prev.get(src)!;
      }
      if (next.get(netId)!==r) { next.set(netId,r); changed=true; }
    }
    if (!changed) break;
    if (iter===n) throw new SimLoopError();
  }

  const newGrid: Grid = new Map();
  for (const [k,cell] of grid)
    newGrid.set(k,{...cell,state:next.get(cellToNet.get(k)!)!});
  return newGrid;
}
