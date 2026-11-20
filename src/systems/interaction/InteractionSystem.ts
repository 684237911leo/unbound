import Phaser from 'phaser';
import { type Tappable, findNearest, findTapped } from './nearest';

export interface Interactable extends Tappable {
  id: string;
  /** Короткая подсказка над объектом: «Осмотреть». */
  prompt: string;
  /** Насколько выше (px, логических) центра рисовать подсказку. */
  promptOffsetY?: number;
  onInteract: () => void;
}

export interface InteractionOptions {
  uiLayer: Phaser.GameObjects.Layer;
  /** Мир → экран (координаты UI-камеры). */
  worldToScreen: (x: number, y: number) => { x: number; y: number };
  depth?: number;
}

/** Реестр объектов взаимодействия: каждый кадр выбирает ближайший в радиусе и показывает подсказку. */
export class InteractionSystem {
  private readonly items: Interactable[] = [];
  private readonly label: Phaser.GameObjects.Text;
  private readonly worldToScreen: InteractionOptions['worldToScreen'];
  private _current: Interactable | null = null;

  constructor(scene: Phaser.Scene, options: InteractionOptions) {
    this.worldToScreen = options.worldToScreen;
    this.label = scene.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#f4e7b5',
        backgroundColor: '#1d2538e6',
        padding: { left: 8, right: 8, top: 6, bottom: 6 },
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(options.depth ?? 1900)
      .setVisible(false);
    options.uiLayer.add(this.label);
  }

  register(item: Interactable): void {
    this.items.push(item);
  }

  /** Зарегистрированные объекты (для отладочного снимка). */
  list(): readonly Interactable[] {
    return this.items;
  }

  get current(): Interactable | null {
    return this._current;
  }

  /** Вызывать каждый кадр с положением ног игрока. */
  update(px: number, py: number): Interactable | null {
    this._current = findNearest(this.items, px, py);
    const c = this._current;
    if (!c) {
      this.label.setVisible(false);
    } else {
      if (this.label.text !== c.prompt) this.label.setText(c.prompt);
      const p = this.worldToScreen(c.x, c.y - (c.promptOffsetY ?? 12));
      this.label.setPosition(Math.round(p.x), Math.round(p.y)).setVisible(true);
    }
    return c;
  }

  /** Срабатывает ближайший объект, если он есть. */
  trigger(): boolean {
    if (!this._current) return false;
    this._current.onInteract();
    return true;
  }

  /** Объект под касанием в мировых координатах. */
  findAt(wx: number, wy: number): Interactable | null {
    return findTapped(this.items, wx, wy);
  }

  /** Попал ли экранный тап в видимую подсказку (с запасом под палец). */
  hitLabel(sx: number, sy: number, pad = 8): boolean {
    if (!this.label.visible || !this._current) return false;
    const b = this.label.getBounds();
    return sx >= b.x - pad && sx <= b.right + pad && sy >= b.y - pad && sy <= b.bottom + pad;
  }

  hidePrompt(): void {
    this.label.setVisible(false);
  }
}
