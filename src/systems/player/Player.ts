import Phaser from 'phaser';
import type { FrameRef } from '../../data/tiles';
import type { Vec2 } from '../input/vector';
import { BOB_RATE, bobPose } from './walkBob';

export const PLAYER_SPEED = 70; // логических px/с
const BODY_W = 10;
const BODY_H = 8;

/**
 * Игрок: физическое тело (невидимая зона у ног) + отдельный спрайт, который «подпрыгивает».
 * Спрайт отделён от тела, чтобы эффект ходьбы не сдвигал коллизии.
 */
export class Player {
  readonly body: Phaser.GameObjects.Zone;
  readonly view: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Ellipse;
  private phase = 0;
  private moving = false;

  constructor(scene: Phaser.Scene, x: number, y: number, frame: FrameRef) {
    this.body = scene.add.zone(x, y, BODY_W, BODY_H);
    scene.physics.add.existing(this.body);
    const arcade = this.arcadeBody;
    arcade.setCollideWorldBounds(true);

    this.shadow = scene.add.ellipse(x, y, 11, 4, 0x000000, 0.35);
    this.view = scene.add.image(x, y + 3, frame.texture, frame.frame).setOrigin(0.5, 1);
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body.body as Phaser.Physics.Arcade.Body;
  }

  /** Положение ног — по нему считается дальность взаимодействия. */
  get x(): number {
    return this.body.x;
  }
  get y(): number {
    return this.body.y;
  }

  /** Задаёт скорость по вектору ввода [-1..1] (вызывать до шага физики). */
  setMove(move: Vec2): void {
    const arcade = this.arcadeBody;
    const len = Math.hypot(move.x, move.y);
    this.moving = len > 0.01;
    if (!this.moving) {
      arcade.setVelocity(0, 0);
      return;
    }
    const k = Math.min(1, len) / len;
    arcade.setVelocity(move.x * k * PLAYER_SPEED, move.y * k * PLAYER_SPEED);
    if (Math.abs(move.x) > 0.01) this.view.setFlipX(move.x < 0);
  }

  stop(): void {
    this.setMove({ x: 0, y: 0 });
  }

  /** Обновляет визуал (вызывать каждый кадр). */
  update(deltaMs: number): void {
    const arcade = this.arcadeBody;
    // Фактическая скорость: у стены спрайт не «бежит на месте».
    const speed = Math.hypot(arcade.velocity.x, arcade.velocity.y);
    const strength = this.moving ? Math.min(1, speed / PLAYER_SPEED) : 0;
    if (strength > 0.05) this.phase += (deltaMs / 1000) * BOB_RATE;
    else this.phase = 0;

    const pose = bobPose(this.phase, strength > 0.05 ? strength : 0);
    this.view.setPosition(this.body.x, this.body.y + 3 + pose.offsetY);
    this.view.setScale(pose.scaleX, pose.scaleY);
    this.shadow.setPosition(this.body.x, this.body.y + 1);
    this.view.setDepth(this.body.y);
    this.shadow.setDepth(this.body.y - 1);
  }
}
