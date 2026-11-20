import Phaser from 'phaser';

/** Строка цели вверху экрана по центру: «Цель: каюта капитана». Пустой текст скрывает её. */
export class ObjectiveBar {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private current = '';

  constructor(
    private readonly scene: Phaser.Scene,
    layer: Phaser.GameObjects.Layer,
    private readonly y = 14,
  ) {
    this.bg = scene.add.graphics().setScrollFactor(0).setDepth(1450).setVisible(false);
    this.label = scene.add
      .text(scene.scale.width / 2, y, '', { fontFamily: 'monospace', fontSize: '12px', color: '#f4e7b5' })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1451)
      .setVisible(false);
    layer.add([this.bg, this.label]);
  }

  get text(): string {
    return this.current;
  }

  set(text: string | null): void {
    const t = text ?? '';
    if (t === this.current) return;
    this.current = t;
    if (!t) {
      this.bg.setVisible(false);
      this.label.setVisible(false);
      return;
    }
    this.label.setText(t).setVisible(true);
    const w = this.label.width + 20;
    const h = this.label.height + 10;
    this.bg.clear().setVisible(true);
    this.bg.fillStyle(0x10162a, 0.85);
    this.bg.fillRoundedRect(this.scene.scale.width / 2 - w / 2, this.y - 5, w, h, 6);
    this.bg.lineStyle(1, 0xc9a227, 0.8);
    this.bg.strokeRoundedRect(this.scene.scale.width / 2 - w / 2, this.y - 5, w, h, 6);
    this.label.setAlpha(0);
    this.scene.tweens.add({ targets: this.label, alpha: 1, duration: 300 });
  }

  destroy(): void {
    this.bg.destroy();
    this.label.destroy();
  }
}
