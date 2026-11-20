import type { NavGrid, Point } from '../../systems/navigation/grid';
import type { TileKey } from '../tiles';

// Тестовая арена боя: комната ~12×14 тайлов (деревянный пол, стены), дверь вверху. Прообраз каюты капитана.
export const ROOM_TILE = 16;

const OBJECT_ROWS = [
  'LwwwwwwwwwwR',
  'LwwwwDdwwwwR',
  'L..........R',
  'L..........R',
  'L.B........R',
  'L.B.......XR',
  'L..........R',
  'L..........R',
  'L..........R',
  'L..X.......R',
  'L..........R',
  'L.......BB.R',
  'L..........R',
  'LwwwwwwwwwwR',
];

type Obj = TileKey | null;
const LEGEND: Record<string, Obj> = {
  '.': null,
  w: 'cabin_wall',
  L: 'cabin_wall_left',
  R: 'cabin_wall_right',
  D: 'cabin_door_right',
  d: 'cabin_door_right',
  B: 'barrel',
  X: 'crate',
};

export const ROOM_ROWS = OBJECT_ROWS.length;
export const ROOM_COLS = OBJECT_ROWS[0].length;

export const ROOM_OBJECTS: Obj[][] = OBJECT_ROWS.map((row, y) =>
  [...row].map((ch, x) => {
    if (!(ch in LEGEND)) throw new Error(`combat room: unknown char "${ch}" at ${x},${y}`);
    // Дверь в верхней стене — две половины.
    if (ch === 'D') return 'cabin_door_left';
    return LEGEND[ch];
  }),
);

/** Проходимость: стены, бочки и ящики блокируют. */
export function buildRoomNavGrid(): NavGrid {
  const blocked = ROOM_OBJECTS.map((row) => row.map((o) => o !== null));
  return { cols: ROOM_COLS, rows: ROOM_ROWS, tile: ROOM_TILE, blocked };
}

/** Именованные точки (мир, px): дверь, где входят враги, стойки стражников, старт героини. */
export const ROOM_POINTS: Record<string, Point> = {
  door: { x: 6 * ROOM_TILE, y: 2.6 * ROOM_TILE },
  guard_a: { x: 4.5 * ROOM_TILE, y: 5.5 * ROOM_TILE },
  guard_b: { x: 7.5 * ROOM_TILE, y: 5 * ROOM_TILE },
  captain: { x: 6 * ROOM_TILE, y: 4.5 * ROOM_TILE },
  heroine: { x: 6 * ROOM_TILE, y: 10.5 * ROOM_TILE },
};
