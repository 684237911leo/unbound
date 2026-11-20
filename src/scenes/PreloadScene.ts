import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/game';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  create(): void {
    const barWidth = 240;
    const barHeight = 12;
    const x = (GAME_WIDTH - barWidth) / 2;
    const y = GAME_HEIGHT / 2 + 20;

    const frame = this.add.graphics();
    frame.lineStyle(2, 0x3a4560, 1);
    frame.strokeRect(x - 2, y - 2, barWidth + 4, barHeight + 4);

    const fill = this.add.graphics();
    const label = this.add
      .text(GAME_WIDTH / 2, y - 16, 'Загрузка…', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#8a94ad',
      })
      .setOrigin(0.5, 1);

    // Placeholder textures are generated in code until real art lands.
    this.generatePlaceholderTextures();

    // Simulated progress so the bar is visible; generation above is effectively instant.
    let progress = 0;
    const draw = (value: number): void => {
      fill.clear();
      fill.fillStyle(0xc9a227, 1);
      fill.fillRect(x, y, Math.round(barWidth * value), barHeight);
    };
    draw(0);

    this.time.addEvent({
      delay: 16,
      repeat: 20,
      callback: () => {
        progress = Math.min(1, progress + 0.05);
        draw(progress);
        if (progress >= 1) {
          label.setText('Готово');
          this.time.delayedCall(150, () => this.scene.start('MainMenuScene'));
        }
      },
    });
  }

  private generatePlaceholderTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // 16x24 heroine placeholder: dark red body.
    g.clear();
    g.fillStyle(0x6b1424, 1);
    g.fillRect(0, 0, 16, 24);
    g.generateTexture('heroine', 16, 24);

    // 16x16 deck tile placeholder: brown plank tile.
    g.clear();
    g.fillStyle(0x6e4a2a, 1);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle(0x513519, 1);
    g.fillRect(0, 7, 16, 2);
    g.generateTexture('tile-deck', 16, 16);

    g.destroy();
  }
}
