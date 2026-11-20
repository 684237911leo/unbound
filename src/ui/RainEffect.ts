import Phaser from 'phaser';

interface Drop {
  x: number;
  y: number;
  speed: number;
}

/** Дождь одним Graphics-объектом (экранные координаты). Общий для меню и палубы. */
export class RainEffect {
  readonly graphics: Phaser.GameObjects.Graphics;
  private readonly drops: Drop[] = [];
  private readonly width: number;
  private readonly height: number;

  constructor(
    scene: Phaser.Scene,
    options: { count?: number; color?: number; alpha?: number; depth?: number } = {},
  ) {
    this.width = scene.scale.width;
    this.height = scene.scale.height;
    const count = options.count ?? 40;
    for (let i = 0; i < count; i++) {
      this.drops.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        speed: 18 + Math.random() * 14,
      });
    }
    this.color = options.color ?? 0x3a4a6b;
    this.alpha = options.alpha ?? 0.35;
    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(options.depth ?? 0);
  }

  private readonly color: number;
  private readonly alpha: number;

  update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    const g = this.graphics;
    g.clear();
    g.lineStyle(1, this.color, this.alpha);
    for (const d of this.drops) {
      // Скорость в оригинале — «px за секунду × 1»; множитель даёт заметное падение.
      d.y += d.speed * 12 * dt;
      d.x -= d.speed * 3 * dt;
      if (d.y > this.height + 10) {
        d.y = -10;
        d.x = Math.random() * (this.width + 80);
      } else if (d.x < -10) {
        d.x = this.width + Math.random() * 40;
      }
      g.lineBetween(d.x, d.y, d.x - 2, d.y + 8);
    }
  }
}
