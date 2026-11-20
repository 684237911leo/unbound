import Phaser from 'phaser';
import { CABIN_GEN_FRAMES, MAST_TEXTURE, SHEETS, SHIP_GEN_FRAMES } from '../../data/tiles';

// Процедурные текстуры корабля в палитре Kenney Tiny: доски палубы, ночная вода, мачта.
// В паках нет настила и воды в нужном виде, см. ASSETS.md «Пробелы».

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function drawPlanks(ctx: CanvasRenderingContext2D, ox: number, seed: number): void {
  const r = rng(seed);
  ctx.fillStyle = '#8a5a34';
  ctx.fillRect(ox, 0, 16, 16);
  // Две доски вдоль корпуса, со швами; шов смещён по вариантам.
  ctx.fillStyle = '#9a6a40';
  ctx.fillRect(ox + 1, 0, 6, 16);
  ctx.fillRect(ox + 9, 0, 6, 16);
  ctx.fillStyle = '#3b2418';
  ctx.fillRect(ox + 0, 0, 1, 16);
  ctx.fillRect(ox + 8, 0, 1, 16);
  // Торцевой стык досок.
  const j1 = 3 + Math.floor(r() * 10);
  const j2 = 3 + Math.floor(r() * 10);
  ctx.fillRect(ox + 1, j1, 7, 1);
  ctx.fillRect(ox + 9, j2, 7, 1);
  // Свилеватость и гвозди.
  ctx.fillStyle = '#7a4c2a';
  for (let i = 0; i < 5; i++) ctx.fillRect(ox + 1 + Math.floor(r() * 14), Math.floor(r() * 16), 1, 3);
  ctx.fillStyle = '#4a2e1c';
  ctx.fillRect(ox + 2, (j1 + 3) % 16, 1, 1);
  ctx.fillRect(ox + 12, (j2 + 3) % 16, 1, 1);
}

function drawWater(ctx: CanvasRenderingContext2D, ox: number, shift: number): void {
  ctx.fillStyle = '#16233f';
  ctx.fillRect(ox, 0, 16, 16);
  ctx.fillStyle = '#22355c';
  const dashes: Array<[number, number, number]> = [
    [2, 3, 5],
    [9, 7, 4],
    [3, 12, 6],
  ];
  for (const [x, y, w] of dashes) ctx.fillRect(ox + ((x + shift) % 14), y, w, 1);
  ctx.fillStyle = '#2e4676';
  ctx.fillRect(ox + ((6 + shift * 2) % 12), 9, 2, 1);
}

function drawSea(ctx: CanvasRenderingContext2D, ox: number, shift: number): void {
  ctx.fillStyle = '#3a78ad';
  ctx.fillRect(ox, 0, 16, 16);
  ctx.fillStyle = '#5b9bcf';
  const dashes: Array<[number, number, number]> = [
    [2, 3, 5],
    [9, 7, 4],
    [3, 12, 6],
  ];
  for (const [x, y, w] of dashes) ctx.fillRect(ox + ((x + shift) % 14), y, w, 1);
  ctx.fillStyle = '#a9d2ee';
  ctx.fillRect(ox + ((6 + shift * 2) % 12), 9, 2, 1);
}

/** Причал: светлые выбеленные доски поперёк. */
function drawPier(ctx: CanvasRenderingContext2D, ox: number): void {
  ctx.fillStyle = '#b8935f';
  ctx.fillRect(ox, 0, 16, 16);
  ctx.fillStyle = '#3b2418';
  for (const y of [0, 5, 10]) ctx.fillRect(ox, y, 16, 1);
  ctx.fillStyle = '#c9a674';
  for (const y of [1, 6, 11]) ctx.fillRect(ox, y, 16, 1);
  ctx.fillStyle = '#4a2e1c';
  for (const [x, y] of [[2, 3], [13, 8], [4, 13]]) ctx.fillRect(ox + x, y, 1, 1);
}

/** Трап: доски вдоль с канатными поручнями по краям. */
function drawGangway(ctx: CanvasRenderingContext2D, ox: number): void {
  ctx.fillStyle = '#a07848';
  ctx.fillRect(ox, 0, 16, 16);
  ctx.fillStyle = '#3b2418';
  for (const x of [4, 8, 12]) ctx.fillRect(ox + x, 0, 1, 16);
  ctx.fillStyle = '#d8c090';
  ctx.fillRect(ox, 0, 16, 2);
  ctx.fillRect(ox, 14, 16, 2);
  ctx.fillStyle = '#6b4a28';
  ctx.fillRect(ox, 2, 16, 1);
  ctx.fillRect(ox, 13, 16, 1);
}

