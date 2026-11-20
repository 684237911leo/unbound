import Phaser from 'phaser';
import {
  DECK_PLAYER_START,
  DECK_PROPS,
  DECK_SAILOR_POS,
  DECK_TILE,
  DECK_WORLD_ZOOM,
  GANGWAY_POS,
  type DeckLayout,
  type DeckMode,
  buildDeckLayout,
} from '../data/maps/deck';
import { PROLOGUE_DIALOGUES } from '../data/dialogues/prologue';
import { HEROINE, MAST_TEXTURE, SAILOR, TILES, type FrameRef, type TileKey } from '../data/tiles';
import { InputController } from '../systems/input/InputController';
import { type Interactable, InteractionSystem } from '../systems/interaction/InteractionSystem';
import { PathFollower } from '../systems/navigation/follower';
import { type Point, findPath, pointClear } from '../systems/navigation/grid';
import { PLAYER_SPEED, Player } from '../systems/player/Player';
import { DialogueBox } from '../systems/dialogue/DialogueBox';
import { fadeInScene, fadeToScene } from '../systems/transition';
import { autosave, getState, newGame, setLocation } from '../core/session';
import { FLAGS, advancePrologue, getPrologueStep, hasFlag, objectiveFor, setFlag } from '../core/prologue';
import type { GameState } from '../core/GameState';
import { GoldHud } from '../ui/GoldHud';
import { MessageBox } from '../ui/MessageBox';
import { ObjectiveBar } from '../ui/ObjectiveBar';
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
    /** Отладочный доступ для автотестов: только чтение состояния и перевод координат. На геймплей не влияет. */
    __unbound?: Record<string, unknown>;
  }
}

/** Позиция матроса, к которой он подходит утром (тайлы), и стартовая точка героини утром. */
const MORNING_START = { x: 7 * T, y: 4.8 * T };
const MORNING_SAILOR_START = { col: 4.5, row: 11.5 };
const MORNING_SAILOR_FINAL = { col: 5.5, row: 6.5 };
const SAILOR_SPEED = 55;

interface Npc {
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
}

/**
 * Палуба пиратского корабля: пролог, сцена 1 (ночь, шторм) и сцена 5 (утро в гавани).
 * Режим определяется шагом пролога в партии. Мир — в слое камеры с зумом, интерфейс — отдельная камера.
 */
export class DeckScene extends Phaser.Scene {
  private worldLayer!: Phaser.GameObjects.Layer;
  private uiLayer!: Phaser.GameObjects.Layer;
  private player!: Player;
  private input_!: InputController;
  private interaction!: InteractionSystem;
  private box!: MessageBox;
  private dlg!: DialogueBox;
  private objective!: ObjectiveBar;
  private gold: GoldHud | null = null;
  private rain: RainEffect | null = null;
  private water: Phaser.GameObjects.Image[] = [];
  private layout!: DeckLayout;
  private mode: DeckMode = 'night';
  private state!: GameState;
  private mainSailor!: Npc;
  private readonly follower = new PathFollower();
  private marker!: Phaser.GameObjects.Arc;
  private markerTween?: Phaser.Tweens.Tween;
  private pending: Interactable | null = null;
  private dragPointerId = -1;
  private ignoredPointerId = -1;
  private dragTimer = 0;
  private lastDragTarget: Point = { x: -1e9, y: -1e9 };
  /** Сюжетная сцена идёт: ввод игрока заблокирован. */
  private cutscene = false;
  private leaving = false;

  constructor() {
    super('DeckScene');
  }

