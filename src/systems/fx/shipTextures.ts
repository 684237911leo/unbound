import Phaser from 'phaser';
import { MAST_TEXTURE, SHEETS, SHIP_GEN_FRAMES } from '../../data/tiles';

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
      SHIP_GEN_FRAMES.forEach((name, i) => tex.add(name, 0, i * 16, 0, 16, 16));
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
