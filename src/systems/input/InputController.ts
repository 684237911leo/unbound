import Phaser from 'phaser';
import { type Vec2, keyboardVector } from './vector';

/** Клавиатурный ввод для отладки на ПК: WASD/стрелки — движение, E/Space — действие. Сенсорное управление — по тапу (DeckScene). */
export class InputController {
  private readonly keys: {
    left: Phaser.Input.Keyboard.Key[];
    right: Phaser.Input.Keyboard.Key[];
    up: Phaser.Input.Keyboard.Key[];
    down: Phaser.Input.Keyboard.Key[];
    action: Phaser.Input.Keyboard.Key[];
  };

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    const K = Phaser.Input.Keyboard.KeyCodes;
    const mk = (codes: number[]): Phaser.Input.Keyboard.Key[] =>
      kb ? codes.map((c) => kb.addKey(c, true)) : [];
    this.keys = {
      left: mk([K.LEFT, K.A]),
      right: mk([K.RIGHT, K.D]),
      up: mk([K.UP, K.W]),
      down: mk([K.DOWN, K.S]),
      action: mk([K.E, K.SPACE]),
    };
  }

  /** Вектор движения по клавишам (нулевой, если ничего не нажато). */
  get move(): Vec2 {
    const any = (ks: Phaser.Input.Keyboard.Key[]): boolean => ks.some((k) => k.isDown);
    return keyboardVector(any(this.keys.left), any(this.keys.right), any(this.keys.up), any(this.keys.down));
  }

  /** true один раз за нажатие E/Space. */
  consumeAction(): boolean {
    let pressed = false;
    for (const k of this.keys.action) if (Phaser.Input.Keyboard.JustDown(k)) pressed = true;
    return pressed;
  }

  destroy(): void {
    for (const list of Object.values(this.keys)) for (const k of list) k.destroy();
  }
}
