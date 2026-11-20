import type { NavGrid } from '../../systems/navigation/grid';
import type { TileKey } from '../tiles';

// Палуба: 14×32 тайла (224×512 px). Мостик с каютой — вверху, нос — внизу.
export const DECK_TILE = 16;

type Legend<T extends string> = Record<string, T | null>;

function parse<T extends string>(rows: string[], legend: Legend<T>): (T | null)[][] {
  return rows.map((row, y) =>
    [...row].map((ch, x) => {
      if (!(ch in legend)) throw new Error(`deck map: unknown char "${ch}" at ${x},${y}`);
      return legend[ch];
    }),
  );
}

// Земля: ~ вода, D — доски палубы (вариант выбирается детерминированно по координатам).
const GROUND_ROWS = [
  '~~~~~~~~~~~~~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~DDDDDDDDDD~~',
  '~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~',
];

// Объекты (все непроходимы): борта, стена каюты с дверью, бочки и ящики.
// Борта: Q W E — левый/правый угол и перекладина; | — вертикальный борт.
const OBJECT_ROWS = [
  '..............',
  '..Q--------E..',
  '..|.lwwwwr.|..',
  '..|.wcWDdc.|..',
  '..|........|..',
  '..|........|..',
  '..|B.......|..',
  '..|B.......|..',
  '..|........|..',
  '..|........|..',
  '..|........|..',
  '..|........|..',
  '..|........|..',
  '..|........|..',
  '..|........|..',
  '..|........|..',
  '..|........|..',
  '..|........|..',
  '..|........|..',
  '..|........|..',
  '..|.......B|..',
  '..|......BB|..',
  '..|........|..',
  '..|XX......|..',
  '..|.X......|..',
  '..|........|..',
  '..|........|..',
  '..|........|..',
  '..|........|..',
  '..A--------S..',
  '..............',
  '..............',
];

export const DECK_COLS = GROUND_ROWS[0].length;
export const DECK_ROWS = GROUND_ROWS.length;

export const DECK_GROUND: TileKey[][] = parse<TileKey>(GROUND_ROWS, {
  '~': 'water_a',
  D: 'deck_a',
}) as TileKey[][];

export const DECK_OBJECTS: (TileKey | null)[][] = parse<TileKey>(OBJECT_ROWS, {
  '.': null,
  Q: 'rail_corner_tl',
  E: 'rail_corner_tr',
  A: 'rail_corner_bl',
  S: 'rail_corner_br',
  '-': 'rail_h',
  '|': 'rail_v',
  l: 'cabin_wall_left',
  r: 'cabin_wall_right',
  w: 'cabin_wall',
  c: 'cabin_window',
  W: 'cabin_door_left',
  D: 'cabin_door_right',
  d: 'cabin_wall',
  B: 'barrel',
  X: 'crate',
});

/** Крупные объекты поверх сетки. col/row — левый верхний тайл. */
export const DECK_PROPS = [{ kind: 'mast', col: 6, row: 13, w: 2, h: 2 }] as const;

/** Игрок появляется внизу палубы (в тайлах). */
export const DECK_PLAYER_START = { col: 6.5, row: 27 };
/** Матрос стоит на палубе (в тайлах). */
export const DECK_SAILOR_POS = { col: 8.5, row: 21 };
export const DECK_WORLD_ZOOM = 2;

/**
 * Единый источник проходимости: вода, любой объект, мачта и матрос блокируют клетку.
 * По этой сетке строятся и физические коллайдеры сцены, и поиск пути.
 */
export function buildDeckNavGrid(): NavGrid {
  const blocked: boolean[][] = [];
  for (let row = 0; row < DECK_ROWS; row++) {
    const line: boolean[] = [];
    for (let col = 0; col < DECK_COLS; col++) {
      line.push(DECK_GROUND[row][col] !== 'deck_a' || DECK_OBJECTS[row][col] !== null);
    }
    blocked.push(line);
  }
  for (const p of DECK_PROPS) {
    for (let r = p.row; r < p.row + p.h; r++) for (let c = p.col; c < p.col + p.w; c++) blocked[r][c] = true;
  }
  blocked[Math.floor(DECK_SAILOR_POS.row)][Math.floor(DECK_SAILOR_POS.col)] = true;
  return { cols: DECK_COLS, rows: DECK_ROWS, tile: DECK_TILE, blocked };
}


// ───────────── Утро в гавани: та же палуба, справа причал и набережная, в планшире — проём трапа ─────────────

export type DeckMode = 'night' | 'morning';

