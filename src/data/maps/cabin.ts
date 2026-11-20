import type { NavGrid, Point } from '../../systems/navigation/grid';
import { SHEETS, TILES, indoorId } from '../tiles';

// Каюта капитана: 12×22 тайла (192×352 px), портрет. Дверь — внизу. Стены — тёмное корабельное дерево (процедурные кадры cabin-gen).
// Мебель: Kenney Roguelike Indoor (кадры по номерам контактного листа) + Tiny Dungeon (сундук, бочка, ящик).
export const CABIN_TILE = 16;
export const CABIN_COLS = 12;
export const CABIN_ROWS = 22;
export const CABIN_DOOR_COLS = [5, 6] as const;

export interface CabinPiece {
  id: string;
  texture: string;
  frame: number | string;
  col: number;
  row: number;
  /** Клетка непроходима. */
  blocks?: boolean;
  /** Сдвиг по Y в пикселях (для предметов на столе). */
  dy?: number;
  /** Добавка к глубине (предмет поверх стола). */
  depthBonus?: number;
}

const IN = SHEETS.indoor;
const DNG = SHEETS.dungeon;
const ind = (id: number): number => indoorId(id);

/** Мебель и предметы. Глубина рисования — по нижнему краю тайла, как у остальных объектов. */
export const CABIN_PIECES: CabinPiece[] = [
  // Письменный стол у северной стены: капитан сидит за ним.
  { id: 'desk', texture: IN, frame: ind(112), col: 4, row: 3, blocks: true },
  { id: 'desk', texture: IN, frame: ind(113), col: 5, row: 3, blocks: true },
  { id: 'desk', texture: IN, frame: ind(114), col: 6, row: 3, blocks: true },
  // Карты (пергамент) и бутылка рома на столе.
  { id: 'desk_map', texture: IN, frame: ind(18), col: 4, row: 3, dy: -3, depthBonus: 1 },
  { id: 'desk_rum', texture: SHEETS.cabin, frame: 'rum', col: 6, row: 3, dy: -4, depthBonus: 1 },
  { id: 'chair', texture: IN, frame: ind(55), col: 5, row: 4, blocks: true },
  // Бутылочная полка над кроватью.
  { id: 'shelf', texture: IN, frame: ind(478), col: 1, row: 2, blocks: true },
  { id: 'shelf', texture: IN, frame: ind(479), col: 2, row: 2, blocks: true },
  // Шкаф: верх закрывает нижний ряд стены.
  { id: 'wardrobe', texture: IN, frame: ind(401), col: 9, row: 1 },
  { id: 'wardrobe', texture: IN, frame: ind(402), col: 10, row: 1 },
  { id: 'wardrobe', texture: IN, frame: ind(459), col: 9, row: 2, blocks: true },
  { id: 'wardrobe', texture: IN, frame: ind(461), col: 10, row: 2, blocks: true },
  // Кровать у западной стены: изголовье на севере.
  { id: 'bed', texture: IN, frame: ind(170), col: 1, row: 3, blocks: true },
  { id: 'bed', texture: IN, frame: ind(172), col: 1, row: 4, blocks: true },
  // Сундук капитана у восточной стены.
  { id: 'chest', texture: DNG, frame: TILES.chest.frame, col: 10, row: 7, blocks: true },
  // Груз в углах.
  { id: 'barrel', texture: DNG, frame: TILES.barrel.frame, col: 10, row: 18, blocks: true },
  { id: 'crate', texture: DNG, frame: TILES.crate.frame, col: 1, row: 18, blocks: true },
  { id: 'crate', texture: DNG, frame: TILES.crate.frame, col: 1, row: 19, blocks: true },
];

/** Какой кадр стены/пола стоит в клетке; null — внутри комнаты пол. */
export function wallFrame(col: number, row: number): string | null {
  if (row <= 1) return (row === 1 && (col === 3 || col === 7)) ? 'wall_win' : 'wall_a';
  if (row === CABIN_ROWS - 1) {
    if (col === CABIN_DOOR_COLS[0]) return 'door_l';
    if (col === CABIN_DOOR_COLS[1]) return 'door_r';
    return 'wall_bottom';
  }
  if (col === 0) return 'wall_left';
  if (col === CABIN_COLS - 1) return 'wall_right';
  return null;
}

export function floorFrame(col: number, row: number): string {
  return (col * 3 + row * 5 + col * row) % 3 === 0 ? 'floor_b' : 'floor_a';
}

/** Проходимость: стены и мебель блокируют. */
export function buildCabinNavGrid(): NavGrid {
  const blocked: boolean[][] = [];
  for (let row = 0; row < CABIN_ROWS; row++) {
    const line: boolean[] = [];
    for (let col = 0; col < CABIN_COLS; col++) line.push(wallFrame(col, row) !== null);
    blocked.push(line);
  }
  for (const p of CABIN_PIECES) if (p.blocks) blocked[p.row][p.col] = true;
  return { cols: CABIN_COLS, rows: CABIN_ROWS, tile: CABIN_TILE, blocked };
}

const T = CABIN_TILE;

/** Именованные точки (мир, px) для схватки и сцены. */
export const CABIN_POINTS: Record<string, Point> = {
  /** Здесь входят стражники. */
  door: { x: 6 * T, y: 20.4 * T },
  /** Капитан встаёт из-за стола. */
  desk: { x: 5.5 * T, y: 2.6 * T },
  guard_a: { x: 4.5 * T, y: 16.2 * T },
  guard_b: { x: 7.5 * T, y: 15.6 * T },
  captain: { x: 5.5 * T, y: 8 * T },
  /** Начало схватки: героиня стоит посреди каюты. */
  heroine: { x: 6 * T, y: 13 * T },
  /** Появление героини у двери. */
  enter: { x: 6 * T, y: 20.2 * T },
  /** Капитан за столом (спрайт до боя). */
  captainSeat: { x: 5.5 * T, y: 3 * T - 2 },
};
