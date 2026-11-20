import Phaser from 'phaser';
import { continueGame, hasSave } from '../core/session';
import { MenuButton } from '../ui/MenuButton';
import { RainEffect } from '../ui/RainEffect';

const VERSION_TEXT = `v${__APP_VERSION__} (${__APP_VERSION_CODE__})`;
const BTN_H = 56;
const BTN_MAX_W = 260;
const BTN_GAP = 16;
const CONFIRM_BTN_W = 120;
const CONFIRM_BTN_H = 48;
const GOLD = 0xc9a227;

export class MainMenuScene extends Phaser.Scene {
  private rain?: RainEffect;
  private alive = false;
  private busy = false;
  private continueBtn!: MenuButton;
  private newBtn!: MenuButton;
  private confirmYes!: MenuButton;
  private confirmNo!: MenuButton;
  private confirm!: Phaser.GameObjects.Container;
  private confirmDim!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('MainMenuScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b0f1a');
    this.alive = true;
    this.busy = false;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.alive = false;
    });

    const W = this.scale.width;
    const H = this.scale.height;
    this.rain = new RainEffect(this);

    // Портрет: заголовок в верхней трети, кнопки ниже центра — досягаемы большим пальцем.
    this.add
      .text(W / 2, H * 0.22, 'UNBOUND', {
        fontFamily: 'monospace',
        fontSize: '48px',
        fontStyle: 'bold',
        color: '#e8d9a8',
        stroke: '#2a1a0c',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, H * 0.22 + 44, 'Последний приказ', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#8a94ad',
      })
      .setOrigin(0.5);

    const bw = Math.min(BTN_MAX_W, W - 32);
    const newY = H * 0.63;
    // «Продолжить» стоит над «Новой игрой»: «Новая игра» не сдвигается, когда сохранение найдено.
    const contY = newY - (BTN_H + BTN_GAP);

    this.continueBtn = new MenuButton(this, W / 2, contY, bw, BTN_H, 'Продолжить', () => this.onContinue()).setVisible(false);
    this.newBtn = new MenuButton(this, W / 2, newY, bw, BTN_H, 'Новая игра', () => this.onNewGame());

    this.buildConfirm(W, H);

    this.add
      .text(W - 8, H - 6, VERSION_TEXT, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#4a5570',
      })
      .setOrigin(1, 1);

    // «Продолжить» появляется только когда сохранение подтверждено; до этого её нет.
    void hasSave().then((exists) => {
      if (this.alive && exists) this.continueBtn.setVisible(true);
    });
  }

  update(_time: number, delta: number): void {
    this.rain?.update(delta);
  }

  private buildConfirm(W: number, H: number): void {
    this.confirmDim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6);
    const panelW = Math.min(300, W - 24);
    const panelH = 170;
    const px = W / 2 - panelW / 2;
    const py = H / 2 - panelH / 2;
    const panel = this.add.graphics();
    panel.fillStyle(0x10162a, 0.97);
    panel.fillRoundedRect(px, py, panelW, panelH, 6);
    panel.lineStyle(2, GOLD, 0.9);
    panel.strokeRoundedRect(px, py, panelW, panelH, 6);
    const msg = this.add
      .text(W / 2, H / 2 - 36, 'Начать заново? Сохранение будет потеряно.', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#f1ead2',
        align: 'center',
        wordWrap: { width: panelW - 32, useAdvancedWrap: true },
        lineSpacing: 4,
      })
      .setOrigin(0.5);

    const by = H / 2 + 46;
    const bw = Math.min(CONFIRM_BTN_W, (panelW - 48) / 2);
    this.confirmYes = new MenuButton(this, W / 2 - bw / 2 - 12, by, bw, CONFIRM_BTN_H, 'Да', () => this.onConfirmYes(), 20);
    this.confirmNo = new MenuButton(this, W / 2 + bw / 2 + 12, by, bw, CONFIRM_BTN_H, 'Нет', () => this.onConfirmNo(), 20);

    this.confirm = this.add
      .container(0, 0, [this.confirmDim, panel, msg, this.confirmYes.container, this.confirmNo.container])
      .setDepth(500);
    this.setConfirmVisible(false);
  }

  private setConfirmVisible(on: boolean): void {
    this.confirm.setVisible(on);
    if (on) {
      this.confirmDim.setInteractive();
    } else {
      this.confirmDim.disableInteractive();
    }
    this.confirmYes.setVisible(on);
    this.confirmNo.setVisible(on);
  }

  private onNewGame(): void {
    if (this.busy) return;
    void hasSave().then((exists) => {
      if (!this.alive) return;
      if (exists) this.setConfirmVisible(true);
      else this.scene.start('NameEntryScene');
    });
  }

  private onConfirmYes(): void {
    if (this.busy) return;
    this.busy = true;
    this.setConfirmVisible(false);
    this.scene.start('NameEntryScene');
  }

  private onConfirmNo(): void {
    this.setConfirmVisible(false);
  }

  private onContinue(): void {
    if (this.busy) return;
    this.busy = true;
    void continueGame().then((state) => {
      if (!this.alive) return;
      if (state) {
        this.scene.start('DeckScene');
        return;
      }
      // Сохранение не читается (повреждено). Кнопку прячем; сырые данные SaveSystem уже сохранил в .corrupt.
      this.busy = false;
      this.continueBtn.setVisible(false);
    });
  }
}
