import Phaser from 'phaser';
import { autosave, newGame } from '../core/session';
import { RainEffect } from '../ui/RainEffect';

const MARGIN = 12;
const PAD = 12;
const BOTTOM_GAP = 20;
const WIN_H = 150;
const PROMPT_H = 26;
const INPUT_H = 40;
const ROW_GAP = 8;
const MAX_LEN = 16;
/** Буквы любого алфавита, пробел и дефис; первый символ — буква. */
const NAME_RE = /^\p{L}[\p{L} -]*$/u;
const HINT_BAD = 'Только буквы, пробел и дефис.';

/**
 * Первый экран новой игры: окно с вопросом и полем ввода имени героини.
 * Поле, подсказка и кнопка «Это я» — HTML-оверлей (Phaser DOM): нативная клавиатура и кириллица.
 * Кнопка в DOM, а не в канвасе: касание по полю не доходит до Phaser, и его указатель отстаёт.
 */
export class NameEntryScene extends Phaser.Scene {
  private alive = false;
  private busy = false;
  private rain?: RainEffect;
  private win!: Phaser.GameObjects.Graphics;
  private prompt!: Phaser.GameObjects.Text;
  private form!: Phaser.GameObjects.DOMElement;
  private nameInput!: HTMLInputElement;
  private hintEl!: HTMLDivElement;
  private okEl!: HTMLButtonElement;
  /** Верхний край окна; меняется анимацией при вводе. */
  private winTop = 0;
  private bottomTop = 0;
  private typingTop = 0;
  private blurTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('NameEntryScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b0f1a');
    this.alive = true;
    this.busy = false;
    this.rain = new RainEffect(this, { count: 40 });

    const W = this.scale.width;
    const H = this.scale.height;
    this.bottomTop = H - BOTTOM_GAP - WIN_H;
    // Пока клавиатура открыта, окно поднимается в верхнюю-среднюю часть экрана.
    this.typingTop = Math.round(H * 0.22);
    this.winTop = this.bottomTop;

