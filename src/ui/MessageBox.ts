import Phaser from 'phaser';

const MARGIN = 12;
const PAD = 12;
const BOTTOM_GAP = 20;

/** Простое окно сообщения в нижней части экрана. Закрывает вызывающий код (тап по экрану в DeckScene): тап закрывает окно и не двигает героиню. */
export class MessageBox {
  private readonly scene: Phaser.Scene;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private open = false;
  private onClose?: () => void;

  constructor(scene: Phaser.Scene, uiLayer: Phaser.GameObjects.Layer, depth = 3000) {
    this.scene = scene;
    const w = scene.scale.width - MARGIN * 2;
    this.bg = scene.add.graphics().setScrollFactor(0).setDepth(depth).setVisible(false);
    this.text = scene.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#f1ead2',
        lineSpacing: 4,
        wordWrap: { width: w - PAD * 2, useAdvancedWrap: true },
      })
      .setScrollFactor(0)
      .setDepth(depth + 1)
      .setVisible(false);
    this.hint = scene.add
      .text(0, 0, 'коснитесь, чтобы закрыть', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#8a94ad',
      })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(depth + 1)
      .setVisible(false);
    uiLayer.add([this.bg, this.text, this.hint]);

  }

  get isOpen(): boolean {
    return this.open;
  }

  show(message: string, onClose?: () => void): void {
    this.onClose = onClose;
    this.open = true;
    const { width, height } = this.scene.scale;
    const w = width - MARGIN * 2;
    this.text.setText(message);
    const h = this.text.height + PAD * 2 + 14;
    const x = MARGIN;
    const y = height - BOTTOM_GAP - h;
    this.bg.clear();
    this.bg.fillStyle(0x10162a, 0.94);
    this.bg.fillRoundedRect(x, y, w, h, 6);
    this.bg.lineStyle(2, 0xc9a227, 0.9);
    this.bg.strokeRoundedRect(x, y, w, h, 6);
    this.text.setPosition(x + PAD, y + PAD);
    this.hint.setPosition(x + w - PAD, y + h - 5);
    this.bg.setVisible(true);
    this.text.setVisible(true);
    this.hint.setVisible(true);
  }

  hide(): void {
    if (!this.open) return;
    this.open = false;
    this.bg.setVisible(false);
    this.text.setVisible(false);
    this.hint.setVisible(false);
    const cb = this.onClose;
    this.onClose = undefined;
    cb?.();
  }

  destroy(): void {
    this.bg.destroy();
    this.text.destroy();
    this.hint.destroy();
  }
}
