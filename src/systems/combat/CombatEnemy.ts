// Враг на сцене: физическое тело у ног, спрайт, тень, полоска здоровья, индикатор замаха.

import Phaser from 'phaser';
import type { EnemyDef } from '../../data/enemies';
import { PathFollower } from '../navigation/follower';
import { EnemyBrain } from './fighter';

const BODY_W = 10;
const BODY_H = 8;

export class CombatEnemy {
  readonly body: Phaser.GameObjects.Zone;
  readonly view: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Ellipse;
  readonly brain: EnemyBrain;
  /** Единичный вектор взгляда (на героиню). */
  facing = { x: 0, y: 1 };
  knock = { x: 0, y: 0 };
  knockT = 0;
  readonly follower = new PathFollower();
  repathT = 0;
  /** Идёт к заданной точке (вход в комнату), ИИ выключен. */
  entering = false;
  /** Удержан сценарием (обучением): не действует. */
  held = false;
  /** Время (по часам боя), когда начался текущий замах. */
  windupStartAt = 0;
  readonly colliders: Phaser.Physics.Arcade.Collider[] = [];
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly tele: Phaser.GameObjects.Graphics;
  private readonly bang: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    layer: Phaser.GameObjects.Layer,
    readonly def: EnemyDef,
    x: number,
    y: number,
    rng?: () => number,
  ) {
    this.brain = new EnemyBrain(def, rng);
    this.body = scene.add.zone(x, y, BODY_W, BODY_H);
    scene.physics.add.existing(this.body);
    const ab = this.arcade;
    ab.setCollideWorldBounds(true);
    ab.setImmovable(true);

    this.shadow = scene.add.ellipse(x, y, 11, 4, 0x000000, 0.35);
    this.view = scene.add.image(x, y + 3, def.sprite.texture, def.sprite.frame).setOrigin(0.5, 1);
    this.tele = scene.add.graphics();
    this.bar = scene.add.graphics();
    this.bang = scene.add
      .text(x, y - 20, '!', {
        fontFamily: 'monospace',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ff3b30',
        stroke: '#ffffff',
        strokeThickness: 2,
        resolution: 3,
      })
      .setOrigin(0.5, 1)
      .setVisible(false);
    layer.add([this.shadow, this.tele, this.view, this.bar, this.bang]);
  }

  get arcade(): Phaser.Physics.Arcade.Body {
    return this.body.body as Phaser.Physics.Arcade.Body;
  }
  get x(): number {
    return this.body.x;
  }
  get y(): number {
    return this.body.y;
  }
  get alive(): boolean {
    return this.brain.alive;
  }
  get id(): EnemyDef['id'] {
    return this.def.id;
  }

  setHeld(held: boolean): void {
    this.held = held;
    this.syncEnabled();
  }

  syncEnabled(): void {
    this.brain.enabled = !this.held && !this.entering;
  }

  /** Обновляет спрайт, полоску и индикатор замаха по текущему состоянию. */
  syncVisual(timeMs: number, heroX: number, heroY: number): void {
    if (!this.brain.alive) return;
    const { x, y } = this.body;
    this.shadow.setPosition(x, y + 1).setDepth(y - 1);
    this.view.setPosition(x, y + 3).setDepth(y);
    if (this.facing.x !== 0 && this.brain.alive) this.view.setFlipX(this.facing.x < 0);
    this.tele.setDepth(y - 0.8).clear();
    this.bar.setDepth(y + 500).clear();
    this.bang.setVisible(false);

    const b = this.brain;
    if (b.state === 'windup') {
      const pulse = 0.5 + 0.5 * Math.sin(timeMs / 45);
      const a = b.attack!;
      this.view.setTint(pulse > 0.5 ? 0xff6a6a : 0xffc0c0);
      const p = b.windupProgress;
      // Опасная зона: заливка растёт по мере замаха.
      const r = a.reach;
      this.tele.fillStyle(0xff2a2a, 0.12 + 0.28 * p);
      this.tele.fillCircle(x, y, r);
      this.tele.lineStyle(1, 0xff3030, 0.9);
      this.tele.strokeCircle(x, y, r);
      if (a.kind === 'lunge') {
        const len = (a.advanceSpeed * a.active) + a.reach;
        const dx = heroX - x;
        const dy = heroY - y;
        const d = Math.hypot(dx, dy) || 1;
        this.tele.lineStyle(6, 0xff2a2a, 0.25 + 0.3 * p);
        this.tele.lineBetween(x, y, x + (dx / d) * len, y + (dy / d) * len);
      }
      // Красный контур вокруг спрайта.
      this.tele.lineStyle(1, 0xff3030, 1);
      this.tele.strokeRect(x - 8.5, y - 13.5, 17, 17);
      this.bang
        .setVisible(true)
        .setPosition(x, y - 17 - (a.kind === 'heavy' ? 2 : 0))
        .setScale(a.kind === 'heavy' ? 1.5 : 1.1 + 0.15 * pulse)
        .setDepth(y + 600);
    } else if (b.alive && b.state !== 'strike') {
      this.view.clearTint();
    }

    if (b.alive) {
      const w = 16;
      const hpFrac = b.hp / b.def.maxHp;
      this.bar.fillStyle(0x000000, 0.8);
      this.bar.fillRect(x - w / 2 - 1, y - 21, w + 2, 4);
      this.bar.fillStyle(0xd23b3b, 1);
      this.bar.fillRect(x - w / 2, y - 20, Math.max(0, w * hpFrac), 2);
    }
  }

  /** Вырублен/убит: тело ложится, столкновения отключаются. */
  setDown(): void {
    this.arcade.setVelocity(0, 0);
    this.arcade.enable = false;
    this.bang.setVisible(false);
    this.tele.clear();
    this.bar.clear();
    this.view.setTint(this.def.fatal ? 0x555566 : 0x8a8a99).setAngle(90).setAlpha(0.95);
    this.view.y += 2;
    this.view.setDepth(-500);
    this.shadow.setDepth(-501);
    this.scene.tweens.killTweensOf(this.view);
  }

  destroy(): void {
    for (const c of this.colliders) c.destroy();
    this.colliders.length = 0;
    this.body.destroy();
    this.view.destroy();
    this.shadow.destroy();
    this.bar.destroy();
    this.tele.destroy();
    this.bang.destroy();
  }
}