    this.win = this.add.graphics().setDepth(3000);
    this.prompt = this.add
      .text(MARGIN + PAD, 0, 'Как тебя зовут?', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#f1ead2',
      })
      .setDepth(3001);

    this.buildForm(W);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.layout();
  }

  update(_time: number, delta: number): void {
    this.rain?.update(delta);
  }

  private buildForm(W: number): void {
    const wrap = document.createElement('div');
    wrap.style.cssText = `width:${W - (MARGIN + PAD) * 2}px;font-family:monospace;`;

    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.maxLength = MAX_LEN;
    this.nameInput.placeholder = 'Имя';
    this.nameInput.autocomplete = 'off';
    this.nameInput.autocapitalize = 'words';
    this.nameInput.spellcheck = false;
    this.nameInput.setAttribute('enterkeyhint', 'done');
    // Шрифт 16px+ не даёт мобильным браузерам увеличивать страницу при фокусе.
    this.nameInput.style.cssText = [
      'display:block',
      'width:100%',
      `height:${INPUT_H}px`,
      'box-sizing:border-box',
      'padding:0 10px',
      'font:18px monospace',
      'color:#f1ead2',
      'background:#0b0f1a',
      'border:2px solid #c9a227',
      'border-radius:4px',
      'outline:none',
      'margin:0',
    ].join(';');

    const row = document.createElement('div');
    row.style.cssText = `display:flex;align-items:center;justify-content:space-between;margin-top:${ROW_GAP}px;height:${INPUT_H}px;`;
    this.hintEl = document.createElement('div');
    this.hintEl.style.cssText = 'font:11px monospace;color:#d98b6b;flex:1;padding-right:8px;';

    this.okEl = document.createElement('button');
    this.okEl.type = 'button';
    this.okEl.textContent = 'Это я';
    this.okEl.disabled = true;
    this.okEl.style.cssText = [
      `height:${INPUT_H}px`,
      'min-width:120px',
      'padding:0 16px',
      'font:18px monospace',
      'color:#e8d9a8',
      'background:#1d2538',
      'border:2px solid #c9a227',
      'border-radius:4px',
      'outline:none',
      'margin:0',
      'opacity:0.4',
    ].join(';');

    row.append(this.hintEl, this.okEl);
    wrap.append(this.nameInput, row);
    this.form = this.add.dom(W / 2, 0, wrap).setDepth(3002);

    this.nameInput.addEventListener('input', this.onInput);
    this.nameInput.addEventListener('keydown', this.onKeyDown);
    this.nameInput.addEventListener('focus', this.onFocus);
    this.nameInput.addEventListener('blur', this.onBlur);
    this.okEl.addEventListener('click', this.onOk);
  }

  /** Расставляет элементы окна по winTop. */
  private layout(): void {
    const W = this.scale.width;
    const top = this.winTop;
    this.win.clear();
    this.win.fillStyle(0x10162a, 0.94);
    this.win.fillRoundedRect(MARGIN, top, W - MARGIN * 2, WIN_H, 6);
    this.win.lineStyle(2, 0xc9a227, 0.9);
    this.win.strokeRoundedRect(MARGIN, top, W - MARGIN * 2, WIN_H, 6);
    this.prompt.setY(top + PAD);
    const formH = INPUT_H + ROW_GAP + INPUT_H;
    this.form.setPosition(W / 2, top + PAD + PROMPT_H + formH / 2);
  }

  private moveWindow(target: number): void {
    if (this.winTop === target) return;
    this.tweens.killTweensOf(this);
    this.tweens.add({
      targets: this,
      winTop: target,
      duration: 200,
      ease: 'Quad.easeOut',
      onUpdate: () => this.layout(),
    });
  }

  private static isValid(raw: string): boolean {
    const name = raw.trim();
    return name.length > 0 && name.length <= MAX_LEN && NAME_RE.test(name);
  }

  private readonly onInput = (): void => {
    const raw = this.nameInput.value;
    this.okEl.disabled = !NameEntryScene.isValid(raw);
    this.okEl.style.opacity = this.okEl.disabled ? '0.4' : '1';
    const bad = raw.trim().length > 0 && !NAME_RE.test(raw.trim());
    this.hintEl.textContent = bad ? HINT_BAD : '';
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.confirmName();
    }
  };

  private readonly onOk = (): void => {
    this.confirmName();
  };

  private readonly onFocus = (): void => {
    this.blurTimer?.remove(false);
    this.blurTimer = undefined;
    this.moveWindow(this.typingTop);
  };

  private readonly onBlur = (): void => {
    // Задержка: тап по кнопке «Это я» тоже снимает фокус, окно не должно уехать из-под пальца до click.
    this.blurTimer?.remove(false);
    this.blurTimer = this.time.delayedCall(300, () => {
      this.blurTimer = undefined;
      if (this.alive) this.moveWindow(this.bottomTop);
    });
  };

  private confirmName(): void {
    if (this.busy) return;
    const raw = this.nameInput.value;
    if (!NameEntryScene.isValid(raw)) return;
    this.busy = true;
    this.nameInput.disabled = true;
    this.okEl.disabled = true;
    newGame(raw.trim());
    void autosave().then(() => {
      if (this.alive) this.scene.start('DeckScene');
    });
  }

  private onShutdown(): void {
    this.alive = false;
    this.blurTimer?.remove(false);
    this.nameInput.removeEventListener('input', this.onInput);
    this.nameInput.removeEventListener('keydown', this.onKeyDown);
    this.nameInput.removeEventListener('focus', this.onFocus);
    this.nameInput.removeEventListener('blur', this.onBlur);
    this.okEl.removeEventListener('click', this.onOk);
    this.tweens.killTweensOf(this);
    this.form.destroy();
  }
}