/** Каменная набережная. */
function drawQuay(ctx: CanvasRenderingContext2D, ox: number): void {
  ctx.fillStyle = '#9097a6';
  ctx.fillRect(ox, 0, 16, 16);
  ctx.fillStyle = '#5e6472';
  ctx.fillRect(ox, 7, 16, 1);
  ctx.fillRect(ox, 15, 16, 1);
  ctx.fillRect(ox + 5, 0, 1, 7);
  ctx.fillRect(ox + 11, 8, 1, 7);
  ctx.fillStyle = '#a9b0be';
  ctx.fillRect(ox, 0, 16, 1);
  ctx.fillRect(ox, 8, 16, 1);
}

// ───── Каюта: тёмное корабельное дерево ─────

function cabinFloor(ctx: CanvasRenderingContext2D, ox: number, seed: number): void {
  const r = rng(seed);
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(ox, 0, 16, 16);
  ctx.fillStyle = '#684428';
  ctx.fillRect(ox + 1, 0, 6, 16);
  ctx.fillRect(ox + 9, 0, 6, 16);
  ctx.fillStyle = '#33200f';
  ctx.fillRect(ox, 0, 1, 16);
  ctx.fillRect(ox + 8, 0, 1, 16);
  ctx.fillRect(ox + 1, 2 + Math.floor(r() * 12), 7, 1);
  ctx.fillRect(ox + 9, 2 + Math.floor(r() * 12), 7, 1);
  ctx.fillStyle = '#4e301a';
  for (let i = 0; i < 4; i++) ctx.fillRect(ox + 1 + Math.floor(r() * 14), Math.floor(r() * 16), 1, 3);
}

function cabinWall(ctx: CanvasRenderingContext2D, ox: number): void {
  // Лицевая стена: горизонтальные тёмные доски шпангоута.
  const fills = ['#5c3b23', '#503220', '#5c3b23'];
  const ys = [0, 5, 10];
  ctx.fillStyle = '#26150b';
  ctx.fillRect(ox, 0, 16, 16);
  ys.forEach((y, i) => {
    ctx.fillStyle = fills[i];
    ctx.fillRect(ox, y, 16, 5);
    ctx.fillStyle = '#7a5232';
    ctx.fillRect(ox, y, 16, 1);
  });
  ctx.fillStyle = '#26150b';
  ctx.fillRect(ox, 15, 16, 1);
  ctx.fillStyle = '#c9a76a';
  for (const [x, y] of [[2, 2], [13, 2], [2, 7], [13, 7], [2, 12], [13, 12]]) ctx.fillRect(ox + x, y, 1, 1);
}

