import Phaser from 'phaser';

const HEART = 14;
const GAP = 3;

/** Здоровье героини: ряд сердец вверху слева (камера интерфейса) и красная вспышка по краям при уроне. */
export class CombatHud {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly flash: Phaser.GameObjects.Rectangle;
  private shown = -1;
  private shownMax = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    layer: Phaser.GameObjects.Layer,
  ) {
    const W = scene.scale.width;
    const H = scene.scale.height;
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(1400);
    this.flash = scene.add.rectangle(W / 2, H / 2, W, H, 0xff0000, 0).setScrollFactor(0).setDepth(1300);
    layer.add([this.g, this.flash]);
  }

  setHp(hp: number, max: number): void {
    if (hp === this.shown && max === this.shownMax) return;
    this.shown = hp;
    this.shownMax = max;
    const g = this.g;
    g.clear();
    for (let i = 0; i < max; i++) {
      const x = 10 + i * (HEART + GAP);
      const y = 10;
      drawHeart(g, x, y, HEART, i < hp);
    }
  }

  /** Короткая красная вспышка экрана. */
  hurt(): void {
    this.flash.setAlpha(0.28);
    this.scene.tweens.add({ targets: this.flash, alpha: 0, duration: 300 });
  }

  destroy(): void {
    this.g.destroy();
    this.flash.destroy();
  }
}

function drawHeart(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, full: boolean): void {
  const fill = full ? 0xe03c4a : 0x3a2a33;
  const edge = full ? 0xffd2d6 : 0x6a5560;
  const r = s * 0.27;
  g.fillStyle(0x000000, 0.55);
  g.fillRect(x - 1, y - 1, s + 2, s + 1);
  g.fillStyle(fill, 1);
  g.fillCircle(x + s * 0.28, y + s * 0.3, r);
  g.fillCircle(x + s * 0.72, y + s * 0.3, r);
  g.fillTriangle(x + s * 0.02, y + s * 0.38, x + s * 0.98, y + s * 0.38, x + s * 0.5, y + s * 0.95);
  if (full) {
    g.fillStyle(edge, 0.9);
    g.fillRect(x + s * 0.2, y + s * 0.2, 2, 2);
  }
}
