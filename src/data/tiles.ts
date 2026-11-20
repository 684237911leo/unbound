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
];

export interface FrameRef {
  texture: string;
  frame: number | string;
}

/** Героиня: женский персонаж Tiny Dungeon (розовое платье, длинные волосы). */
export const HEROINE: FrameRef = { texture: SHEETS.dungeon, frame: 99 };
/** Матрос: бородатый мужчина Tiny Dungeon. */
export const SAILOR: FrameRef = { texture: SHEETS.dungeon, frame: 86 };

/** Кадры процедурного листа ship-gen (имена, а не индексы). */
export const SHIP_GEN_FRAMES = ['plank_a', 'plank_b', 'plank_c', 'water_a', 'water_b'] as const;

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

  // Груз: Tiny Dungeon
  barrel: { texture: SHEETS.dungeon, frame: 82 },
  crate: { texture: SHEETS.dungeon, frame: 63 },
  chest: { texture: SHEETS.dungeon, frame: 89 },
} as const satisfies Record<string, FrameRef>;

export type TileKey = keyof typeof TILES;

/** Мачта — крупный процедурный спрайт 32×32 (в паках её нет). */
export const MAST_TEXTURE = 'mast-gen';
