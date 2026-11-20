import Phaser from 'phaser';
import { getState } from '../core/session';
import { fadeInScene, fadeToScene } from '../systems/transition';
import { MenuButton } from '../ui/MenuButton';

/** Конец пролога. Честная заглушка: следующая глава (Солёная Гавань) ещё не готова. */
export class EndCardScene extends Phaser.Scene {
  constructor() {
    super('EndCardScene');
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.cameras.main.setBackgroundColor('#0b0f1a');

    this.add
      .text(W / 2, H * 0.3, 'ПРОЛОГ ЗАВЕРШЁН', {
        fontFamily: 'monospace',
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#e8d9a8',
        stroke: '#2a1a0c',
        strokeThickness: 4,
        align: 'center',
      })
      .setOrigin(0.5);
    this.add
      .text(W / 2, H * 0.3 + 52, 'Солёная Гавань —\nв следующем обновлении', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#9fb4e0',
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5);
    const gold = getState()?.gold ?? 0;
    if (gold > 0) {
      this.add
        .text(W / 2, H * 0.3 + 112, `Золото: ${gold}`, { fontFamily: 'monospace', fontSize: '14px', color: '#ffe08a' })
        .setOrigin(0.5);
    }

    new MenuButton(this, W / 2, H * 0.66, Math.min(280, W - 32), 56, 'В меню', () => fadeToScene(this, 'MainMenuScene'));

    window.__unbound = { game: this.game, scene: 'EndCardScene', snapshot: () => ({ scene: 'EndCardScene', gold }) };
    fadeInScene(this, 700);
  }
}
