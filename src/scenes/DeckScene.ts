import Phaser from 'phaser';
import {
  DECK_COLS,
  DECK_GROUND,
  DECK_OBJECTS,
  DECK_PLAYER_START,
  DECK_PROPS,
  DECK_ROWS,
  DECK_SAILOR_POS,
  DECK_TILE,
  DECK_WORLD_ZOOM,
  buildDeckNavGrid,
} from '../data/maps/deck';
import { HEROINE, MAST_TEXTURE, SAILOR, TILES, type TileKey } from '../data/tiles';
import { InputController } from '../systems/input/InputController';
import { type Interactable, InteractionSystem } from '../systems/interaction/InteractionSystem';
import { PathFollower } from '../systems/navigation/follower';
import { type NavGrid, type Point, findPath, pointClear } from '../systems/navigation/grid';
import { PLAYER_SPEED, Player } from '../systems/player/Player';
import { autosave, getState, setLocation } from '../core/session';
import { MessageBox } from '../ui/MessageBox';
import { RainEffect } from '../ui/RainEffect';

const T = DECK_TILE;
const DEPTH_WATER = -2000;
const DEPTH_GROUND = -1000;
/** Полуширина тела героини для проверки проходимости пути (чуть меньше полутайла). */
const BODY_RADIUS = 5;
/** Как часто (мс) при перетаскивании пересчитывается маршрут. */
const DRAG_REPATH_MS = 80;
/** Как часто (мс) автосохранять положение героини. */
const AUTOSAVE_MS = 30000;

declare global {
  interface Window {
    __unbound?: {
      game: Phaser.Game;
      playerPos: () => Point;
      worldToScreen: (x: number, y: number) => Point;
      isMessageOpen: () => boolean;
    };
  }
}

/** Палуба пиратского корабля ночью: пролог, сцена 1. Мир в слое камеры с зумом, интерфейс — отдельная камера. */
export class DeckScene extends Phaser.Scene {
  private worldLayer!: Phaser.GameObjects.Layer;
  private uiLayer!: Phaser.GameObjects.Layer;
  private player!: Player;
  private input_!: InputController;
  private interaction!: InteractionSystem;
  private box!: MessageBox;
  private rain!: RainEffect;
  private water: Phaser.GameObjects.Image[] = [];
  private nav!: NavGrid;
  private readonly follower = new PathFollower();
  private marker!: Phaser.GameObjects.Arc;
  private markerTween?: Phaser.Tweens.Tween;
  private pending: Interactable | null = null;
  private dragPointerId = -1;
  private ignoredPointerId = -1;
  private dragTimer = 0;
  private lastDragTarget: Point = { x: -1e9, y: -1e9 };

