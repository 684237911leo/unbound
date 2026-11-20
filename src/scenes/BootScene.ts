import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    // Отладочный вход: ?scene=combat открывает боевую арену, обычный поток не меняется.
    const target = new URLSearchParams(window.location.search).get('scene') === 'combat' ? 'CombatSandboxScene' : undefined;
    this.scene.start('PreloadScene', { next: target });
  }
}
