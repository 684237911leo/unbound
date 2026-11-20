import Phaser from 'phaser';

const GOLD = 0xc9a227;

/** Большая кнопка (тёмная плашка, золотая рамка). Центр в (x, y); hit-область совпадает с рамкой. */
export class MenuButton {
  readonly container: Phaser.GameObjects.Container;
  private readonly hit: Phaser.Geom.Rectangle;
  private readonly text: Phaser.GameObjects.Text;
  private enabled = true;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly w: number,
    private readonly h: number,
    label: string,
    onTap: () => void,
    fontSize = 22,
  ) {
    const bg = scene.add.graphics();
    bg.fillStyle(0x1d2538, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    bg.lineStyle(2, GOLD, 0.8);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
    this.text = scene.add
      .text(0, 0, label, { fontFamily: 'monospace', fontSize: `${fontSize}px`, color: '#e8d9a8' })
      .setOrigin(0.5);
    this.container = scene.add.container(x, y, [bg, this.text]);
    this.hit = new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h);
    this.container.setSize(w, h);
    this.container.on(Phaser.Input.Events.POINTER_OVER, () => this.enabled && this.text.setColor('#ffffff'));
    this.container.on(Phaser.Input.Events.POINTER_OUT, () => this.text.setColor('#e8d9a8'));
    this.container.on(Phaser.Input.Events.POINTER_UP, () => {
      if (this.enabled) onTap();
    });
    this.syncInput(true);
  }

  setVisible(on: boolean): this {
    this.container.setVisible(on);
    this.syncInput(on);
    return this;
  }

  setEnabled(on: boolean): this {
    this.enabled = on;
    this.container.setAlpha(on ? 1 : 0.4);
    this.syncInput(this.container.visible);
    return this;
  }

  private syncInput(on: boolean): void {
    if (on) this.container.setInteractive(this.hit, Phaser.Geom.Rectangle.Contains);
    else this.container.disableInteractive();
  }
}
