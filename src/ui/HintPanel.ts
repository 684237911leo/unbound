import Phaser from 'phaser';

/** Подсказка внизу экрана (обучение боя) и центральный баннер («Ещё раз»). Рисуется в слое интерфейса. */
export class HintPanel {
  private readonly box: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly sub: Phaser.GameObjects.Text;
  private readonly bannerText: Phaser.GameObjects.Text;
  private pulse?: Phaser.Tweens.Tween;
  private bannerTween?: Phaser.Tweens.Tween;
  private current = '';

  constructor(
    private readonly scene: Phaser.Scene,
    layer: Phaser.GameObjects.Layer,
  ) {
    const W = scene.scale.width;
    const H = scene.scale.height;
    this.box = scene.add.graphics().setScrollFactor(0).setDepth(1500).setVisible(false);
    this.title = scene.add
      .text(W / 2, H - 92, '', {
        fontFamily: 'monospace',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#f4e7b5',
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1501)
      .setVisible(false);
    this.sub = scene.add
      .text(W / 2, H - 70, '', { fontFamily: 'monospace', fontSize: '11px', color: '#9fb4e0', align: 'center' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1501)
      .setVisible(false);
    this.bannerText = scene.add
      .text(W / 2, H * 0.32, '', {
        fontFamily: 'monospace',
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#ffe9a8',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1600)
      .setAlpha(0);
    layer.add([this.box, this.title, this.sub, this.bannerText]);
  }

  /** Текущий текст подсказки ('' — скрыта). */
  get text(): string {
    return this.current;
  }

  show(text: string, sub = ''): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    this.current = text;
    this.title.setText(text).setVisible(true);
    this.sub.setText(sub).setVisible(sub !== '');
    const w = Math.min(W - 24, Math.max(220, this.title.width + 36, this.sub.width + 24));
    const h = sub ? 56 : 40;
    const y = sub ? H - 108 : H - 100;
    this.title.setY(sub ? H - 92 : H - 80);
    this.box.clear().setVisible(true);
    this.box.fillStyle(0x1d2538, 0.93);
    this.box.fillRoundedRect(W / 2 - w / 2, y, w, h, 8);
    this.box.lineStyle(2, 0xc9a227, 1);
    this.box.strokeRoundedRect(W / 2 - w / 2, y, w, h, 8);
    this.pulse?.stop();
    this.title.setAlpha(1);
    this.pulse = this.scene.tweens.add({ targets: this.title, alpha: 0.55, duration: 450, yoyo: true, repeat: -1 });
  }

  hide(): void {
    this.current = '';
    this.pulse?.stop();
    this.title.setVisible(false);
    this.sub.setVisible(false);
    this.box.setVisible(false);
  }

  /** Крупная надпись по центру на время. */
  banner(text: string, ms = 1400): void {
    this.bannerTween?.stop();
    this.bannerText.setText(text).setAlpha(0).setScale(0.8);
    this.bannerTween = this.scene.tweens.add({
      targets: this.bannerText,
      alpha: { from: 0, to: 1 },
      scale: 1,
      duration: 200,
      hold: Math.max(0, ms - 500),
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  destroy(): void {
    this.pulse?.stop();
    this.bannerTween?.stop();
    this.box.destroy();
    this.title.destroy();
    this.sub.destroy();
    this.bannerText.destroy();
  }
}
