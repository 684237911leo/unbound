// Единый список кадров спрайтов. Индексы кадров — только здесь, сцены используют имена.
// Раскладки листов — ASSETS.md. Kenney Tiny Town / Tiny Dungeon: 16×16, 12×11 тайлов, без отступов.

export interface SheetDef {
  key: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
  margin?: number;
  spacing?: number;
}

export const SHEETS = {
  town: 'tiny-town',
  dungeon: 'tiny-dungeon',
  /** Kenney Roguelike Indoor: мебель каюты (отступ между кадрами 1 px). */
  indoor: 'roguelike-indoor',
  /** Процедурные тайлы каюты: тёмное дерево стен и пола, дверь, бутылка рома. */
  cabin: 'cabin-gen',
  /** Процедурные тайлы (палуба, вода, мачта), см. systems/fx/shipTextures.ts */
  ship: 'ship-gen',
} as const;

export const SHEET_FILES: SheetDef[] = [
  {
    key: SHEETS.town,
    path: 'assets/third_party/kenney-tiny-town/tilemap_packed.png',
    frameWidth: 16,
    frameHeight: 16,
  },
  {
    key: SHEETS.dungeon,
    path: 'assets/third_party/kenney-tiny-dungeon/tilemap_packed.png',
    frameWidth: 16,
    frameHeight: 16,
  },
  {
    key: SHEETS.indoor,
    path: 'assets/third_party/kenney-roguelike-indoor/roguelikeIndoor_transparent.png',
    frameWidth: 16,
    frameHeight: 16,
    margin: 0,
    spacing: 1,
  },
];

/**
 * Roguelike Indoor: 457 px при шаге 17 даёт 26 полных колонок в Phaser (27-я обрезана).
 * indoor(col, row) принимает колонку/строку в сетке листа; можно задавать и по «номеру в сетке из 27 колонок» (indoorId).
 */
export const INDOOR_COLS = 26;
export function indoor(col: number, row: number): number {
  return row * INDOOR_COLS + col;
}
/** Номер ячейки при подсчёте в 27 колонок (как на контактном листе в ASSETS) → кадр Phaser. */
export function indoorId(id27: number): number {
  return indoor(id27 % 27, Math.floor(id27 / 27));
}

export interface FrameRef {
  texture: string;
  frame: number | string;
}

/** Героиня: женский персонаж Tiny Dungeon (розовое платье, длинные волосы). */
export const HEROINE: FrameRef = { texture: SHEETS.dungeon, frame: 99 };
/** Матрос: бородатый мужчина Tiny Dungeon. */
export const SAILOR: FrameRef = { texture: SHEETS.dungeon, frame: 86 };

/** Стражники-матросы (бой): два разных мужских персонажа Tiny Dungeon. */
export const GUARD_A: FrameRef = { texture: SHEETS.dungeon, frame: 85 };
export const GUARD_B: FrameRef = { texture: SHEETS.dungeon, frame: 88 };
/** Капитан: седой суровый боец Tiny Dungeon (отличается от матросов). */
export const CAPTAIN: FrameRef = { texture: SHEETS.dungeon, frame: 100 };
/** Сабля героини (спрайт меча Tiny Dungeon; вертикальный, остриём вверх). */
export const SABER: FrameRef = { texture: SHEETS.dungeon, frame: 104 };

/** Кадры процедурного листа ship-gen (имена, а не индексы). */
export const SHIP_GEN_FRAMES = [
  'plank_a',
  'plank_b',
  'plank_c',
  'water_a',
  'water_b',
  'sea_a',
  'sea_b',
  'pier',
  'gangway',
  'quay',
] as const;

/** Кадры процедурного листа cabin-gen. */
export const CABIN_GEN_FRAMES = [
  'floor_a',
  'floor_b',
  'wall_a',
  'wall_win',
  'wall_left',
  'wall_right',
  'wall_bottom',
  'door_l',
  'door_r',
  'rum',
] as const;

/** Тайлы карт: ключ → кадр. Карты (src/data/maps) ссылаются на ключи. */
export const TILES = {
  deck_a: { texture: SHEETS.ship, frame: 'plank_a' },
  deck_b: { texture: SHEETS.ship, frame: 'plank_b' },
  deck_c: { texture: SHEETS.ship, frame: 'plank_c' },
  water_a: { texture: SHEETS.ship, frame: 'water_a' },
  water_b: { texture: SHEETS.ship, frame: 'water_b' },

  // Планширь: деревянный забор Tiny Town
  rail_h: { texture: SHEETS.town, frame: 81 },
  rail_v: { texture: SHEETS.town, frame: 58 },
  rail_corner_tl: { texture: SHEETS.town, frame: 44 },
  rail_corner_tr: { texture: SHEETS.town, frame: 46 },
  rail_corner_bl: { texture: SHEETS.town, frame: 68 },
  rail_corner_br: { texture: SHEETS.town, frame: 70 },

  // Каюта капитана: деревянная стена Tiny Town
  cabin_wall: { texture: SHEETS.town, frame: 73 },
  cabin_wall_left: { texture: SHEETS.town, frame: 72 },
  cabin_wall_right: { texture: SHEETS.town, frame: 75 },
  cabin_window: { texture: SHEETS.town, frame: 84 },
  cabin_door_left: { texture: SHEETS.town, frame: 86 },
  cabin_door_right: { texture: SHEETS.town, frame: 87 },

  // Гавань (утро): дневное море, причал, трап, каменная набережная
  sea_a: { texture: SHEETS.ship, frame: 'sea_a' },
  sea_b: { texture: SHEETS.ship, frame: 'sea_b' },
  pier: { texture: SHEETS.ship, frame: 'pier' },
  gangway: { texture: SHEETS.ship, frame: 'gangway' },
  quay: { texture: SHEETS.ship, frame: 'quay' },

  // Груз: Tiny Dungeon
  barrel: { texture: SHEETS.dungeon, frame: 82 },
  crate: { texture: SHEETS.dungeon, frame: 63 },
  chest: { texture: SHEETS.dungeon, frame: 89 },
  chest_open: { texture: SHEETS.dungeon, frame: 90 },
} as const satisfies Record<string, FrameRef>;

export type TileKey = keyof typeof TILES;

/** Мачта — крупный процедурный спрайт 32×32 (в паках её нет). */
export const MAST_TEXTURE = 'mast-gen';

/** Монета для кошелька (Tiny Town: золотой слиток/монета). */
export const COIN: FrameRef = { texture: SHEETS.town, frame: 93 };
