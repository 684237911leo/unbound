import Phaser from 'phaser';
import { PROLOGUE_DIALOGUES } from '../data/dialogues/prologue';
import { CABIN_FIGHT } from '../data/encounters';
import { CHEST_GOLD, CHEST_ITEMS, ITEMS } from '../data/items';
import {
  CABIN_COLS,
  CABIN_PIECES,
  CABIN_POINTS,
  CABIN_ROWS,
  CABIN_TILE,
  buildCabinNavGrid,
  floorFrame,
  wallFrame,
} from '../data/maps/cabin';
import { CAPTAIN, HEROINE, SHEETS, TILES } from '../data/tiles';
import { FLAGS, advancePrologue, atLeast, getPrologueStep, grantChestLoot, objectiveFor } from '../core/prologue';
import type { GameState } from '../core/GameState';
import { autosave, getState, newGame, setLocation } from '../core/session';
import { CombatController } from '../systems/combat/CombatController';
import { CombatEncounter } from '../systems/combat/encounter';
import { DialogueBox } from '../systems/dialogue/DialogueBox';
import { InputController } from '../systems/input/InputController';
import { type Interactable, InteractionSystem } from '../systems/interaction/InteractionSystem';
import { PathFollower } from '../systems/navigation/follower';
import { type NavGrid, type Point, findPath, pointClear } from '../systems/navigation/grid';
import { PLAYER_SPEED, Player } from '../systems/player/Player';
import { fadeInScene, fadeToScene } from '../systems/transition';
import { GoldHud } from '../ui/GoldHud';
import { HintPanel } from '../ui/HintPanel';
import { LootPanel, type LootRow } from '../ui/LootPanel';
import { MessageBox } from '../ui/MessageBox';
import { ObjectiveBar } from '../ui/ObjectiveBar';

const T = CABIN_TILE;
const BODY_RADIUS = 5;
const DRAG_REPATH_MS = 80;
const AUTOSAVE_MS = 30000;
/** Где героиня появляется на палубе утром (DeckScene, режим morning). */
const MORNING_DECK_START = { x: 7 * T, y: 4.8 * T };

/**
 * Каюта капитана: пролог, сцены 2–4. Разговор → вход стражи → настоящий бой (обучение + капитан) →
 * последние слова капитана → свободный осмотр и сундук → выход на палубу.
 */
export class CabinScene extends Phaser.Scene {
  private worldLayer!: Phaser.GameObjects.Layer;
  private uiLayer!: Phaser.GameObjects.Layer;
  private state!: GameState;
  private nav!: NavGrid;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private player!: Player;
  private input_!: InputController;
  private interaction!: InteractionSystem;
  private box!: MessageBox;
  private dlg!: DialogueBox;
  private hint!: HintPanel;
  private loot!: LootPanel;
  private objective!: ObjectiveBar;
  private gold: GoldHud | null = null;
  private combat: CombatController | null = null;
  private encounter: CombatEncounter | null = null;
  private readonly follower = new PathFollower();
  private marker!: Phaser.GameObjects.Arc;
  private markerTween?: Phaser.Tweens.Tween;
  private chestImg: Phaser.GameObjects.Image | null = null;
  private seatedCaptain: Phaser.GameObjects.Image | null = null;
  private seatedShadow: Phaser.GameObjects.Ellipse | null = null;
  private lyingCaptain = false;
  private pending: Interactable | null = null;
  private dragPointerId = -1;
  private ignoredPointerId = -1;
  private dragTimer = 0;
  private lastDragTarget: Point = { x: -1e9, y: -1e9 };
  /** Сюжетная сцена идёт: ввод игрока заблокирован. */
  private busy = false;
  private leaving = false;
  private fightWon = false;
  private scriptResolve: (() => void) | null = null;

  constructor() {
    super('CabinScene');
  }

