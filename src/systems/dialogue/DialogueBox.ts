import Phaser from 'phaser';
import type { Dialogue } from './types';
import { type ResolvedLine, nextReveal, resolveLine } from './text';

const MARGIN = 12;
const PAD = 12;
const BOTTOM_GAP = 20;
const PLATE_PAD_X = 8;
const PLATE_H = 18;
const CURSOR_PERIOD_MS = 900;

const BG_COLOR = 0x10162a;
const BG_ALPHA = 0.94;
const BORDER_COLOR = 0xc9a227;
const TEXT_COLOR = '#f1ead2';
const NARRATOR_COLOR = '#8a94ad';
const HERO_NAME_COLOR = '#e6c35c';
const OTHER_NAME_COLOR = '#9fb0cf';
const OTHER_BORDER_COLOR = 0x6d7896;

/**
 * Окно диалога внизу экрана в стиле MessageBox.
 * Тап (отпускание пальца после касания, начатого при открытом окне):
 * если строка печатается — показать её целиком; иначе — следующая реплика; после последней — закрыть.
 * Пока окно открыто, сцена должна не обрабатывать касания (проверять `isOpen`), как с MessageBox.
 */
export class DialogueBox {
  private readonly scene: Phaser.Scene;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly plateBg: Phaser.GameObjects.Graphics;
  private readonly plateText: Phaser.GameObjects.Text;
  private readonly text: Phaser.GameObjects.Text;
  private readonly cursor: Phaser.GameObjects.Text;
  private readonly visuals: Phaser.GameObjects.Components.Visible[];
  private readonly textWidth: number;
  /** Левый верхний угол окна (заполняется в layout). */
  private boxX = 0;
  private boxY = 0;

  private lines: ResolvedLine[] = [];
  private index = 0;
  private revealed = 0;
  private open = false;
  private elapsed = 0;
  /** id указателя, чьё касание началось при открытом окне; -1 — нет. */
  private downId = -1;
  private resolveFn?: () => void;

