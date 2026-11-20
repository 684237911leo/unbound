import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/game';

const VERSION_TEXT = `v${__APP_VERSION__} (${__APP_VERSION_CODE__})`;

interface Raindrop {
  line: Phaser.GameObjects.Line;
  speed: number;
}

export class MainMenuScene extends Phaser.Scene {
  private drops: Raindrop[] = [];

  constructor() {
    super('MainMenuScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b0f1a');

    this.createRain();

    // Portrait layout: title in the upper third, button near the lower-middle for thumb reach.
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.22, 'UNBOUND', {
        fontFamily: 'monospace',
        fontSize: '48px',
        fontStyle: 'bold',
        color: '#e8d9a8',
        stroke: '#2a1a0c',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.22 + 44, 'Последний приказ', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#8a94ad',
      })
      .setOrigin(0.5);

    const button = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.63, 'Начать', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#e8d9a8',
        backgroundColor: '#1d2538',
        padding: { left: 56, right: 56, top: 14, bottom: 14 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const notice = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.72, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#c9a227',
      })
      .setOrigin(0.5);

    button.on(Phaser.Input.Events.POINTER_OVER, () => button.setColor('#ffffff'));
    button.on(Phaser.Input.Events.POINTER_OUT, () => button.setColor('#e8d9a8'));
    button.on(Phaser.Input.Events.POINTER_UP, () => {
      notice.setText('Пролог в разработке');
    });

    this.add
      .text(GAME_WIDTH - 8, GAME_HEIGHT - 6, VERSION_TEXT, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#4a5570',
      })
      .setOrigin(1, 1);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.drops = [];
    });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    for (const drop of this.drops) {
      drop.line.y += drop.speed * dt;
      drop.line.x -= drop.speed * dt * 0.25;
      if (drop.line.y > GAME_HEIGHT + 10) {
        drop.line.y = -10;
        drop.line.x = Math.random() * (GAME_WIDTH + 80);
      } else if (drop.line.x < -10) {
        // Drift pushes drops off the left edge; wrap them back in from the right.
        drop.line.x = GAME_WIDTH + Math.random() * 40;
      }
    }
  }

  private createRain(): void {
    const count = 40;
    for (let i = 0; i < count; i++) {
      const x = Math.random() * GAME_WIDTH;
      const y = Math.random() * GAME_HEIGHT;
      const line = this.add.line(0, 0, 0, 0, 0, 8, 0x3a4a6b, 0.35);
      line.setPosition(x, y);
      line.setLineWidth(1);
      this.drops.push({ line, speed: 18 + Math.random() * 14 });
    }
  }
}
