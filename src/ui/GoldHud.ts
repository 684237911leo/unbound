import Phaser from 'phaser';
import { COIN } from '../data/tiles';

/** Кошелёк: иконка монеты и число справа вверху (камера интерфейса). */
export class GoldHud {
  private readonly icon: Phaser.GameObjects.Image;
  private readonly text: Phaser.GameObjects.Text;
  private shown = 0;
  private tween?: Phaser.Tweens.Tween;

  constructor(
    private readonly scene: Phaser.Scene,
    layer: Phaser.GameObjects.Layer,
    gold: number,
  ) {
    const W = scene.scale.width;
    this.text = scene.add
      .text(W - 12, 14, String(gold), {
        fontFamily: 'monospace',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ffe08a',
        stroke: '#10162a',
        strokeThickness: 3,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1452);
    this.icon = scene.add
      .image(0, 22, COIN.texture, COIN.frame)
      .setScale(1.5)
      .setScrollFactor(0)
      .setDepth(1452);
    this.shown = gold;
    this.place();
    layer.add([this.icon, this.text]);
  }

  private place(): void {
    this.icon.setX(this.text.x - this.text.width - 16);
  }

  get value(): number {
    return this.shown;
  }

  /** Показывает значение; animate — плавный подсчёт с лёгким «подпрыгиванием». */
  set(gold: number, animate = false): void {
    this.tween?.stop();
    if (!animate) {
      this.shown = gold;
      this.text.setText(String(gold));
      this.place();
      return;
    }
    const from = this.shown;
    const counter = { v: from };
    this.tween = this.scene.tweens.add({
      targets: counter,
      v: gold,
      duration: 900,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        this.shown = Math.round(counter.v);
        this.text.setText(String(this.shown));
        this.place();
      },
      onComplete: () => {
        this.shown = gold;
        this.text.setText(String(gold));
        this.place();
      },
    });
    this.scene.tweens.add({ targets: this.text, scale: { from: 1.25, to: 1 }, duration: 250, yoyo: false });
  }

  destroy(): void {
    this.tween?.stop();
    this.icon.destroy();
    this.text.destroy();
  }
}
