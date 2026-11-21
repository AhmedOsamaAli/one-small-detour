import { randomSource, seedOf } from './generation.ts';
import { constructPairChallenge } from './pairGeneration.ts';
import { pairGeometry } from './pairDifficulty.ts';
import { applySwap, inspectPatch, isAnchor, patchCells, patchesOverlap, rulesFor, shapesFor, tileAt, validateRepair, walkable } from './rules.ts';
import { certifyPatchMinimum, coverPatchStock, patchStockInsulation } from './patchDifficulty.ts';
import type { AuthoredPuzzle, Cell, PatchFamily, Shape, Swap, Tile } from './types.ts';

export type CampaignFrame = 'pair' | PatchFamily;
export type PatchConstruction = { status: 'constructed'; puzzle: AuthoredPuzzle } |
  { status: 'rejected'; reason: string };
interface Parcel { start: Cell; shape: Shape; cells: number[] }

export function constructPatchChallenge(frame: CampaignFrame, minimum: number, seed: number, routePairs: number,
  stockMode: 'import' | 'cover' = 'cover'): PatchConstruction {
  if (!Number.isInteger(minimum) || minimum < 2 || minimum > 12) throw new Error('A campaign patch minimum must be between two and twelve.');
  const base = constructPairChallenge(3, seed, routePairs);
  if (base.status === 'rejected') return base;
  const solved = validateRepair(base.puzzle, 'daily', base.puzzle.witness).board, geometry = pairGeometry(base.puzzle);
  const area = frame === 'pair' ? 2 : frame === 'strip' ? 3 : 4;
  const shell: AuthoredPuzzle = { ...base.puzzle, id: `patch-${frame}-${minimum}-${routePairs}-${seed}`, board: solved,
    note: 'Every road piece matters. Plan your cuts before you swap.',
    area, ...(frame === 'pair' ? {} : { frame }), minimum, witness: [] };
  const size = solved.length, state = solved.join(''), random = randomSource(seedOf(shell.id));
  const parcels: Parcel[] = shapesFor(area, size, shell.frame).flatMap(shape =>
    Array.from({ length: size ** 2 }, (_, index) => ({ row: Math.floor(index / size), col: index % size }))
      .filter(start => inspectPatch(solved, start, shape) === null)
      .map(start => ({ start, shape, cells: patchCells(start, shape).map(cell => cell.row * size + cell.col) })));
  const possible = parcels.filter(parcel => parcel.cells.every(index => walkable(state[index]) && !isAnchor(state[index])));
  let selected: Parcel[] = [];
  for (let trial = 0; trial < 16 && selected.length < minimum; trial++) {
    const ordered = possible.map(parcel => ({ parcel, order: random() })).sort((a, b) => a.order - b.order);
    const occupied = new Set<number>(), trialParcels: Parcel[] = [];
    for (const { parcel } of ordered) {
      if (parcel.cells.some(index => occupied.has(index))) continue;
      trialParcels.push(parcel); parcel.cells.forEach(index => occupied.add(index));
      if (trialParcels.length === minimum) break;
    }
    if (trialParcels.length > selected.length) selected = trialParcels;
  }
  if (selected.length !== minimum) return { status: 'rejected', reason: 'insufficient-full-frame-route' };
  const insulation = patchStockInsulation(shell, geometry);
  const insulated = (index: number): boolean => stockMode === 'cover' ? insulation[index] === 1 :
    !geometry.geodesic[index] && (geometry.neighbors[index] ?? []).every(next => !geometry.geodesic[next]);
  const parking = parcels.filter(parcel => parcel.cells.every(index => insulated(index) && !walkable(state[index])));
  const options = selected.map(target => parking.filter(source => source.shape.rows === target.shape.rows &&
    source.shape.cols === target.shape.cols && source.shape.kind === target.shape.kind));
  const order = selected.map((_, index) => index).sort((a, b) => (options[a]?.length ?? 0) - (options[b]?.length ?? 0));
  const occupied = new Set<number>(), sources = new Map<number, Parcel>();
  let visits = 0;
  const pack = (position: number): boolean => {
    if (position === selected.length) return true;
    if (++visits > 2500) return false;
    const index = order[position];
    if (index === undefined) throw new Error('Patch parking lost its target.');
    const choices = (options[index] ?? []).filter(source => source.cells.every(cell => !occupied.has(cell)))
      .map(source => ({ source, score: source.cells.reduce((sum, cell) => sum +
        (geometry.neighbors[cell] ?? []).filter(next => occupied.has(next)).length, 0) + random() * 2 }))
      .sort((a, b) => b.score - a.score);
    for (const { source } of choices) {
      source.cells.forEach(cell => occupied.add(cell)); sources.set(index, source);
      if (pack(position + 1)) return true;
      source.cells.forEach(cell => occupied.delete(cell)); sources.delete(index);
    }
    return false;
  };
  if (!pack(0)) return { status: 'rejected', reason: 'full-frame-parking-budget' };
  const grid: Tile[][] = solved.map((_, row) => Array.from({ length: size }, (_, col) => tileAt(solved, { row, col })));
  const witness: Swap[] = [];
  for (const [index, target] of selected.entries()) {
    const source = sources.get(index);
    if (!source) throw new Error('A full-frame source is missing.');
    const move = { ...target.shape, a: source.start, b: target.start };
    witness.push(move);
    for (let offset = 0; offset < target.cells.length; offset++) {
      const destination = target.cells[offset], origin = source.cells[offset];
      if (destination === undefined || origin === undefined) throw new Error('A full-frame parcel lost a tile.');
      const tile = state[destination];
      if (tile !== 'o' && tile !== 'h' && tile !== 'v') throw new Error('The final path must contain only useful road/bridge cargo.');
      const line = grid[Math.floor(origin / size)], gap = grid[Math.floor(destination / size)];
      if (!line || !gap) throw new Error('A full-frame parcel left its landscape.');
      line[origin % size] = tile; gap[destination % size] = random() < .32 ? '~' : '.';
    }
  }
  const puzzle = { ...shell, board: grid.map(row => row.join('')), witness };
  validateRepair(puzzle, 'daily', witness);
  return { status: 'constructed', puzzle };
}

