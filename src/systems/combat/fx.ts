// Простые эффекты боя, нарисованные кодом (Phaser). Всё живёт в слое мира.

import Phaser from 'phaser';
import { SABER } from '../../data/tiles';

export interface FxContext {
  scene: Phaser.Scene;
  layer: Phaser.GameObjects.Layer;
}

const FX_DEPTH = 6000;

/** Дуга удара: белая полоса, быстро гаснет. */
export function slashArc(ctx: FxContext, x: number, y: number, dirX: number, dirY: number, reach: number, arcDeg: number): void {
  const g = ctx.scene.add.graphics().setDepth(FX_DEPTH);
  ctx.layer.add(g);
  const a = Math.atan2(dirY, dirX);
  const half = Phaser.Math.DegToRad(arcDeg / 2);
  g.lineStyle(3, 0xffffff, 0.95);
  g.beginPath();
  g.arc(x, y - 5, reach * 0.8, a - half, a + half, false);
  g.strokePath();
  g.lineStyle(1, 0xbfe3ff, 0.9);
  g.beginPath();
  g.arc(x, y - 5, reach * 0.8 - 3, a - half * 0.8, a + half * 0.8, false);
  g.strokePath();
  ctx.scene.tweens.add({ targets: g, alpha: 0, duration: 140, onComplete: () => g.destroy() });
}

/** Сабля поворачивается по дуге удара. */
export function saberSwing(ctx: FxContext, x: number, y: number, dirX: number, dirY: number, arcDeg: number, ms: number): void {
  const img = ctx.scene.add.image(x, y - 5, SABER.texture, SABER.frame).setOrigin(0.5, 1).setDepth(FX_DEPTH);
  ctx.layer.add(img);
  const a = Phaser.Math.RadToDeg(Math.atan2(dirY, dirX)) + 90; // спрайт смотрит вверх
  img.setAngle(a - arcDeg / 2);
  ctx.scene.tweens.add({
    targets: img,
    angle: a + arcDeg / 2,
    duration: ms,
    ease: 'Quad.easeOut',
    onComplete: () => img.destroy(),
  });
}

/** Всплывающая цифра/слово над точкой. */
export function floatText(ctx: FxContext, x: number, y: number, text: string, color = '#ffffff'): void {
  const t = ctx.scene.add
    .text(x, y - 14, text, {
      fontFamily: 'monospace',
      fontSize: '8px',
      color,
      stroke: '#000000',
      strokeThickness: 2,
      resolution: 3,
    })
    .setOrigin(0.5, 1)
    .setDepth(FX_DEPTH + 1);
  ctx.layer.add(t);
  ctx.scene.tweens.add({ targets: t, y: t.y - 10, alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
}

/** Затухающие копии спрайта вдоль рывка. */
export function afterimages(ctx: FxContext, view: Phaser.GameObjects.Image, fromX: number, toX: number, fromY: number, toY: number): void {
  const n = 4;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const ghost = ctx.scene.add
      .image(fromX + (toX - fromX) * t, fromY + (toY - fromY) * t, view.texture.key, view.frame.name)
      .setOrigin(0.5, 1)
      .setFlipX(view.flipX)
      .setTint(0x9fd0ff)
      .setAlpha(0.55 - i * 0.08)
      .setDepth(view.depth - 0.5);
    ctx.layer.add(ghost);
    ctx.scene.tweens.add({ targets: ghost, alpha: 0, duration: 260 + i * 40, onComplete: () => ghost.destroy() });
  }
}

/** Белая вспышка спрайта при попадании. */
export function hitFlash(scene: Phaser.Scene, view: Phaser.GameObjects.Image, ms = 90): void {
  view.setTintFill(0xffffff);
  scene.time.delayedCall(ms, () => {
    if (view.active) view.clearTint();
  });
}

/** Искры попадания. */
export function hitSpark(ctx: FxContext, x: number, y: number): void {
  const g = ctx.scene.add.graphics().setDepth(FX_DEPTH);
  ctx.layer.add(g);
  g.lineStyle(1, 0xfff2a8, 1);
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6 + Math.random() * 0.5;
    g.lineBetween(x + Math.cos(a) * 2, y - 6 + Math.sin(a) * 2, x + Math.cos(a) * 8, y - 6 + Math.sin(a) * 8);
  }
  ctx.scene.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });
}
