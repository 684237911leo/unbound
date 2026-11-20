import Phaser from 'phaser';
import { RainEffect } from '../ui/RainEffect';

const VERSION_TEXT = `v${__APP_VERSION__} (${__APP_VERSION_CODE__})`;

export class MainMenuScene extends Phaser.Scene {
  private rain?: RainEffect;

  constructor() {
    super('MainMenuScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b0f1a');

    const W = this.scale.width;
    const H = this.scale.height;
    this.rain = new RainEffect(this);

    // Portrait layout: title in the upper third, button near the lower-middle for thumb reach.
    this.add
      .text(W / 2, H * 0.22, 'UNBOUND', {
        fontFamily: 'monospace',
        fontSize: '48px',
        fontStyle: 'bold',
        color: '#e8d9a8',
        stroke: '#2a1a0c',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, H * 0.22 + 44, 'Последний приказ', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#8a94ad',
      })
      .setOrigin(0.5);

    const button = this.add
      .text(W / 2, H * 0.63, 'Начать', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#e8d9a8',
        backgroundColor: '#1d2538',
        padding: { left: 56, right: 56, top: 14, bottom: 14 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    button.on(Phaser.Input.Events.POINTER_OVER, () => button.setColor('#ffffff'));
    button.on(Phaser.Input.Events.POINTER_OUT, () => button.setColor('#e8d9a8'));
    button.on(Phaser.Input.Events.POINTER_UP, () => {
      this.scene.start('DeckScene');
    });

    this.add
      .text(W - 8, H - 6, VERSION_TEXT, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#4a5570',
      })
      .setOrigin(1, 1);
  }

  update(_time: number, delta: number): void {
    this.rain?.update(delta);
  }
}
