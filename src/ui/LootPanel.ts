import Phaser from 'phaser';

export interface LootRow {
  title: string;
  /** Короткая пометка серым под названием. */
  note?: string;
  /** Выделить цветом золота. */
  gold?: boolean;
}

/** Модальная панель добычи по центру. Закрывается тапом по экрану (отпусканием, начатым при открытой панели). */
export class LootPanel {
  private readonly objs: Phaser.GameObjects.GameObject[] = [];
  private open = false;
  private downId = -1;
  private resolveFn?: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
  ) {}

  get isOpen(): boolean {
    return this.open;
  }

  /** Список показанных строк (для отладочного снимка). */
  rows: string[] = [];

  show(heading: string, rows: LootRow[]): Promise<void> {
    if (this.open) this.close();
    const { width, height } = this.scene.scale;
    const w = width - 40;
    const rowH = 34;
    const h = 56 + rows.length * rowH + 44;
    const x = 20;
    const y = Math.round(height / 2 - h / 2);
    this.rows = rows.map((r) => r.title);

    const dim = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.55).setScrollFactor(0).setDepth(2500);
    const g = this.scene.add.graphics().setScrollFactor(0).setDepth(2501);
    g.fillStyle(0x10162a, 0.97);
    g.fillRoundedRect(x, y, w, h, 8);
    g.lineStyle(2, 0xc9a227, 1);
    g.strokeRoundedRect(x, y, w, h, 8);
    const title = this.scene.add
      .text(width / 2, y + 16, heading, { fontFamily: 'monospace', fontSize: '17px', fontStyle: 'bold', color: '#e6c35c' })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(2502);
    this.objs.push(dim, g, title);
    rows.forEach((r, i) => {
      const ry = y + 52 + i * rowH;
      const dot = this.scene.add.rectangle(x + 20, ry + 9, 6, 6, r.gold ? 0xffe08a : 0x9fb0cf).setScrollFactor(0).setDepth(2502);
      const t = this.scene.add
        .text(x + 34, ry, r.title, {
          fontFamily: 'monospace',
          fontSize: '15px',
          fontStyle: r.gold ? 'bold' : 'normal',
          color: r.gold ? '#ffe08a' : '#f1ead2',
        })
        .setScrollFactor(0)
        .setDepth(2502);
      this.objs.push(dot, t);
      if (r.note) {
        const n = this.scene.add
          .text(x + 34, ry + 17, r.note, { fontFamily: 'monospace', fontSize: '10px', color: '#8a94ad' })
          .setScrollFactor(0)
          .setDepth(2502);
        this.objs.push(n);
      }
    });
    const hint = this.scene.add
      .text(width / 2, y + h - 22, 'Забрать — коснись экрана', { fontFamily: 'monospace', fontSize: '12px', color: '#f4e7b5' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2502);
    this.scene.tweens.add({ targets: hint, alpha: 0.5, duration: 600, yoyo: true, repeat: -1 });
    this.objs.push(hint);
    this.layer.add(this.objs);

    this.open = true;
    this.downId = -1;
    const promise = new Promise<void>((resolve) => {
      this.resolveFn = resolve;
    });
    this.scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    return promise;
  }

  destroy(): void {
    this.close();
  }

  private readonly onDown = (p: Phaser.Input.Pointer): void => {
    if (this.downId === -1) this.downId = p.id;
  };

  private readonly onUp = (p: Phaser.Input.Pointer): void => {
    if (p.id !== this.downId) return;
    this.downId = -1;
    this.close();
  };

  private close(): void {
    if (this.open) {
      this.open = false;
      this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
      this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
      this.scene.tweens.killTweensOf(this.objs);
      for (const o of this.objs) o.destroy();
      this.objs.length = 0;
    }
    const done = this.resolveFn;
    this.resolveFn = undefined;
    done?.();
  }
}