/** Проём трапа в правом борту (колонка планшира, строки). Центр — точка, куда идёт героиня, чтобы сойти. */
export const GANGWAY = { col: 11, rows: [14, 15] as const };
export const GANGWAY_POS = { x: (GANGWAY.col + 0.5) * DECK_TILE, y: 15 * DECK_TILE };

const MORNING_GROUND_ROWS = GROUND_ROWS.map((row, y) => {
  const shore = y >= 1 && y <= 29;
  let r = row.slice(0, 12) + (shore ? 'PP' : '~~') + (shore ? 'QQQQ' : '~~~~');
  if (GANGWAY.rows.includes(y as 14 | 15)) r = r.slice(0, GANGWAY.col) + 'G' + r.slice(GANGWAY.col + 1);
  return r;
});

const MORNING_OBJECT_ROWS = OBJECT_ROWS.map((row, y) => {
  let r = row.slice(0, 12) + '..' + '....';
  if (GANGWAY.rows.includes(y as 14 | 15)) r = r.slice(0, GANGWAY.col) + '.' + r.slice(GANGWAY.col + 1);
  return r;
});
// Груз на набережной.
const quayCargo: Array<[number, number, string]> = [
  [15, 5, 'B'],
  [16, 5, 'B'],
  [16, 6, 'X'],
  [15, 11, 'X'],
  [16, 20, 'B'],
  [15, 21, 'X'],
  [16, 21, 'X'],
  [15, 26, 'B'],
];
for (const [c, r, ch] of quayCargo) {
  MORNING_OBJECT_ROWS[r] = MORNING_OBJECT_ROWS[r].slice(0, c) + ch + MORNING_OBJECT_ROWS[r].slice(c + 1);
}

/** Полная карта палубы для режима: земля, объекты, реквизит, сетка проходимости. */
export interface DeckLayout {
  mode: DeckMode;
  cols: number;
  rows: number;
  ground: TileKey[][];
  objects: (TileKey | null)[][];
  nav: NavGrid;
  /** Ключ воды для анимации и её второй кадр. */
  waterKeys: [TileKey, TileKey];
}

/** Причал и набережная видны, но недоступны: на берег героиня сходит по трапу (конец пролога). */
const WALKABLE_GROUND: ReadonlySet<TileKey> = new Set<TileKey>(['deck_a', 'deck_b', 'deck_c', 'gangway']);

export function isWalkableGround(key: TileKey): boolean {
  return WALKABLE_GROUND.has(key);
}

export function buildDeckLayout(mode: DeckMode, blockedCells: Array<{ col: number; row: number }> = []): DeckLayout {
  const morning = mode === 'morning';
  const groundRows = morning ? MORNING_GROUND_ROWS : GROUND_ROWS;
  const objectRows = morning ? MORNING_OBJECT_ROWS : OBJECT_ROWS;
  const ground = parse<TileKey>(groundRows, {
    '~': morning ? 'sea_a' : 'water_a',
    D: 'deck_a',
    P: 'pier',
    Q: 'quay',
    G: 'gangway',
  }) as TileKey[][];
  const objects = parse<TileKey>(objectRows, {
    '.': null,
    Q: 'rail_corner_tl',
    E: 'rail_corner_tr',
    A: 'rail_corner_bl',
    S: 'rail_corner_br',
    '-': 'rail_h',
    '|': 'rail_v',
    l: 'cabin_wall_left',
    r: 'cabin_wall_right',
    w: 'cabin_wall',
    c: 'cabin_window',
    W: 'cabin_door_left',
    D: 'cabin_door_right',
    d: 'cabin_wall',
    B: 'barrel',
    X: 'crate',
  });
  const rows = groundRows.length;
  const cols = groundRows[0].length;
  const blocked: boolean[][] = [];
  for (let row = 0; row < rows; row++) {
    const line: boolean[] = [];
    for (let col = 0; col < cols; col++) line.push(!isWalkableGround(ground[row][col]) || objects[row][col] !== null);
    blocked.push(line);
  }
  for (const p of DECK_PROPS) {
    for (let r = p.row; r < p.row + p.h; r++) for (let c = p.col; c < p.col + p.w; c++) blocked[r][c] = true;
  }
  for (const b of blockedCells) blocked[b.row][b.col] = true;
  return {
    mode,
    cols,
    rows,
    ground,
    objects,
    nav: { cols, rows, tile: DECK_TILE, blocked },
    waterKeys: morning ? ['sea_a', 'sea_b'] : ['water_a', 'water_b'],
  };
}