  create(): void {
    this.state = getState() ?? newGame('Аня');
    // Прямой вход без шага (отладка): считаем, что героиня уже вошла в каюту.
    advancePrologue(this.state, 'cabin');
    this.fightWon = atLeast(this.state, 'cabin_fight_won');
    const looted = atLeast(this.state, 'chest_looted');
    this.busy = false;
    this.leaving = false;
    this.combat = null;
    this.encounter = null;
    this.gold = null;
    this.lyingCaptain = false;
    this.scriptResolve = null;

    const W = this.scale.width;
    const H = this.scale.height;
    const worldW = CABIN_COLS * T;
    const worldH = CABIN_ROWS * T;

    this.cameras.main.setBackgroundColor('#0b0f1a');
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.worldLayer = this.add.layer();
    this.uiLayer = this.add.layer().setDepth(10);

    this.nav = buildCabinNavGrid();
    this.walls = this.physics.add.staticGroup();
    this.buildRoom();

    const start = this.fightWon ? (this.savedStart() ?? { x: 6 * T, y: 19 * T }) : CABIN_POINTS.enter;
    this.player = new Player(this, start.x, start.y, HEROINE);
    this.worldLayer.add([this.player.shadow, this.player.view]);
    this.physics.add.collider(this.player.body, this.walls);

    // Капитан: до боя сидит за столом; после боя лежит.
    if (this.fightWon) this.layCaptain(CABIN_POINTS.captain);
    else this.seatCaptain();
    if (looted) this.chestImg?.setFrame(TILES.chest_open.frame);

    // Камеры: мир с зумом по ширине комнаты (вся каюта в кадре), интерфейс — отдельная камера без зума.
    const cam = this.cameras.main;
    cam.setZoom(Math.min(W / worldW, H / worldH));
    cam.centerOn(worldW / 2, worldH / 2);
    const uiCam = this.cameras.add(0, 0, W, H, false, 'ui');
    uiCam.ignore(this.worldLayer);
    cam.ignore(this.uiLayer);

    // Лёгкий тёплый полумрак каюты.
    const tint = this.add.graphics().setScrollFactor(0).setDepth(100).setBlendMode(Phaser.BlendModes.MULTIPLY);
    tint.fillStyle(0xdcccb8, 1);
    tint.fillRect(0, 0, W, H);
    this.uiLayer.add(tint);

    this.input_ = new InputController(this);
    this.box = new MessageBox(this, this.uiLayer);
    this.dlg = new DialogueBox(this, this.uiLayer);
    this.hint = new HintPanel(this, this.uiLayer);
    this.loot = new LootPanel(this, this.uiLayer);
    this.objective = new ObjectiveBar(this, this.uiLayer);
    if (this.state.gold > 0 || looted) this.gold = new GoldHud(this, this.uiLayer, this.state.gold);
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
    this.objective.set(this.fightWon ? objectiveFor(this.state) : null);

    this.time.addEvent({ delay: AUTOSAVE_MS, loop: true, callback: () => this.saveProgress() });
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    window.__unbound = {
      game: this.game,
      scene: 'CabinScene',
      playerPos: () => ({ x: this.player.x, y: this.player.y }),
      worldToScreen: (x: number, y: number) => this.worldToScreen(x, y),
      snapshot: () => this.snapshot(),
      // Совместимость с ботом боя: только чтение.
      combat: {
        snapshot: () =>
          this.combat
            ? {
                ...this.combat.snapshot(),
                hint: this.hint.text,
                attempt: this.encounter?.attempt ?? 0,
                won: this.fightWon,
              }
            : { heroine: null, enemies: [], hint: '', attempt: 0, won: this.fightWon },
        worldToScreen: (x: number, y: number) => this.worldToScreen(x, y),
      },
    };

    fadeInScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
      this.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
      this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
      this.encounter?.abort();
      this.combat?.destroy();
      this.input_.destroy();
      this.box.destroy();
      this.dlg.destroy();
      this.hint.destroy();
      this.loot.destroy();
      this.objective.destroy();
      this.gold?.destroy();
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      this.follower.cancel();
      this.scriptResolve = null;
    });

    if (!this.fightWon) void this.playFightSequence();
  }

  update(time: number, delta: number): void {
    if (this.combat) {
      this.combat.update(time, delta);
      this.interaction.hidePrompt();
      return;
    }
    const dt = delta / 1000;
    if (this.scriptResolve) {
      // Героиню ведёт сценарий.
      const r = this.follower.step({ x: this.player.x, y: this.player.y }, PLAYER_SPEED * 0.8, dt);
      this.player.setMove(r.move);
      this.player.update(delta);
      if (r.arrived || r.stuck) {
        const done = this.scriptResolve;
        this.scriptResolve = null;
        this.player.stop();
        done();
      }
      return;
    }
    const locked = this.box.isOpen || this.dlg.isOpen || this.loot.isOpen || this.busy;
    if (locked) {
      this.cancelTravel();
      this.player.stop();
    } else {
      const kb = this.input_.move;
      if (kb.x !== 0 || kb.y !== 0) {
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

  // ───────────── Мир ─────────────

  private buildRoom(): void {
    for (let row = 0; row < CABIN_ROWS; row++) {
      for (let col = 0; col < CABIN_COLS; col++) {
        const x = col * T + T / 2;
        const y = row * T + T / 2;
        const wall = wallFrame(col, row);
        if (wall) {
          this.worldLayer.add(this.add.image(x, y, SHEETS.cabin, wall).setDepth(row * T + T));
          // Под стеной — пол, чтобы не просвечивал фон у дверных проёмов.
        } else {
          this.worldLayer.add(this.add.image(x, y, SHEETS.cabin, floorFrame(col, row)).setDepth(-1000));
        }
      }
    }
    for (const p of CABIN_PIECES) {
      const x = p.col * T + T / 2;
      const y = p.row * T + T / 2 + (p.dy ?? 0);
      const img = this.add.image(x, y, p.texture, p.frame).setDepth(p.row * T + T + (p.depthBonus ?? 0));
      this.worldLayer.add(img);
      if (p.id === 'chest') this.chestImg = img;
    }
    // Коллайдеры из той же сетки, что и поиск пути.
    for (let row = 0; row < CABIN_ROWS; row++) {
      let run = -1;
      for (let col = 0; col <= CABIN_COLS; col++) {
        const solid = col < CABIN_COLS && this.nav.blocked[row][col];
        if (solid && run < 0) run = col;
        if (!solid && run >= 0) {
          const zone = this.add.zone(((run + col) / 2) * T, row * T + T / 2, (col - run) * T, T);
          this.physics.add.existing(zone, true);
          this.walls.add(zone);
          run = -1;
        }
      }
    }
  }

  private seatCaptain(): void {
    const p = CABIN_POINTS.captainSeat;
    this.seatedShadow = this.add.ellipse(p.x, p.y, 11, 4, 0x000000, 0.35).setDepth(p.y - 1);
    this.seatedCaptain = this.add.image(p.x, p.y, CAPTAIN.texture, CAPTAIN.frame).setOrigin(0.5, 1).setDepth(p.y);
    this.worldLayer.add([this.seatedShadow, this.seatedCaptain]);
  }

  private showSeatedCaptain(on: boolean): void {
    this.seatedCaptain?.setVisible(on);
    this.seatedShadow?.setVisible(on);
  }

  /** Капитан лежит там, где пал. Остаётся до конца пролога. */
  private layCaptain(at: Point): void {
    this.lyingCaptain = true;
    const shadow = this.add.ellipse(at.x + 2, at.y - 2, 22, 6, 0x000000, 0.4).setDepth(at.y - 9);
    const body = this.add
      .image(at.x - 6, at.y + 1, CAPTAIN.texture, CAPTAIN.frame)
      .setOrigin(0.5, 1)
      .setAngle(90)
      .setTint(0xb8b8c0)
      .setDepth(at.y - 8);
    this.worldLayer.add([shadow, body]);
  }

  private snapshot(): Record<string, unknown> {
    return {
      scene: 'CabinScene',
      step: getPrologueStep(this.state),
      gold: this.state.gold,
      goldHud: this.gold?.value ?? null,
      inventory: this.state.inventory.map((i) => ({ ...i })),
      flags: { ...this.state.flags },
      objective: this.objective.text,
      hero: { x: this.player.x, y: this.player.y },
      dialogueOpen: this.dlg.isOpen,
      messageOpen: this.box.isOpen,
      lootOpen: this.loot.isOpen,
      lootRows: this.loot.isOpen ? this.loot.rows : [],
      busy: this.busy,
      combatActive: this.combat !== null,
      fightWon: this.fightWon,
      captainLying: this.lyingCaptain,
      captainSeated: this.seatedCaptain?.visible ?? false,
      chestOpen: String(this.chestImg?.frame.name) === String(TILES.chest_open.frame),
      enemies: this.combat ? this.combat.enemies.map((e) => ({ id: e.id, alive: e.alive })) : [],
      hint: this.hint.text,
      interactables: this.interaction.list().map((i) => ({ id: i.id, x: i.x, y: i.y })),
    };
  }

  // ───────────── Сюжет ─────────────

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  private waitUntil(cond: () => boolean, maxMs: number): Promise<void> {
    return new Promise((resolve) => {
      const t0 = this.time.now;
      const ev = this.time.addEvent({
        delay: 50,
        loop: true,
        callback: () => {
          if (cond() || this.time.now - t0 > maxMs) {
            ev.remove();
            resolve();
          }
        },
      });
    });
  }

  private scriptWalkTo(target: Point): Promise<void> {
    const from = { x: this.player.x, y: this.player.y };
    const path = findPath(this.nav, from, target, BODY_RADIUS);
    if (!path || path.length === 0) return Promise.resolve();
    this.follower.set(path, from);
    return new Promise((resolve) => {
      this.scriptResolve = resolve;
    });
  }

  private async playFightSequence(): Promise<void> {
    this.busy = true;
    await this.delay(700);
    await this.scriptWalkTo(CABIN_POINTS.heroine);
    await this.delay(250);
    await this.dlg.play(PROLOGUE_DIALOGUES.cabin_talk, this.state.heroName);
    if (!this.scene.isActive()) return;

    // Входит стража: враги создаются сразу (держатся обучением), реплика-ремарка идёт, пока они входят.
    const combat = new CombatController({
      scene: this,
      worldLayer: this.worldLayer,
      uiLayer: this.uiLayer,
      nav: this.nav,
      walls: this.walls,
      player: this.player,
    });
    this.combat = combat;
    combat.attach();
    combat.setInputEnabled(false);
    for (const we of CABIN_FIGHT.waves[0].enemies) {
      combat.spawnEnemy(we.id, CABIN_POINTS[we.spawn], {
        walkTo: we.stand ? CABIN_POINTS[we.stand] : undefined,
        held: true,
      });
    }
    await this.dlg.play(PROLOGUE_DIALOGUES.cabin_guards, this.state.heroName);
    if (!this.scene.isActive()) return;
    await this.waitUntil(() => combat.enemies.every((e) => !e.entering), 4000);

    const encounter = new CombatEncounter(combat, CABIN_FIGHT, CABIN_POINTS, this.hint);
    this.encounter = encounter;
    encounter.adoptFirstWave();
    encounter.events.on('wave-start', (index) => this.showSeatedCaptain(index === 0));
    combat.setInputEnabled(true);
    this.busy = false;
    await encounter.run();
    if (!this.scene.isActive()) return;
    await this.afterFight();
  }

  private async afterFight(): Promise<void> {
    const combat = this.combat;
    if (!combat) return;
    this.busy = true;
    combat.setInputEnabled(false);
    this.hint.hide();
    const cap = combat.enemyById('captain');
    const at = cap ? { x: cap.x, y: cap.y } : { ...CABIN_POINTS.captain };
    combat.destroy();
    this.combat = null;
    this.encounter = null;
    this.player.view.setAngle(0).clearTint().setAlpha(1);
    this.player.stop();
    this.showSeatedCaptain(false);
    this.layCaptain(at);
    this.fightWon = true;
    // Победа — контрольная точка: после перезапуска бой не повторяется.
    advancePrologue(this.state, 'cabin_fight_won');
    this.saveProgress();
    await this.delay(700);
    await this.dlg.play(PROLOGUE_DIALOGUES.captain_death, this.state.heroName);
    if (!this.scene.isActive()) return;
    this.objective.set(objectiveFor(this.state));
    this.busy = false;
    this.saveProgress();
  }

  private async openChest(): Promise<void> {
    if (this.busy) return;
    if (atLeast(this.state, 'chest_looted')) {
      this.box.show('Пусто. Всё, что стоило взять, уже у меня.');
      return;
    }
    this.busy = true;
    this.cancelTravel();
    this.player.stop();
    this.chestImg?.setFrame(TILES.chest_open.frame);
    const before = this.state.gold;
    const granted = grantChestLoot(this.state);
    if (granted) {
      setLocation('CabinScene', this.player.x, this.player.y);
      void autosave();
    }
    const rows: LootRow[] = [{ title: `${CHEST_GOLD} золотых`, gold: true }];
    for (const it of CHEST_ITEMS) {
      const def = ITEMS[it.itemId];
      rows.push({ title: def.name, note: def.sellValue !== null ? `можно продать, около ${def.sellValue} золотых` : 'сюжетный предмет' });
    }
    await this.loot.show('Сундук капитана', rows);
    if (!this.scene.isActive()) return;
    if (!this.gold) this.gold = new GoldHud(this, this.uiLayer, before);
    this.gold.set(this.state.gold, true);
    await this.dlg.play(PROLOGUE_DIALOGUES.chest_loot, this.state.heroName);
    if (!this.scene.isActive()) return;
    this.objective.set(objectiveFor(this.state));
    this.busy = false;
    this.saveProgress();
  }

  private leaveCabin(): void {
    if (this.leaving) return;
    if (!atLeast(this.state, 'chest_looted')) {
      this.box.show('Не уйду с пустыми руками. Сначала осмотрю каюту.');
      return;
    }
    this.leaving = true;
    this.busy = true;
    this.cancelTravel();
    this.player.stop();
    advancePrologue(this.state, 'morning');
    setLocation('DeckScene', MORNING_DECK_START.x, MORNING_DECK_START.y);
    void autosave();
    fadeToScene(this, 'DeckScene');
  }

  // ───────────── Сохранение и ввод ─────────────

  private savedStart(): Point | null {
    const loc = this.state.location;
    if (!loc || loc.scene !== 'CabinScene') return null;
    if (!Number.isFinite(loc.x) || !Number.isFinite(loc.y)) return null;
    if (!pointClear(this.nav, loc.x, loc.y, BODY_RADIUS)) return null;
    return { x: loc.x, y: loc.y };
  }

  private saveProgress(): void {
    if (this.leaving) return;
    setLocation('CabinScene', this.player.x, this.player.y);
    void autosave();
  }

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') this.saveProgress();
  };

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
    // Бой, диалог и панель добычи сами разбирают касания.
    if (this.combat?.attached || this.dlg.isOpen || this.loot.isOpen) return;
    if (this.box.isOpen) {
      this.box.hide();
      this.ignoredPointerId = p.id;
      return;
    }
    if (this.busy || this.scriptResolve) return;
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

  private registerInteractables(): void {
    const say = (text: string) => (): void => {
      this.box.show(text);
      this.saveProgress();
    };
    const reg = (id: string, x: number, y: number, prompt: string, onInteract: () => void, radius = 26): void =>
      this.interaction.register({ id, x, y, tapRadius: 18, radius, prompt, promptOffsetY: 18, onInteract });
    reg('desk', 5.5 * T, 3.5 * T, 'Осмотреть стол', say('Карты, расчёты и бутылка рома. Капитан всегда доверял бутылке больше, чем людям.'));
    reg('bed', 1.5 * T, 4 * T, 'Осмотреть кровать', say('Кровать капитана. Мягкая. Единственное, что здесь не колется.'));
    reg('wardrobe', 10 * T, 3.2 * T, 'Осмотреть шкаф', say('Шкаф. Камзолы один другого нелепее. Брать нечего.'));
    reg('chest', 10.5 * T, 7.5 * T, 'Сундук капитана', () => void this.openChest());
    reg('door', 6 * T, 20.4 * T, 'Выход на палубу', () => this.leaveCabin(), 30);
  }
}
