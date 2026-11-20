import Phaser from 'phaser';
import { SHEET_FILES } from '../data/tiles';
import { generateShipTextures } from '../systems/fx/shipTextures';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload(): void {
    const { width, height } = this.scale;
    const barWidth = Math.round(width * 0.66);
    const barHeight = 12;
    const x = (width - barWidth) / 2;
    const y = Math.round(height * 0.55);

    const frame = this.add.graphics();
    frame.lineStyle(2, 0x3a4560, 1);
    frame.strokeRect(x - 2, y - 2, barWidth + 4, barHeight + 4);

    const fill = this.add.graphics();
    this.add
      .text(width / 2, y - 16, 'Загрузка…', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#8a94ad',
      })
      .setOrigin(0.5, 1);

    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      fill.clear();
      fill.fillStyle(0xc9a227, 1);
      fill.fillRect(x, y, Math.round(barWidth * value), barHeight);
    });

    for (const s of SHEET_FILES) {
      this.load.spritesheet(s.key, s.path, {
        frameWidth: s.frameWidth,
        frameHeight: s.frameHeight,
        margin: s.margin ?? 0,
        spacing: s.spacing ?? 0,
      });
    }
  }

  create(): void {
    // Тайлы корабля, которых нет в паках, рисуются кодом (см. ASSETS.md «Пробелы»).
    generateShipTextures(this);
    this.scene.start('MainMenuScene');
  }
}