function cabinWindow(ctx: CanvasRenderingContext2D, ox: number): void {
  cabinWall(ctx, ox);
  ctx.fillStyle = '#c9a227';
  ctx.beginPath();
  ctx.arc(ox + 8, 8, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#14203a';
  ctx.beginPath();
  ctx.arc(ox + 8, 8, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a6a9a';
  ctx.fillRect(ox + 6, 5, 1, 3);
  ctx.fillRect(ox + 9, 8, 1, 3);
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(ox + 3, 8, 10, 1);
}

function cabinSide(ctx: CanvasRenderingContext2D, ox: number, rightSide: boolean): void {
  ctx.fillStyle = '#3c2616';
  ctx.fillRect(ox, 0, 16, 16);
  ctx.fillStyle = '#4a2f1b';
  ctx.fillRect(ox + 2, 0, 5, 16);
  ctx.fillRect(ox + 9, 0, 5, 16);
  ctx.fillStyle = '#26150b';
  ctx.fillRect(ox + 8, 0, 1, 16);
  // Внутренняя кромка (светлая) — со стороны комнаты.
  ctx.fillStyle = '#7a5232';
  ctx.fillRect(ox + (rightSide ? 0 : 15), 0, 1, 16);
  ctx.fillStyle = '#26150b';
  ctx.fillRect(ox + (rightSide ? 15 : 0), 0, 1, 16);
}

function cabinBottom(ctx: CanvasRenderingContext2D, ox: number): void {
  ctx.fillStyle = '#3c2616';
  ctx.fillRect(ox, 0, 16, 16);
  ctx.fillStyle = '#4a2f1b';
  ctx.fillRect(ox, 3, 16, 5);
  ctx.fillStyle = '#7a5232';
  ctx.fillRect(ox, 0, 16, 1);
  ctx.fillStyle = '#26150b';
  ctx.fillRect(ox, 8, 16, 1);
  ctx.fillRect(ox, 15, 16, 1);
}

function cabinDoor(ctx: CanvasRenderingContext2D, ox: number, right: boolean): void {
  ctx.fillStyle = '#2a190e';
  ctx.fillRect(ox, 0, 16, 16);
  ctx.fillStyle = '#8a5a34';
  ctx.fillRect(ox + (right ? 0 : 1), 1, right ? 15 : 15, 14);
  ctx.fillStyle = '#6a4426';
  ctx.fillRect(ox + 7, 1, 1, 14);
  ctx.fillStyle = '#9a6a40';
  ctx.fillRect(ox + (right ? 2 : 2), 1, 3, 14);
  ctx.fillStyle = '#2a2a30';
  ctx.fillRect(ox, 3, 16, 2);
  ctx.fillRect(ox, 11, 16, 2);
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(ox + (right ? 2 : 12), 7, 2, 3);
}

function rumBottle(ctx: CanvasRenderingContext2D, ox: number): void {
  ctx.fillStyle = '#2a190e';
  ctx.fillRect(ox + 5, 4, 6, 11);
  ctx.fillRect(ox + 6, 1, 4, 4);
  ctx.fillStyle = '#8a4a16';
  ctx.fillRect(ox + 6, 6, 4, 8);
  ctx.fillStyle = '#b8742a';
  ctx.fillRect(ox + 7, 6, 1, 8);
  ctx.fillStyle = '#6a4a2a';
  ctx.fillRect(ox + 7, 2, 2, 3);
  ctx.fillStyle = '#d8c090';
  ctx.fillRect(ox + 7, 1, 2, 1);
  ctx.fillRect(ox + 6, 9, 4, 3);
}

export function generateShipTextures(scene: Phaser.Scene): void {
  const textures = scene.textures;

  if (!textures.exists(SHEETS.ship)) {
    const tex = textures.createCanvas(SHEETS.ship, 16 * SHIP_GEN_FRAMES.length, 16);
    if (tex) {
      const ctx = tex.getContext();
      drawPlanks(ctx, 0, 11);
      drawPlanks(ctx, 16, 29);
      drawPlanks(ctx, 32, 53);
      drawWater(ctx, 48, 0);
      drawWater(ctx, 64, 4);
      drawSea(ctx, 80, 0);
      drawSea(ctx, 96, 4);
      drawPier(ctx, 112);
      drawGangway(ctx, 128);
      drawQuay(ctx, 144);
      SHIP_GEN_FRAMES.forEach((name, i) => tex.add(name, 0, i * 16, 0, 16, 16));
      tex.refresh();
    }
  }

  if (!textures.exists(SHEETS.cabin)) {
    const tex = textures.createCanvas(SHEETS.cabin, 16 * CABIN_GEN_FRAMES.length, 16);
    if (tex) {
      const ctx = tex.getContext();
      cabinFloor(ctx, 0, 7);
      cabinFloor(ctx, 16, 31);
      cabinWall(ctx, 32);
      cabinWindow(ctx, 48);
      cabinSide(ctx, 64, false);
      cabinSide(ctx, 80, true);
      cabinBottom(ctx, 96);
      cabinDoor(ctx, 112, false);
      cabinDoor(ctx, 128, true);
      rumBottle(ctx, 144);
      CABIN_GEN_FRAMES.forEach((name, i) => tex.add(name, 0, i * 16, 0, 16, 16));
      tex.refresh();
    }
  }

  if (!textures.exists(MAST_TEXTURE)) {
    const tex = textures.createCanvas(MAST_TEXTURE, 32, 32);
    if (tex) {
      const ctx = tex.getContext();
      const disc = (r: number, color: string): void => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(16, 16, r, 0, Math.PI * 2);
        ctx.fill();
      };
      disc(14, '#2e1a1a'); // контур
      disc(13, '#c9a76a'); // бухта каната
      disc(11, '#8d6a3a');
      disc(10, '#2e1a1a');
      disc(9, '#7a4c2a'); // сама мачта
      disc(6, '#9a6a40');
      ctx.fillStyle = '#b98a58';
      ctx.fillRect(11, 11, 3, 3);
      tex.refresh();
    }
  }
}
