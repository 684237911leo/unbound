import Phaser from 'phaser';
import { GAME_WIDTH, computeGameHeight } from './screen';

export { GAME_WIDTH, GAME_MIN_HEIGHT, GAME_MAX_HEIGHT, computeGameHeight } from './screen';

/** Высота считается один раз при старте. Сцены читают реальный размер из `this.scale`. */
export function createGameConfig(
  scenes: Phaser.Types.Scenes.SceneType[],
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: computeGameHeight(window.innerWidth, window.innerHeight),
    parent: 'game',
    backgroundColor: '#0b0f1a',
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    input: {
      activePointers: 3,
    },
    // Нужен для поля ввода имени героини (нативная клавиатура Android, кириллица).
    dom: {
      createContainer: true,
    },
    scene: scenes,
  };
}
