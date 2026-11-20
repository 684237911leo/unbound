// Навигация по тайловой сетке (без Phaser): A* по проходимым клеткам, 8 направлений без срезания углов.

export interface Point {
  x: number;
  y: number;
}

export interface NavGrid {
  cols: number;
  rows: number;
  tile: number;
  /** blocked[row][col] === true — клетка непроходима. Единственный источник правды о проходимости. */
  blocked: readonly (readonly boolean[])[];
}

export function inBounds(g: NavGrid, col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < g.cols && row < g.rows;
}

export function isWalkable(g: NavGrid, col: number, row: number): boolean {
  return inBounds(g, col, row) && !g.blocked[row][col];
}

export function cellOf(g: NavGrid, x: number, y: number): { col: number; row: number } {
  return { col: Math.floor(x / g.tile), row: Math.floor(y / g.tile) };
}

export function cellCenter(g: NavGrid, col: number, row: number): Point {
  return { x: col * g.tile + g.tile / 2, y: row * g.tile + g.tile / 2 };
}

/** Проходима ли точка мира (с учётом размера тела: проверяются четыре угла квадрата полуширины `radius`). */
export function pointClear(g: NavGrid, x: number, y: number, radius = 0): boolean {
  for (const dx of [-radius, radius]) {
    for (const dy of [-radius, radius]) {
      const c = cellOf(g, x + dx, y + dy);
      if (!isWalkable(g, c.col, c.row)) return false;
    }
  }
  return true;
}

/** Ближайшая к точке (x, y) проходимая клетка по расстоянию до её центра; null, если проходимых нет. */
export function nearestWalkable(g: NavGrid, x: number, y: number): { col: number; row: number } | null {
  const c = cellOf(g, x, y);
  if (isWalkable(g, c.col, c.row)) return c;
  let best: { col: number; row: number } | null = null;
  let bestD = Infinity;
  for (let row = 0; row < g.rows; row++) {
    for (let col = 0; col < g.cols; col++) {
      if (g.blocked[row][col]) continue;
      const p = cellCenter(g, col, row);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { col, row };
      }
    }
  }
  return best;
}

/** Прямая a→b свободна для тела радиуса `radius` (шаг выборки — четверть тайла). */
export function lineClear(g: NavGrid, a: Point, b: Point, radius = 0): boolean {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(dist / (g.tile / 4)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!pointClear(g, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, radius)) return false;
  }
  return true;
}

/** Убирает лишние промежуточные точки, пока видна прямая линия до следующей (жадное сглаживание). */
export function simplifyPath(g: NavGrid, start: Point, path: readonly Point[], radius = 0): Point[] {
  const out: Point[] = [];
  let from = start;
  let i = 0;
  while (i < path.length) {
    let j = path.length - 1;
    while (j > i && !lineClear(g, from, path[j], radius)) j--;
    out.push(path[j]);
    from = path[j];
    i = j + 1;
  }
  return out;
}

const SQRT2 = Math.SQRT2;
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

class MinHeap {
  private readonly items: Array<{ id: number; f: number }> = [];
  get size(): number {
    return this.items.length;
  }
  push(id: number, f: number): void {
    const a = this.items;
    a.push({ id, f });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): number {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top.id;
  }
}

/** Сырой A*: цепочка клеток от start до goal включительно или null. Углы не срезаются. */
export function findCellPath(
  g: NavGrid,
  start: { col: number; row: number },
  goal: { col: number; row: number },
): Array<{ col: number; row: number }> | null {
  if (!isWalkable(g, start.col, start.row) || !isWalkable(g, goal.col, goal.row)) return null;
  const idx = (c: number, r: number): number => r * g.cols + c;
  const n = g.cols * g.rows;
  const gScore = new Float64Array(n).fill(Infinity);
  const parent = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const h = (c: number, r: number): number => {
    const dx = Math.abs(c - goal.col);
    const dy = Math.abs(r - goal.row);
    return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
  };
  const open = new MinHeap();
  const s = idx(start.col, start.row);
  const e = idx(goal.col, goal.row);
  gScore[s] = 0;
  open.push(s, h(start.col, start.row));
  while (open.size > 0) {
    const cur = open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === e) break;
    const cc = cur % g.cols;
    const cr = (cur / g.cols) | 0;
    for (const [dc, dr] of DIRS) {
      const nc = cc + dc;
      const nr = cr + dr;
      if (!isWalkable(g, nc, nr)) continue;
      if (dc !== 0 && dr !== 0 && (!isWalkable(g, cc + dc, cr) || !isWalkable(g, cc, cr + dr))) continue;
      const ni = idx(nc, nr);
      if (closed[ni]) continue;
      const cost = gScore[cur] + (dc !== 0 && dr !== 0 ? SQRT2 : 1);
      if (cost < gScore[ni]) {
        gScore[ni] = cost;
        parent[ni] = cur;
        open.push(ni, cost + h(nc, nr));
      }
    }
  }
  if (parent[e] === -1 && s !== e) return null;
  const cells: Array<{ col: number; row: number }> = [];
  for (let i = e; i !== -1; i = parent[i]) cells.push({ col: i % g.cols, row: (i / g.cols) | 0 });
  return cells.reverse();
}

/**
 * Путь в мировых координатах от `from` к `to`: A* по клеткам + сглаживание по прямой видимости.
 * Если `to` в непроходимой клетке — идём в ближайшую проходимую. Вернёт [] если уже на месте, null если пути нет.
 * Последняя точка — сама цель (когда она проходима для тела) или центр ближайшей клетки.
 */
export function findPath(g: NavGrid, from: Point, to: Point, radius = 0): Point[] | null {
  const startCell = nearestWalkable(g, from.x, from.y);
  const goalCell = nearestWalkable(g, to.x, to.y);
  if (!startCell || !goalCell) return null;
  const cells = findCellPath(g, startCell, goalCell);
  if (!cells) return null;
  const target = pointClear(g, to.x, to.y, radius) ? { x: to.x, y: to.y } : cellCenter(g, goalCell.col, goalCell.row);
  const pts = cells.slice(1, -1).map((c) => cellCenter(g, c.col, c.row));
  pts.push(target);
  const path = simplifyPath(g, from, pts, radius);
  const last = path[path.length - 1];
  if (last && Math.hypot(last.x - from.x, last.y - from.y) < 0.5) return [];
  return path;
}
