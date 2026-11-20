import { describe, it, expect } from 'vitest';
import {
  type NavGrid,
  cellCenter,
  findCellPath,
  findPath,
  isWalkable,
  lineClear,
  nearestWalkable,
  simplifyPath,
} from '../src/systems/navigation/grid';
import { PathFollower } from '../src/systems/navigation/follower';
import { keyboardVector } from '../src/systems/input/vector';
import { findTapped } from '../src/systems/interaction/nearest';

function make(rows: string[]): NavGrid {
  return {
    cols: rows[0].length,
    rows: rows.length,
    tile: 16,
    blocked: rows.map((r) => [...r].map((c) => c === '#')),
  };
}

describe('A*', () => {
  const g = make([
    '.......',
    '.#####.',
    '.#...#.',
    '.#.#.#.',
    '.#.#.#.',
    '.......',
  ]);

  it('находит путь в обход стены, все клетки проходимы', () => {
    const cells = findCellPath(g, { col: 0, row: 0 }, { col: 6, row: 5 })!;
    expect(cells[0]).toEqual({ col: 0, row: 0 });
    expect(cells[cells.length - 1]).toEqual({ col: 6, row: 5 });
    for (const c of cells) expect(isWalkable(g, c.col, c.row)).toBe(true);
  });

  it('не срезает углы по диагонали', () => {
    const h = make(['.#', '#.']);
    expect(findCellPath(h, { col: 0, row: 0 }, { col: 1, row: 1 })).toBeNull();
    const cells = findCellPath(g, { col: 0, row: 0 }, { col: 6, row: 5 })!;
    for (let i = 1; i < cells.length; i++) {
      const a = cells[i - 1];
      const b = cells[i];
      if (a.col !== b.col && a.row !== b.row) {
        expect(isWalkable(g, b.col, a.row)).toBe(true);
        expect(isWalkable(g, a.col, b.row)).toBe(true);
      }
    }
  });

  it('вернёт null, если цель отрезана', () => {
    const h = make(['.#.', '.#.', '.#.']);
    expect(findCellPath(h, { col: 0, row: 0 }, { col: 2, row: 0 })).toBeNull();
    expect(findPath(h, { x: 8, y: 8 }, { x: 40, y: 8 })).toBeNull();
  });

  it('оптимален на открытом поле (диагональ)', () => {
    const open = make(['.....', '.....', '.....', '.....', '.....']);
    expect(findCellPath(open, { col: 0, row: 0 }, { col: 4, row: 4 })).toHaveLength(5);
  });
});

describe('nearestWalkable и тап по непроходимой клетке', () => {
  const g = make(['...', '.#.', '...']);
  it('в проходимой клетке возвращает её же', () => {
    expect(nearestWalkable(g, 8, 8)).toEqual({ col: 0, row: 0 });
  });
  it('на блоке выбирает ближайшую по расстоянию', () => {
    const c = nearestWalkable(g, 16 + 12, 16 + 8)!; // правая часть центральной клетки
    expect(c).toEqual({ col: 2, row: 1 });
  });
  it('findPath к заблокированной точке приводит в соседнюю клетку', () => {
    const p = findPath(g, { x: 8, y: 8 }, { x: 24, y: 24 })!;
    const last = p[p.length - 1];
    expect(isWalkable(g, Math.floor(last.x / 16), Math.floor(last.y / 16))).toBe(true);
  });
});

describe('сглаживание пути', () => {
  const g = make([
    '.........',
    '.........',
    '....#....',
    '....#....',
    '.........',
  ]);
  it('на открытом месте путь — одна прямая', () => {
    const p = findPath(g, cellCenter(g, 0, 0), cellCenter(g, 8, 1))!;
    expect(p).toHaveLength(1);
  });
  it('обходит препятствие и не пересекает его', () => {
    const from = cellCenter(g, 0, 3);
    const p = findPath(g, from, cellCenter(g, 8, 3), 5)!;
    expect(p.length).toBeGreaterThan(1);
    let a = from;
    for (const b of p) {
      expect(lineClear(g, a, b, 5)).toBe(true);
      a = b;
    }
  });
  it('учитывает радиус тела: щель в одну клетку у угла не режется', () => {
    const w = make(['.#', '..']);
    expect(lineClear(w, cellCenter(w, 0, 0), cellCenter(w, 1, 1), 0)).toBe(true);
    expect(lineClear(w, cellCenter(w, 0, 0), cellCenter(w, 1, 1), 5)).toBe(false);
    const raw = [cellCenter(w, 0, 1), cellCenter(w, 1, 1)];
    expect(simplifyPath(w, cellCenter(w, 0, 0), raw, 5)).toHaveLength(2);
  });
  it('цель = точка тапа, если она проходима', () => {
    const p = findPath(g, cellCenter(g, 0, 0), { x: 70, y: 10 }, 5)!;
    expect(p[p.length - 1]).toEqual({ x: 70, y: 10 });
  });
});

describe('PathFollower', () => {
  it('ведёт к точке и сообщает о прибытии', () => {
    const f = new PathFollower();
    const pos = { x: 0, y: 0 };
    f.set([{ x: 30, y: 0 }, { x: 30, y: 40 }], pos);
    let arrived = false;
    for (let i = 0; i < 400 && !arrived; i++) {
      const r = f.step(pos, 70, 1 / 60);
      pos.x += r.move.x * 70 / 60;
      pos.y += r.move.y * 70 / 60;
      arrived = r.arrived;
    }
    expect(arrived).toBe(true);
    expect(Math.hypot(pos.x - 30, pos.y - 40)).toBeLessThan(2);
    expect(f.active).toBe(false);
  });
  it('замечает застревание', () => {
    const f = new PathFollower();
    f.set([{ x: 100, y: 0 }], { x: 0, y: 0 });
    let stuck = false;
    for (let i = 0; i < 100 && !stuck; i++) stuck = f.step({ x: 0, y: 0 }, 70, 1 / 60).stuck;
    expect(stuck).toBe(true);
  });
  it('cancel сбрасывает маршрут', () => {
    const f = new PathFollower();
    f.set([{ x: 10, y: 0 }], { x: 0, y: 0 });
    f.cancel();
    expect(f.active).toBe(false);
  });
});

describe('ввод и касания', () => {
  it('keyboardVector гасит противоположные клавиши и нормализует диагональ', () => {
    expect(keyboardVector(true, true, false, false)).toEqual({ x: 0, y: 0 });
    const d = keyboardVector(false, true, false, true);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1);
  });
  it('findTapped находит объект под касанием и учитывает tapRadius', () => {
    const items = [
      { id: 'a', x: 0, y: 0, radius: 10, tapRadius: 20 },
      { id: 'b', x: 100, y: 0, radius: 10 },
    ];
    expect(findTapped(items, 15, 0)?.id).toBe('a');
    expect(findTapped(items, 30, 0)).toBeNull();
    expect(findTapped(items, 100, 10)?.id).toBe('b');
    expect(findTapped(items, 100, 20)).toBeNull();
  });
});