  create(): void {
    this.state = getState() ?? newGame('Аня');
    const step = getPrologueStep(this.state);
    this.mode = step === 'morning' ? 'morning' : 'night';
    const morning = this.mode === 'morning';
    this.leaving = false;
    this.cutscene = false;
    this.gold = null;
    this.rain = null;

    const W = this.scale.width;
    const H = this.scale.height;

    // Клетка, где стоит матрос, непроходима.
    const mainPost = morning ? MORNING_SAILOR_FINAL : DECK_SAILOR_POS;
    const extraSailors = morning
      ? [
          { col: 4.5, row: 19.5, frame: 87, flip: false },
          { col: 9.5, row: 12.5, frame: 98, flip: true },
        ]
      : [];
    this.layout = buildDeckLayout(this.mode, [
      { col: Math.floor(mainPost.col), row: Math.floor(mainPost.row) },
      ...extraSailors.map((e) => ({ col: Math.floor(e.col), row: Math.floor(e.row) })),
    ]);
    const L = this.layout;
    const worldW = L.cols * T;
    const worldH = L.rows * T;

    this.cameras.main.setBackgroundColor(morning ? '#7fb4dc' : '#0b0f1a');
    this.physics.world.setBounds(0, 0, worldW, worldH);

    this.worldLayer = this.add.layer();
    this.uiLayer = this.add.layer().setDepth(10);
    this.water = [];

    const walls = this.physics.add.staticGroup();
    this.buildMap(walls);
    this.buildProps();

    const start = this.savedStart() ?? (morning ? MORNING_START : { x: DECK_PLAYER_START.col * T, y: DECK_PLAYER_START.row * T });
    this.player = new Player(this, start.x, start.y, HEROINE);
    this.worldLayer.add([this.player.shadow, this.player.view]);
    this.physics.add.collider(this.player.body, walls);

    const introNeeded = morning ? !hasFlag(this.state, FLAGS.morningTalkDone) : !hasFlag(this.state, FLAGS.summonsDone);
    const mainPos = introNeeded
      ? morning
        ? MORNING_SAILOR_START
        : DECK_SAILOR_POS
      : mainPost;
    this.mainSailor = this.buildSailor(SAILOR, mainPos.col * T, mainPos.row * T, !morning);
    for (const e of extraSailors) {
      const n = this.buildSailor({ texture: SAILOR.texture, frame: e.frame }, e.col * T, e.row * T, e.flip);
      // Лёгкое покачивание на месте, чтобы палуба казалась живой.
      this.tweens.add({ targets: n.img, y: n.img.y - 1, duration: 900 + e.row * 20, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // Камеры: мир с зумом ×2 следует за игроком, интерфейс — вторая камера без зума.
    const cam = this.cameras.main;
    cam.setZoom(DECK_WORLD_ZOOM);
    cam.setBounds(0, 0, worldW, worldH);
    cam.startFollow(this.player.body, true, 0.12, 0.12);
    const uiCam = this.cameras.add(0, 0, W, H, false, 'ui');
    uiCam.ignore(this.worldLayer);
    cam.ignore(this.uiLayer);

    // Ночь: умножаем цвет кадра на тёмно-синий. Утро: тёплый дневной оттенок. Дождь (ночью) и интерфейс рисуются поверх.
    const tint = this.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(100)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    tint.fillStyle(morning ? 0xfff0d8 : 0x5d6c9c, 1);
    tint.fillRect(0, 0, W, H);
    this.uiLayer.add(tint);

    if (!morning) {
      this.rain = new RainEffect(this, { count: 70, color: 0x9fb4e0, alpha: 0.4, depth: 101 });
      this.uiLayer.add(this.rain.graphics);
    }

    this.input_ = new InputController(this);
    this.box = new MessageBox(this, this.uiLayer);
    this.dlg = new DialogueBox(this, this.uiLayer);
    this.objective = new ObjectiveBar(this, this.uiLayer);
    if (this.state.gold > 0 || hasFlag(this.state, FLAGS.chestLooted)) this.gold = new GoldHud(this, this.uiLayer, this.state.gold);
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
    this.registerInteractables(mainPost);
    this.objective.set(objectiveFor(this.state));

    // Положение героини сохраняется раз в 30 с, при каждом взаимодействии и при уходе в фон.
    this.time.addEvent({ delay: AUTOSAVE_MS, loop: true, callback: () => this.saveProgress() });
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    // Лёгкое колыхание воды.
    let flip = false;
    const [wa, wb] = [TILES[L.waterKeys[0]].frame, TILES[L.waterKeys[1]].frame];
    this.time.addEvent({
      delay: 700,
      loop: true,
      callback: () => {
        flip = !flip;
        for (const img of this.water) {
          const alt = ((img.x / T + img.y / T) & 1) === 0;
          img.setFrame(alt === flip ? wa : wb);
        }
      },
    });

    window.__unbound = {
      game: this.game,
      scene: 'DeckScene',
      playerPos: () => ({ x: this.player.x, y: this.player.y }),
      worldToScreen: (x: number, y: number) => this.worldToScreen(x, y),
      isMessageOpen: () => this.box.isOpen,
      snapshot: () => this.snapshot(),
    };

    fadeInScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
      this.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
      this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
      this.input_.destroy();
      this.box.destroy();
      this.dlg.destroy();
      this.objective.destroy();
      this.gold?.destroy();
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      this.water = [];
      this.follower.cancel();
      this.pending = null;
      this.dragPointerId = -1;
      this.ignoredPointerId = -1;
    });

    if (introNeeded) void this.playIntro(morning);
  }

  update(_time: number, delta: number): void {
    this.rain?.update(delta);
    const dt = delta / 1000;
    const locked = this.box.isOpen || this.dlg.isOpen || this.cutscene;

    if (locked) {
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

    const near = locked ? null : this.interaction.update(this.player.x, this.player.y);
    if (locked) this.interaction.hidePrompt();
    if (!locked && near && this.input_.consumeAction()) {
      this.cancelTravel();
      this.interaction.trigger();
    }
  }

  // ───────────── Сюжет ─────────────

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  private moveNpc(npc: Npc, to: Point): Promise<void> {
    const dist = Math.hypot(to.x - npc.img.x, to.y - npc.img.y);
    return new Promise((resolve) => {
      this.tweens.add({
        targets: npc.img,
        x: to.x,
        y: to.y,
        duration: Math.max(1, (dist / SAILOR_SPEED) * 1000),
        ease: 'Linear',
        onUpdate: () => {
          npc.shadow.setPosition(npc.img.x, npc.img.y - 1);
          npc.img.setDepth(npc.img.y);
          npc.shadow.setDepth(npc.img.y - 1);
        },
        onComplete: () => resolve(),
      });
    });
  }

  /** Матрос подходит к героине и произносит реплики; после диалога игрок получает управление и цель. */
  private async playIntro(morning: boolean): Promise<void> {
    this.cutscene = true;
    this.cancelTravel();
    this.player.stop();
    await this.delay(morning ? 900 : 700);
    const npc = this.mainSailor;
    const hx = this.player.x;
    const hy = this.player.y;
    if (morning) {
      await this.moveNpc(npc, { x: MORNING_SAILOR_FINAL.col * T, y: MORNING_SAILOR_FINAL.row * T });
      npc.img.setFlipX(false);
    } else {
      npc.img.setFlipX(true);
      await this.moveNpc(npc, { x: hx + 10, y: hy - 20 });
    }
    npc.img.setFlipX(npc.img.x > hx);
    const dlg = morning ? PROLOGUE_DIALOGUES.morning_leave : PROLOGUE_DIALOGUES.deck_summons;
    await this.dlg.play(dlg, this.state.heroName);
    if (!this.scene.isActive()) return;
    if (!morning) {
      await this.moveNpc(npc, { x: DECK_SAILOR_POS.col * T, y: DECK_SAILOR_POS.row * T });
      npc.img.setFlipX(true);
    }
    setFlag(this.state, morning ? FLAGS.morningTalkDone : FLAGS.summonsDone);
    this.objective.set(objectiveFor(this.state));
    this.cutscene = false;
    this.saveProgress();
  }

  private enterCabin(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cutscene = true;
    this.cancelTravel();
    this.player.stop();
    advancePrologue(this.state, 'cabin');
    setLocation('CabinScene', 6 * T, 20.3 * T);
    void autosave();
    fadeToScene(this, 'CabinScene');
  }

  private disembark(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cutscene = true;
    this.cancelTravel();
    this.player.stop();
    advancePrologue(this.state, 'done');
    void autosave();
    fadeToScene(this, 'EndCardScene', 700);
  }

  private snapshot(): Record<string, unknown> {
    return {
      scene: 'DeckScene',
      mode: this.mode,
      step: getPrologueStep(this.state),
      gold: this.state.gold,
      goldHud: this.gold?.value ?? null,
      inventory: this.state.inventory.map((i) => ({ ...i })),
      flags: { ...this.state.flags },
      objective: this.objective.text,
      hero: { x: this.player.x, y: this.player.y },
      dialogueOpen: this.dlg.isOpen,
      messageOpen: this.box.isOpen,
      cutscene: this.cutscene,
      sailor: { x: this.mainSailor.img.x, y: this.mainSailor.img.y },
      interactables: this.interaction.list().map((i) => ({ id: i.id, x: i.x, y: i.y })),
    };
  }

  // ───────────── Сохранение, ввод, движение ─────────────

  /** Сохранённая позиция из партии, если она проходима; иначе null (старт по умолчанию). */
  private savedStart(): Point | null {
    const loc = this.state.location;
    if (!loc || loc.scene !== 'DeckScene') return null;
    if (!Number.isFinite(loc.x) || !Number.isFinite(loc.y)) return null;
    if (!pointClear(this.layout.nav, loc.x, loc.y, BODY_RADIUS)) return null;
    return { x: loc.x, y: loc.y };
  }

  /** Записывает положение героини в партию и сохраняет на диск. */
  private saveProgress(): void {
    if (this.leaving) return;
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
    // Диалог сам обрабатывает касания; сцена их не трогает.
    if (this.dlg.isOpen || this.cutscene) return;
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
    const path = findPath(this.layout.nav, from, target, BODY_RADIUS);
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

  // ───────────── Построение мира ─────────────

  private tileImage(key: TileKey, x: number, y: number): Phaser.GameObjects.Image {
    const def = TILES[key];
    const img = this.add.image(x, y, def.texture, def.frame);
    this.worldLayer.add(img);
    return img;
  }

  private buildMap(walls: Phaser.Physics.Arcade.StaticGroup): void {
    const L = this.layout;
    const isWater = (k: TileKey): boolean => k === 'water_a' || k === 'sea_a';
    for (let row = 0; row < L.rows; row++) {
      for (let col = 0; col < L.cols; col++) {
        let key = L.ground[row][col];
        const cx = col * T + T / 2;
        const cy = row * T + T / 2;
        if (key === 'deck_a') {
          key = (['deck_a', 'deck_b', 'deck_c'] as const)[(col * 3 + row * 5 + col * row) % 3];
          this.tileImage(key, cx, cy).setDepth(DEPTH_GROUND);
        } else if (isWater(key)) {
          const img = this.tileImage(key, cx, cy).setDepth(DEPTH_WATER);
          if (((col + row) & 1) === 1) img.setFrame(TILES[L.waterKeys[1]].frame);
          this.water.push(img);
        } else {
          this.tileImage(key, cx, cy).setDepth(DEPTH_GROUND);
        }
      }
    }

    // Объекты: рисуем по тайлам.
    for (let row = 0; row < L.rows; row++) {
      for (let col = 0; col < L.cols; col++) {
        const key = L.objects[row][col];
        if (key) this.tileImage(key, col * T + T / 2, row * T + T / 2).setDepth(row * T + T);
      }
    }

    // Коллайдеры — из той же сетки проходимости, что и у поиска пути; воду не трогаем (за бортами недостижима).
    for (let row = 0; row < L.rows; row++) {
      let runStart = -1;
      for (let col = 0; col <= L.cols; col++) {
        const solid = col < L.cols && L.nav.blocked[row][col] && !isWater(L.ground[row][col]);
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

  private buildSailor(frame: FrameRef, x: number, y: number, flipX: boolean): Npc {
    const shadow = this.add.ellipse(x, y - 1, 11, 4, 0x000000, 0.35).setDepth(y - 1);
    const img = this.add.image(x, y, frame.texture, frame.frame).setOrigin(0.5, 1).setFlipX(flipX).setDepth(y);
    this.worldLayer.add([shadow, img]);
    return { img, shadow };
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

  private registerInteractables(mainPost: { col: number; row: number }): void {
    const morning = this.mode === 'morning';
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
      onInteract: morning
        ? say('Эта дверь для меня закрыта. Я сама её закрыла.')
        : () => {
            if (hasFlag(this.state, FLAGS.summonsDone)) this.enterCabin();
            else say('Дверь заперта изнутри... пока.')();
          },
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
      prompt: morning ? 'Смотреть на гавань' : 'Смотреть на шторм',
      promptOffsetY: 14,
      onInteract: morning
        ? say('Шторм стих. Гавань выглядит почти приветливо. Почти.')
        : say('Шторм не стихает. Море чёрное, небо чёрное. Хоть что-то здесь не притворяется.'),
    });
    // Матрос: короткая реплика в характере (после сцены). Сюжетных фактов не добавляет.
    this.interaction.register({
      id: 'sailor',
      x: mainPost.col * T,
      y: (mainPost.row - 0.3) * T,
      tapRadius: 16,
      radius: 26,
      prompt: 'Поговорить',
      promptOffsetY: 24,
      onInteract: morning
        ? say('Матрос пожимает плечами и отворачивается к берегу.')
        : say('Матрос: — Иди уже. Капитан не любит ждать.'),
    });
    if (morning) {
      this.interaction.register({
        id: 'gangway',
        x: GANGWAY_POS.x,
        y: GANGWAY_POS.y,
        tapRadius: 22,
        radius: 26,
        prompt: 'Сойти на берег',
        promptOffsetY: 16,
        onInteract: () => this.disembark(),
      });
    }
  }
}