export function constructPreparedPatchChallenge(frame: CampaignFrame, minimum: number, seed: number, routePairs: number): PatchConstruction {
  const base = constructPatchChallenge(frame, minimum - 1, seed, routePairs);
  if (base.status === 'rejected') return base;
  const puzzle = base.puzzle, geometry = pairGeometry(puzzle), size = geometry.size, state = puzzle.board.join('');
  const insulation = patchStockInsulation(puzzle, geometry);
  const random = randomSource(seedOf(`${puzzle.id}:preparation`));
  const parcels = shapesFor(puzzle.area, size, puzzle.frame).flatMap(shape =>
    Array.from({ length: size ** 2 }, (_, index) => ({ row: Math.floor(index / size), col: index % size }))
      .filter(start => inspectPatch(puzzle.board, start, shape) === null)
      .map(start => ({ start, shape, cells: patchCells(start, shape).map(cell => cell.row * size + cell.col) }))
      .filter(parcel => parcel.cells.every(index => insulation[index] === 1)));
  const choices = parcels.filter(parcel => parcel.cells.some(index => walkable(state[index]))).flatMap(source =>
    parcels.filter(target => target.shape.rows === source.shape.rows && target.shape.cols === source.shape.cols &&
      target.cells.some(index => !walkable(state[index])) &&
      !patchesOverlap({ ...source.shape, a: source.start, b: target.start }))
      .map(target => ({ move: { ...source.shape, a: source.start, b: target.start }, order: random() })))
    .sort((a, b) => a.order - b.order).slice(0, 40);
  for (const { move } of choices) {
    const board = applySwap(puzzle.board, move, rulesFor(puzzle, 'daily'));
    if (coverPatchStock(puzzle, board, geometry).status !== 'impossible') continue;
    const prepared = { ...puzzle, id: `${puzzle.id}:prepare`, board, minimum, witness: [move, ...puzzle.witness] };
    certifyPatchMinimum(prepared);
    return { status: 'constructed', puzzle: prepared };
  }
  return { status: 'rejected', reason: 'no-provable-preparation' };
}