  constructor(scene: Phaser.Scene, uiLayer: Phaser.GameObjects.Layer, depth = 3000) {
    this.scene = scene;
    const w = scene.scale.width - MARGIN * 2;
    this.textWidth = w - PAD * 2;
    this.bg = scene.add.graphics().setScrollFactor(0).setDepth(depth).setVisible(false);
    this.plateBg = scene.add.graphics().setScrollFactor(0).setDepth(depth + 2).setVisible(false);
    this.plateText = scene.add
      .text(0, 0, '', { fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color: OTHER_NAME_COLOR })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(depth + 3)
      .setVisible(false);
    this.text = scene.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: TEXT_COLOR,
        lineSpacing: 4,
        wordWrap: { width: this.textWidth, useAdvancedWrap: true },
      })
      .setScrollFactor(0)
      .setDepth(depth + 1)
      .setVisible(false);
    this.cursor = scene.add
      .text(0, 0, '▼', { fontFamily: 'monospace', fontSize: '10px', color: '#c9a227' })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(depth + 1)
      .setVisible(false);
    this.visuals = [this.bg, this.plateBg, this.plateText, this.text, this.cursor];
    uiLayer.add([this.bg, this.plateBg, this.plateText, this.text, this.cursor]);
  }

  get isOpen(): boolean {
    return this.open;
  }

  /**
   * Показывает диалог. Промис выполняется, когда отпущена последняя реплика.
   * Если окно уже открыто, прежний диалог закрывается (его промис тоже выполняется).
   */
  play(dialogue: Dialogue, heroName: string): Promise<void> {
    if (this.open) this.close();
    this.lines = dialogue.lines.map((l) => resolveLine(l, heroName));
    if (this.lines.length === 0) return Promise.resolve();

    const promise = new Promise<void>((resolve) => {
      this.resolveFn = resolve;
    });
    this.open = true;
    this.index = 0;
    this.downId = -1;
    this.layout();
    this.startLine();
    this.bg.setVisible(true);
    this.text.setVisible(true);
    this.scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.scene.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    return promise;
  }

  /** Убирает окно без вызова промиса (для уничтожения сцены). Промис при этом выполняется. */
  destroy(): void {
    this.close();
    this.bg.destroy();
    this.plateBg.destroy();
    this.plateText.destroy();
    this.text.destroy();
    this.cursor.destroy();
  }

  private currentLine(): ResolvedLine {
    return this.lines[this.index];
  }

  private isTyping(): boolean {
    return this.revealed < this.currentLine().text.length;
  }

  /** Размер окна по самой длинной реплике диалога, чтобы окно не прыгало между строками. */
  private layout(): void {
    const { width, height } = this.scene.scale;
    let maxH = 0;
    for (const line of this.lines) {
      this.applyStyle(line);
      this.text.setText(line.text);
      maxH = Math.max(maxH, this.text.height);
    }
    const w = width - MARGIN * 2;
    const h = maxH + PAD * 2 + 14;
    const x = MARGIN;
    const y = height - BOTTOM_GAP - h;
    this.boxX = x;
    this.boxY = y;

    this.bg.clear();
    this.bg.fillStyle(BG_COLOR, BG_ALPHA);
    this.bg.fillRoundedRect(x, y, w, h, 6);
    this.bg.lineStyle(2, BORDER_COLOR, 0.9);
    this.bg.strokeRoundedRect(x, y, w, h, 6);

    this.text.setPosition(x + PAD, y + PAD);
    this.cursor.setPosition(x + w - PAD, y + h - 5);
  }

  private applyStyle(line: ResolvedLine): void {
    const narrator = line.speaker === 'narrator';
    this.text.setStyle({
      color: narrator ? NARRATOR_COLOR : TEXT_COLOR,
      fontStyle: narrator ? 'italic' : 'normal',
    });
  }

  /** Плашка с именем: над верхней границей окна, слева. */
  private layoutPlate(px: number, boxY: number): void {
    const line = this.currentLine();
    const plateTop = boxY - PLATE_H / 2;
    this.plateBg.clear();
    if (line.label === null) {
      this.plateBg.setVisible(false);
      this.plateText.setVisible(false);
      return;
    }
    const isHero = line.speaker === 'heroine';
    this.plateText.setText(line.label).setColor(isHero ? HERO_NAME_COLOR : OTHER_NAME_COLOR);
    const plateW = this.plateText.width + PLATE_PAD_X * 2;
    const borderColor = isHero ? BORDER_COLOR : OTHER_BORDER_COLOR;
    this.plateBg.fillStyle(BG_COLOR, 1);
    this.plateBg.fillRoundedRect(px, plateTop, plateW, PLATE_H, 4);
    this.plateBg.lineStyle(2, borderColor, 0.95);
    this.plateBg.strokeRoundedRect(px, plateTop, plateW, PLATE_H, 4);
    this.plateText.setPosition(px + PLATE_PAD_X, plateTop + PLATE_H / 2);
    this.plateBg.setVisible(true);
    this.plateText.setVisible(true);
  }

  /** Начинает печать текущей реплики с нуля. */
  private startLine(): void {
    this.applyStyle(this.currentLine());
    this.revealed = 0;
    this.text.setText('');
    this.cursor.setVisible(false);
    this.layoutPlate(this.boxX + PAD, this.boxY);
  }

  private showReveal(): void {
    const full = this.currentLine().text;
    this.text.setText(full.slice(0, Math.floor(this.revealed)));
  }

  private readonly onUpdate = (_time: number, delta: number): void => {
    if (!this.open) return;
    this.elapsed += delta;
    const total = this.currentLine().text.length;
    if (this.revealed < total) {
      this.revealed = nextReveal(this.revealed, delta, total);
      this.showReveal();
    }
    const blinkOn = this.elapsed % CURSOR_PERIOD_MS < CURSOR_PERIOD_MS / 2;
    this.cursor.setVisible(!this.isTyping() && blinkOn);
  };

  private readonly onPointerDown = (p: Phaser.Input.Pointer): void => {
    if (this.downId === -1) this.downId = p.id;
  };

  private readonly onPointerUp = (p: Phaser.Input.Pointer): void => {
    if (p.id !== this.downId) return;
    this.downId = -1;
    this.advance();
  };

  private advance(): void {
    if (!this.open) return;
    if (this.isTyping()) {
      this.revealed = this.currentLine().text.length;
      this.showReveal();
      return;
    }
    if (this.index + 1 < this.lines.length) {
      this.index += 1;
      this.startLine();
      return;
    }
    this.close();
  }

  private close(): void {
    const done = this.resolveFn;
    this.resolveFn = undefined;
    if (this.open) {
      this.open = false;
      this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
      this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
      this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
      for (const v of this.visuals) v.setVisible(false);
      this.downId = -1;
    }
    done?.();
  }
}