  constructor() {
    super('DeckScene');
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const worldW = DECK_COLS * T;
    const worldH = DECK_ROWS * T;

    this.cameras.main.setBackgroundColor('#0b0f1a');
    this.physics.world.setBounds(0, 0, worldW, worldH);

    this.worldLayer = this.add.layer();
    this.uiLayer = this.add.layer().setDepth(10);
    this.water = [];

    this.nav = buildDeckNavGrid();
    const walls = this.physics.add.staticGroup();
    this.buildMap(walls);
    this.buildProps();

    const start = this.savedStart() ?? { x: DECK_PLAYER_START.col * T, y: DECK_PLAYER_START.row * T };
    this.player = new Player(this, start.x, start.y, HEROINE);
    this.worldLayer.add([this.player.shadow, this.player.view]);
    this.physics.add.collider(this.player.body, walls);

    this.buildSailor();

    // Камеры: мир с зумом ×2 следует за игроком, интерфейс — вторая камера без зума.
    const cam = this.cameras.main;
    cam.setZoom(DECK_WORLD_ZOOM);
    cam.setBounds(0, 0, worldW, worldH);
    cam.startFollow(this.player.body, true, 0.12, 0.12);
    const uiCam = this.cameras.add(0, 0, W, H, false, 'ui');
    uiCam.ignore(this.worldLayer);
    cam.ignore(this.uiLayer);

    // Ночь: умножаем цвет кадра на тёмно-синий. Дождь и интерфейс рисуются поверх.
    const tint = this.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(100)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    tint.fillStyle(0x5d6c9c, 1);
    tint.fillRect(0, 0, W, H);
    this.uiLayer.add(tint);

    this.rain = new RainEffect(this, { count: 70, color: 0x9fb4e0, alpha: 0.4, depth: 101 });
    this.uiLayer.add(this.rain.graphics);

    this.input_ = new InputController(this);
    this.box = new MessageBox(this, this.uiLayer);
    this.marker = this.add.circle(0, 0, 6).setStrokeStyle(2, 0xf4e7b5, 0.9).setFillStyle(0xf4e7b5, 0.15);
    this.marker.setDepth(5000).setVisible(false);
    this.worldLayer.add(this.marker);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
    this.interaction = new InteractionSystem(this, {
      uiLayer: this.uiLayer,
      worldToScreen: (x, y) => this.worldToScreen(x, y),
    });
    this.registerInteractables();

    // Положение героини сохраняется раз в 30 с, при каждом взаимодействии и при уходе в фон.
    this.time.addEvent({ delay: AUTOSAVE_MS, loop: true, callback: () => this.saveProgress() });
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    // Лёгкое колыхание воды.
    let flip = false;
    this.time.addEvent({
      delay: 700,
      loop: true,
      callback: () => {
        flip = !flip;
        for (const img of this.water) {
          const alt = ((img.x / T + img.y / T) & 1) === 0;
          img.setFrame(alt === flip ? 'water_a' : 'water_b');
        }
      },
    });

    window.__unbound = {
      game: this.game,
      playerPos: () => ({ x: this.player.x, y: this.player.y }),
      worldToScreen: (x, y) => this.worldToScreen(x, y),
      isMessageOpen: () => this.box.isOpen,
    };

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
      this.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
      this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
      this.input_.destroy();
      this.box.destroy();
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      this.water = [];
      this.follower.cancel();
      this.pending = null;
      this.dragPointerId = -1;
      this.ignoredPointerId = -1;
    });
  }

  update(_time: number, delta: number): void {
    this.rain.update(delta);
    const dt = delta / 1000;

    if (this.box.isOpen) {
      this.cancelTravel();
      this.player.stop();
    } else {
      const kb = this.input_.move;
      if (kb.x !== 0 || kb.y !== 0) {
        // Клавиатура перебивает маршрут по тапу.
        this.cancelTravel();
        this.player.setMove(kb);
      } else {
        this.followDrag(delta);
        const r = this.follower.step({ x: this.player.x, y: this.player.y }, PLAYER_SPEED, dt);
        this.player.setMove(r.move);
        if (r.arrived) this.onArrived();
        else if (r.stuck) this.pending = null;
      }
    }
    this.player.update(delta);

    const near = this.box.isOpen ? null : this.interaction.update(this.player.x, this.player.y);
    if (this.box.isOpen) this.interaction.hidePrompt();
    if (!this.box.isOpen && near && this.input_.consumeAction()) {
      this.cancelTravel();
      this.interaction.trigger();
    }
  }

  /** Сохранённая позиция из партии, если она проходима; иначе null (старт по умолчанию). */
  private savedStart(): Point | null {
    const loc = getState()?.location;
    if (!loc || loc.scene !== 'DeckScene') return null;
    if (!Number.isFinite(loc.x) || !Number.isFinite(loc.y)) return null;
    if (!pointClear(this.nav, loc.x, loc.y, BODY_RADIUS)) return null;
    return { x: loc.x, y: loc.y };
  }

  /** Записывает положение героини в партию и сохраняет на диск. */
  private saveProgress(): void {
    setLocation('DeckScene', this.player.x, this.player.y);
    void autosave();
  }

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') this.saveProgress();
  };

  /** Мир → экран (координаты интерфейсной камеры). */
  private worldToScreen(x: number, y: number): Point {
    const cam = this.cameras.main;
    const v = cam.worldView;
    return { x: (x - v.x) * cam.zoom, y: (y - v.y) * cam.zoom };
  }

  private pointerWorld(p: Phaser.Input.Pointer): Point {
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    return { x: w.x, y: w.y };
  }

  private cancelTravel(): void {
    this.follower.cancel();
    this.pending = null;
    this.dragPointerId = -1;
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (this.box.isOpen) {
      // Тап закрывает сообщение и не двигает героиню.
      this.box.hide();
      this.ignoredPointerId = p.id;
      return;
    }
    if (this.interaction.hitLabel(p.x, p.y)) {
      this.cancelTravel();
      this.player.stop();
      this.ignoredPointerId = p.id;
      this.interaction.trigger();
      return;
    }
    const w = this.pointerWorld(p);
    const hit = this.interaction.findAt(w.x, w.y);
    if (hit) {
      this.pending = hit;
      this.dragPointerId = -1;
      this.showMarker(hit.x, hit.y);
      this.travelTo({ x: hit.x, y: hit.y });
    } else {
      this.pending = null;
      this.dragPointerId = p.id;
      this.lastDragTarget = w;
      this.dragTimer = 0;
      this.showMarker(w.x, w.y);
      this.travelTo(w);
    }
  }

  private onPointerUp(p: Phaser.Input.Pointer): void {
    if (p.id === this.dragPointerId) this.dragPointerId = -1;
    if (p.id === this.ignoredPointerId) this.ignoredPointerId = -1;
  }

  /** Палец удерживается: цель следует за ним, маршрут пересчитывается по таймеру. */
  private followDrag(delta: number): void {
    if (this.dragPointerId < 0) return;
    const p = this.input.manager.pointers.find((q) => q.id === this.dragPointerId);
    if (!p || !p.isDown) {
      this.dragPointerId = -1;
      return;
    }
    this.dragTimer += delta;
    if (this.dragTimer < DRAG_REPATH_MS) return;
    const w = this.pointerWorld(p);
    if (Math.hypot(w.x - this.lastDragTarget.x, w.y - this.lastDragTarget.y) < 3) return;
    this.dragTimer = 0;
    this.lastDragTarget = w;
    this.showMarker(w.x, w.y);
    this.travelTo(w);
  }

  /** Маршрут к точке мира; для интерактивного объекта по прибытии срабатывает onArrived. */
  private travelTo(target: Point): void {
    const from = { x: this.player.x, y: this.player.y };
    const path = findPath(this.nav, from, target, BODY_RADIUS);
    if (!path || path.length === 0) {
      this.follower.cancel();
      if (this.pending && path) this.onArrived();
      return;
    }
    this.follower.set(path, from);
  }

  private onArrived(): void {
    const item = this.pending;
    this.pending = null;
    if (!item) return;
    const d = Math.hypot(item.x - this.player.x, item.y - this.player.y);
    if (d <= item.radius * 1.5) item.onInteract();
  }

  /** Маленькое кольцо в точке цели; гаснет за ~0.5 с. */
  private showMarker(x: number, y: number): void {
    this.markerTween?.stop();
    this.marker.setPosition(x, y).setVisible(true).setAlpha(1).setScale(1.4);
    this.markerTween = this.tweens.add({
      targets: this.marker,
      alpha: 0,
      scale: 0.6,
      duration: 550,
      ease: 'Quad.easeOut',
      onComplete: () => this.marker.setVisible(false),
    });
  }

  private tileImage(key: TileKey, x: number, y: number): Phaser.GameObjects.Image {
    const def = TILES[key];
    const img = this.add.image(x, y, def.texture, def.frame);
    this.worldLayer.add(img);
    return img;
  }

  private buildMap(walls: Phaser.Physics.Arcade.StaticGroup): void {
    for (let row = 0; row < DECK_ROWS; row++) {
      for (let col = 0; col < DECK_COLS; col++) {
        let key = DECK_GROUND[row][col];
        const cx = col * T + T / 2;
        const cy = row * T + T / 2;
        if (key === 'deck_a') {
          key = (['deck_a', 'deck_b', 'deck_c'] as const)[(col * 3 + row * 5 + col * row) % 3];
          this.tileImage(key, cx, cy).setDepth(DEPTH_GROUND);
        } else {
          const img = this.tileImage(key, cx, cy).setDepth(DEPTH_WATER);
          if (key === 'water_a' && ((col + row) & 1) === 1) img.setFrame('water_b');
          this.water.push(img);
        }
      }
    }

    // Объекты: рисуем по тайлам.
    for (let row = 0; row < DECK_ROWS; row++) {
      for (let col = 0; col < DECK_COLS; col++) {
        const key = DECK_OBJECTS[row][col];
        if (key) this.tileImage(key, col * T + T / 2, row * T + T / 2).setDepth(row * T + T);
      }
    }

    // Коллайдеры — из той же сетки проходимости, что и у поиска пути; воду не трогаем (за бортами недостижима).
    for (let row = 0; row < DECK_ROWS; row++) {
      let runStart = -1;
      for (let col = 0; col <= DECK_COLS; col++) {
        const solid = col < DECK_COLS && this.nav.blocked[row][col] && DECK_GROUND[row][col] === 'deck_a';
        if (solid) {
          if (runStart < 0) runStart = col;
        } else if (runStart >= 0) {
          this.addWall(walls, runStart * T, row * T, (col - runStart) * T, T);
          runStart = -1;
        }
      }
    }
  }

  private buildProps(): void {
    for (const p of DECK_PROPS) {
      if (p.kind === 'mast') {
        const cx = (p.col + p.w / 2) * T;
        const cy = (p.row + p.h / 2) * T;
        const img = this.add.image(cx, cy, MAST_TEXTURE).setDepth(cy + 6);
        this.worldLayer.add(img);
      }
    }
  }

  private buildSailor(): void {
    // Матрос стоит на палубе; диалог — этап 4.
    const x = DECK_SAILOR_POS.col * T;
    const y = DECK_SAILOR_POS.row * T;
    const shadow = this.add.ellipse(x, y - 1, 11, 4, 0x000000, 0.35).setDepth(y - 1);
    const img = this.add
      .image(x, y + 2, SAILOR.texture, SAILOR.frame)
      .setOrigin(0.5, 1)
      .setFlipX(true)
      .setDepth(y);
    this.worldLayer.add([shadow, img]);
  }

  private addWall(
    walls: Phaser.Physics.Arcade.StaticGroup,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const zone = this.add.zone(x + w / 2, y + h / 2, w, h);
    this.physics.add.existing(zone, true);
    walls.add(zone);
  }

  private registerInteractables(): void {
    const say = (text: string) => (): void => {
      this.box.show(text);
      this.saveProgress();
    };
    this.interaction.register({
      id: 'cabin-door',
      x: 7 * T,
      y: 3.5 * T,
      tapRadius: 20,
      radius: 30,
      prompt: 'Каюта капитана',
      promptOffsetY: 14,
      onInteract: say('Дверь заперта изнутри... пока.'),
    });
    this.interaction.register({
      id: 'barrel',
      x: 3.5 * T,
      y: 7 * T,
      tapRadius: 20,
      radius: 26,
      prompt: 'Осмотреть',
      promptOffsetY: 22,
      onInteract: say('Бочка с солониной. Судя по запаху, она старше любого обещания капитана.'),
    });
    this.interaction.register({
      id: 'crate',
      x: 4 * T,
      y: 24 * T,
      tapRadius: 20,
      radius: 28,
      prompt: 'Осмотреть',
      promptOffsetY: 22,
      onInteract: say('Ящик заколочен на совесть. Единственное, что на этом корабле делают на совесть.'),
    });
    this.interaction.register({
      id: 'rail',
      x: 11.5 * T,
      y: 10.5 * T,
      tapRadius: 20,
      radius: 24,
      prompt: 'Смотреть на шторм',
      promptOffsetY: 14,
      onInteract: say('Шторм не стихает. Море чёрное, небо чёрное. Хоть что-то здесь не притворяется.'),
    });
  }
}
