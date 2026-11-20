// Боевой контроллер: сцена подключает его к своей героине, сетке проходимости и слоям.
// Управление (одной рукой): тап по врагу — атака, свайп — рывок-уклонение, тап по полу — ход, удержание — палец ведёт героиню.

import Phaser from 'phaser';
import { ENEMIES, HEROINE_STATS, type EnemyId, type HeroineStats } from '../../data/enemies';
import { CombatHud } from '../../ui/CombatHud';
import { PathFollower } from '../navigation/follower';
import { type NavGrid, type Point, findPath, lineClear } from '../navigation/grid';
import { PLAYER_SPEED, type Player } from '../player/Player';
import { CombatEnemy } from './CombatEnemy';
import { Emitter } from './emitter';
import type { CombatEvents } from './events';
import { type FxContext, afterimages, floatText, hitFlash, hitSpark, saberSwing, slashArc } from './fx';
import { HeroineState } from './fighter';
import { GestureTracker, HOLD_MIN_MS } from './gesture';

export interface CombatHost {
  scene: Phaser.Scene;
  /** Слой мира (камера с зумом). */
  worldLayer: Phaser.GameObjects.Layer;
  /** Слой интерфейса (камера без зума). */
  uiLayer: Phaser.GameObjects.Layer;
  nav: NavGrid;
  /** Статические коллайдеры стен (из той же сетки проходимости). */
  walls: Phaser.Physics.Arcade.StaticGroup;
  /** Героиня сцены (тело + спрайт). */
  player: Player;
  /** Полуширина тела для поиска пути. По умолчанию 5. */
  bodyRadius?: number;
  stats?: HeroineStats;
}

export interface SpawnOptions {
  /** Войти в комнату: дойти до точки, потом включиться. */
  walkTo?: Point;
  /** Держать неактивным (шаг обучения выпустит позже). */
  held?: boolean;
  /** Игнорировать «пассивен до удара» (повторные попытки). */
  aggressive?: boolean;
}

export interface CombatSnapshot {
  heroine: { hp: number; maxHp: number; mode: string; x: number; y: number; frozen: boolean };
  enemies: Array<{ id: EnemyId; state: string; hp: number; x: number; y: number; held: boolean }>;
}

const DRAG_REPATH_MS = 80;
const ENEMY_REPATH_MS = 350;
const KNOCK_SPEED = 120;
const KNOCK_TIME = 0.14;
const MAX_QUEUED_STRIKES = 2;

interface AttackIntent {
  target: CombatEnemy;
  strikes: number;
}

export class CombatController {
  readonly events = new Emitter<CombatEvents>();
  readonly hero: HeroineState;
  readonly enemies: CombatEnemy[] = [];
  readonly hud: CombatHud;

  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly nav: NavGrid;
  private readonly host: CombatHost;
  private readonly radius: number;
  private readonly fx: FxContext;
  private readonly follower = new PathFollower();
  private readonly tracker = new GestureTracker();
  private readonly downEnemy = new Map<number, { enemy: CombatEnemy; t: number }>();
  private intent: AttackIntent | null = null;
  private dragId = -1;
  private dragTimer = 0;
  private lastDrag: Point = { x: -1e9, y: -1e9 };
  private facing: Point = { x: 0, y: 1 };
  private dashDir: Point = { x: 0, y: 0 };
  private knock: Point = { x: 0, y: 0 };
  private knockT = 0;
  private _attached = false;
  private _frozen = false;
  private _swipeOnly = false;
  private _inputEnabled = true;
  private heroCollider: Phaser.Physics.Arcade.Collider | null = null;
  private hitStopT = 0;

  constructor(host: CombatHost) {
    this.host = host;
    this.scene = host.scene;
    this.player = host.player;
    this.nav = host.nav;
    this.radius = host.bodyRadius ?? 5;
    this.hero = new HeroineState(host.stats ?? HEROINE_STATS);
    this.fx = { scene: this.scene, layer: host.worldLayer };
    this.hud = new CombatHud(this.scene, host.uiLayer);
    this.hud.setHp(this.hero.hp, this.hero.maxHp);
  }

  /** Бой управляет героиней: сцена не должна сама обрабатывать касания и ходьбу, пока true. */
  get attached(): boolean {
    return this._attached;
  }
  get frozen(): boolean {
    return this._frozen;
  }

  attach(): void {
    if (this._attached) return;
    this._attached = true;
    const inp = this.scene.input;
    inp.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    inp.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    inp.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    inp.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
  }

  detach(): void {
    if (!this._attached) return;
    this._attached = false;
    const inp = this.scene.input;
    inp.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    inp.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    inp.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    inp.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    this.cancelTravel();
    this.player.stop();
    this.tracker.reset();
    this.downEnemy.clear();
  }

  destroy(): void {
    this.detach();
    this.clearEnemies();
    this.heroCollider?.destroy();
    this.hud.destroy();
    this.events.clear();
  }

  // ───────────── Управление извне (сцена, обучение, энкаунтер) ─────────────

  /** Заморозка боя: время стоит (кроме ввода). */
  freeze(on: boolean): void {
    this._frozen = on;
    if (on) {
      this.player.stop();
      for (const e of this.enemies) e.arcade.setVelocity(0, 0);
    }
  }

  /** Только свайп: тапы и ходьба игнорируются (пауза обучения). */
  setSwipeOnly(on: boolean): void {
    this._swipeOnly = on;
    if (on) this.cancelTravel();
  }

  setInputEnabled(on: boolean): void {
    this._inputEnabled = on;
    if (!on) this.cancelTravel();
  }

  get swipeOnly(): boolean {
    return this._swipeOnly;
  }

  enemyById(id: EnemyId): CombatEnemy | undefined {
    return this.enemies.find((e) => e.id === id);
  }

  aliveEnemies(): CombatEnemy[] {
    return this.enemies.filter((e) => e.alive);
  }

  setHeld(id: EnemyId, held: boolean): void {
    this.enemyById(id)?.setHeld(held);
  }

  spawnEnemy(id: EnemyId, at: Point, opts: SpawnOptions = {}): CombatEnemy {
    const def = ENEMIES[id];
    const e = new CombatEnemy(this.scene, this.host.worldLayer, def, at.x, at.y);
    if (opts.aggressive) e.brain.aggroed = true;
    e.held = opts.held ?? false;
    if (opts.walkTo) {
      const path = findPath(this.nav, at, opts.walkTo, this.radius);
      if (path && path.length) {
        e.follower.set(path, at);
        e.entering = true;
      }
    }
    e.syncEnabled();
    e.colliders.push(this.scene.physics.add.collider(this.player.body, e.body));
    for (const o of this.enemies) if (o.alive) e.colliders.push(this.scene.physics.add.collider(e.body, o.body));
    e.colliders.push(this.scene.physics.add.collider(e.body, this.host.walls));
    this.enemies.push(e);
    return e;
  }

  clearEnemies(): void {
    for (const e of this.enemies) e.destroy();
    this.enemies.length = 0;
    this.intent = null;
    this.downEnemy.clear();
  }

  /** Героиня снова на ногах: полное здоровье, позиция (если задана). */
  resetHeroine(at?: Point): void {
    this.hero.reset();
    this.cancelTravel();
    this.knockT = 0;
    this._frozen = false;
    this._swipeOnly = false;
    this.player.view.setAngle(0).clearTint().setAlpha(1);
    if (at) {
      this.player.arcadeBody.reset(at.x, at.y);
      this.player.body.setPosition(at.x, at.y);
    }
    this.player.stop();
    this.hud.setHp(this.hero.hp, this.hero.maxHp);
  }

  healHeroine(n: number): void {
    this.hero.heal(n);
    this.hud.setHp(this.hero.hp, this.hero.maxHp);
  }

  /** Отладка/тесты: нанести урон героине или врагу без боя. */
  debugDamageHeroine(n: number): void {
    this.damageHeroine(n, { x: this.player.x, y: this.player.y - 1 }, false);
  }
  debugKnockOut(id: EnemyId): void {
    const e = this.enemyById(id);
    if (e && e.alive) this.damageEnemy(e, 999, { x: this.player.x, y: this.player.y });
  }

  snapshot(): CombatSnapshot {
    return {
      heroine: {
        hp: this.hero.hp,
        maxHp: this.hero.maxHp,
        mode: this.hero.mode,
        x: this.player.x,
        y: this.player.y,
        frozen: this._frozen,
      },
      enemies: this.enemies.map((e) => ({
        id: e.id,
        state: e.brain.state,
        hp: e.brain.hp,
        x: e.x,
        y: e.y,
        held: e.held,
      })),
    };
  }

  // ───────────── Ввод ─────────────

  private enemyAtWorld(w: Point): CombatEnemy | null {
    let best: CombatEnemy | null = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(w.x - e.x, w.y - 6 - e.y);
      if (d <= e.def.tapRadius && d < bestD) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  private world(p: Phaser.Input.Pointer): Point {
    const w = this.scene.cameras.main.getWorldPoint(p.x, p.y);
    return { x: w.x, y: w.y };
  }

  private readonly onDown = (p: Phaser.Input.Pointer): void => {
    if (!this._inputEnabled || !this.hero.alive) return;
    const now = performance.now();
    this.tracker.begin(p.id, { x: p.x, y: p.y, t: now });
    if (this._swipeOnly) return;
    const w = this.world(p);
    const enemy = this.enemyAtWorld(w);
    if (enemy) {
      this.downEnemy.set(p.id, { enemy, t: now });
      return;
    }
    // Пол: идём к точке сразу, палец ведёт героиню.
    this.intent = null;
    this.dragId = p.id;
    this.lastDrag = w;
    this.dragTimer = 0;
    this.travelTo(w);
  };

  private readonly onMove = (p: Phaser.Input.Pointer): void => {
    if (!p.isDown) return;
    const g = this.tracker.move(p.id, { x: p.x, y: p.y, t: performance.now() });
    if (g && g.kind === 'swipe') this.swipe(g.dir, p.id);
  };

  private readonly onUp = (p: Phaser.Input.Pointer): void => {
    const g = this.tracker.end(p.id, { x: p.x, y: p.y, t: performance.now() });
    const down = this.downEnemy.get(p.id);
    this.downEnemy.delete(p.id);
    if (p.id === this.dragId) this.dragId = -1;
    if (!g || !this._inputEnabled || !this.hero.alive) return;
    if (g.kind === 'swipe') this.swipe(g.dir, p.id);
    else if (g.kind === 'tap' && down && down.enemy.alive && !this._swipeOnly) this.tapEnemy(down.enemy);
  };

  private tapEnemy(e: CombatEnemy): void {
    if (this.intent && this.intent.target === e) {
      this.intent.strikes = Math.min(MAX_QUEUED_STRIKES, this.intent.strikes + 1);
    } else {
      this.intent = { target: e, strikes: 1 };
    }
    this.dragId = -1;
  }

  private swipe(dir: Point, _pointerId: number): void {
    // Свайп вытесняет ход и атаку.
    this.cancelTravel();
    this.intent = null;
    this.downEnemy.clear();
    this.dodge(dir);
  }

  private cancelTravel(): void {
    this.follower.cancel();
    this.dragId = -1;
    this.intent = null;
  }

  private travelTo(target: Point): void {
    const from = { x: this.player.x, y: this.player.y };
    const path = findPath(this.nav, from, target, this.radius);
    if (!path || path.length === 0) {
      this.follower.cancel();
      return;
    }
    this.follower.set(path, from);
  }

  // ───────────── Действия героини ─────────────

  private dodge(dir: Point): void {
    if (!this.hero.startDodge()) return;
    this.dashDir = { x: dir.x, y: dir.y };
    this.facing = { x: dir.x, y: dir.y };
    const s = this.hero.stats;
    const speed = s.dodgeDistance / s.dodgeTime;
    this.player.arcadeBody.setVelocity(dir.x * speed, dir.y * speed);
    if (Math.abs(dir.x) > 0.1) this.player.view.setFlipX(dir.x < 0);
    this.player.view.setTint(0x9fd0ff);
    afterimages(this.fx, this.player.view, this.player.x, this.player.x + dir.x * s.dodgeDistance, this.player.y + 3, this.player.y + 3 + dir.y * s.dodgeDistance);
    this.events.emit('dodge');
  }

  private strike(target: CombatEnemy): void {
    if (!this.hero.startAttack()) return;
    const dx = target.x - this.player.x;
    const dy = target.y - this.player.y;
    const d = Math.hypot(dx, dy) || 1;
    this.facing = { x: dx / d, y: dy / d };
    if (Math.abs(dx) > 0.5) this.player.view.setFlipX(dx < 0);
    this.player.stop();
    this.follower.cancel();
    const s = this.hero.stats;
    saberSwing(this.fx, this.player.x + this.facing.x * 4, this.player.y, this.facing.x, this.facing.y, s.arcDeg, s.strikeTime * 1000);
    this.events.emit('attack');
  }

  private heroContact(): void {
    const s = this.hero.stats;
    const px = this.player.x;
    const py = this.player.y;
    slashArc(this.fx, px, py, this.facing.x, this.facing.y, s.reach, s.arcDeg);
    const half = Phaser.Math.DegToRad(s.arcDeg / 2);
    const fa = Math.atan2(this.facing.y, this.facing.x);
    for (const e of [...this.enemies]) {
      if (!e.alive) continue;
      const dx = e.x - px;
      const dy = e.y - py;
      const dist = Math.hypot(dx, dy);
      if (dist > s.reach + 3) continue;
      const diff = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - fa));
      if (dist > 6 && diff > half) continue;
      this.damageEnemy(e, s.damage, { x: px, y: py });
    }
  }

  private damageEnemy(e: CombatEnemy, dmg: number, from: Point): void {
    const res = e.brain.takeHit(dmg);
    if (!res.applied) return;
    hitFlash(this.scene, e.view);
    hitSpark(this.fx, e.x, e.y);
    floatText(this.fx, e.x, e.y, `-${Math.min(dmg, e.def.maxHp)}`, '#ffffff');
    const dx = e.x - from.x;
    const dy = e.y - from.y;
    const d = Math.hypot(dx, dy) || 1;
    e.knock = { x: (dx / d) * KNOCK_SPEED, y: (dy / d) * KNOCK_SPEED };
    e.knockT = res.staggered ? KNOCK_TIME * 1.6 : KNOCK_TIME;
    this.hitStopT = 0.05;
    if (res.ko) {
      e.setDown();
      this.intent = this.intent && this.intent.target === e ? null : this.intent;
      this.events.emit('enemy-down', e.id);
    } else if (res.staggered) {
      floatText(this.fx, e.x, e.y - 6, 'Сбит!', '#ffe9a8');
      this.events.emit('enemy-stagger', e.id);
    }
  }

  private damageHeroine(dmg: number, from: Point, heavy: boolean): boolean {
    const res = this.hero.takeHit(dmg);
    if (!res.hit) return false;
    this.hud.setHp(this.hero.hp, this.hero.maxHp);
    this.hud.hurt();
    hitFlash(this.scene, this.player.view, 110);
    hitSpark(this.fx, this.player.x, this.player.y);
    floatText(this.fx, this.player.x, this.player.y, `-${dmg}`, '#ff8a8a');
    const dx = this.player.x - from.x;
    const dy = this.player.y - from.y;
    const d = Math.hypot(dx, dy) || 1;
    this.knock = { x: (dx / d) * 90, y: (dy / d) * 90 };
    this.knockT = this.hero.stats.hurtTime;
    this.cancelTravel();
    this.scene.cameras.main.shake(heavy ? 160 : 70, heavy ? 0.01 : 0.004);
    this.events.emit('heroine-hit', this.hero.hp);
    if (res.dead) {
      this.player.stop();
      this.player.view.setAngle(90).setTint(0xaaaaaa);
      this.events.emit('heroine-down');
    }
    return true;
  }

  // ───────────── Кадр ─────────────

  /** Вызывать из update() сцены каждый кадр (delta — мс). */
  update(time: number, delta: number): void {
    if (!this._attached) return;
    this.hud.setHp(this.hero.hp, this.hero.maxHp);
    const heroPos = { x: this.player.x, y: this.player.y };

    if (this._frozen) {
      this.player.stop();
      for (const e of this.enemies) {
        e.arcade.setVelocity(0, 0);
        e.syncVisual(time, heroPos.x, heroPos.y);
      }
      this.player.update(delta);
      return;
    }

    let dt = Math.min(delta / 1000, 0.05);
    if (this.hitStopT > 0) {
      this.hitStopT -= dt;
      dt *= 0.15;
    }

    // Героиня
    for (const ev of this.hero.update(dt)) {
      if (ev.type === 'contact') this.heroContact();
      if (ev.type === 'dodge-end') {
        this.player.view.clearTint();
        this.player.arcadeBody.setVelocity(0, 0);
      }
    }
    this.driveHeroine(dt, delta);
    this.player.update(delta);
    if (this.hero.mode === 'dodge') this.player.view.setDepth(this.player.y);

    // Удержание на враге → палец ведёт героиню.
    const now = performance.now();
    for (const [id, d] of this.downEnemy) {
      if (now - d.t >= HOLD_MIN_MS && !this.tracker.fired(id)) {
        const p = this.scene.input.manager.pointers.find((q) => q.id === id);
        if (p && p.isDown) {
          this.downEnemy.delete(id);
          this.dragId = id;
          this.lastDrag = { x: -1e9, y: -1e9 };
        }
      }
    }

    // Враги
    for (const e of [...this.enemies]) this.updateEnemy(e, dt, time);
  }

  private driveHeroine(dt: number, delta: number): void {
    const body = this.player.arcadeBody;
    switch (this.hero.mode) {
      case 'dodge': {
        const s = this.hero.stats;
        const speed = s.dodgeDistance / s.dodgeTime;
        body.setVelocity(this.dashDir.x * speed, this.dashDir.y * speed);
        return;
      }
      case 'hurt': {
        const k = Math.max(0, this.knockT / this.hero.stats.hurtTime);
        this.knockT -= dt;
        body.setVelocity(this.knock.x * k, this.knock.y * k);
        return;
      }
      case 'strike':
      case 'down':
        body.setVelocity(0, 0);
        return;
      case 'idle':
        break;
    }

    // Idle: атака по намерению → ход к цели → следование за пальцем.
    const it = this.intent;
    if (it) {
      if (!it.target.alive || it.strikes <= 0) {
        this.intent = null;
      } else {
        const d = Math.hypot(it.target.x - this.player.x, it.target.y - this.player.y);
        const inReach = d <= this.hero.stats.reach * 0.9;
        if (inReach) {
          this.follower.cancel();
          this.player.setMove({ x: 0, y: 0 });
          if (this.hero.canAttack) {
            it.strikes--;
            this.strike(it.target);
            if (it.strikes <= 0) this.intent = null;
          } else {
            const dx = it.target.x - this.player.x;
            if (Math.abs(dx) > 0.5) this.player.view.setFlipX(dx < 0);
          }
          return;
        }
        // Идём к цели: маршрут обновляется, цель движется.
        this.dragTimer += delta;
        if (this.dragTimer >= DRAG_REPATH_MS * 2 || !this.follower.active) {
          this.dragTimer = 0;
          this.travelTo({ x: it.target.x, y: it.target.y });
        }
      }
    }

    this.followFinger(delta);
    const r = this.follower.step({ x: this.player.x, y: this.player.y }, PLAYER_SPEED, dt);
    this.player.setMove(r.move);
  }

  private followFinger(delta: number): void {
    if (this.dragId < 0 || this.intent) return;
    const p = this.scene.input.manager.pointers.find((q) => q.id === this.dragId);
    if (!p || !p.isDown) {
      this.dragId = -1;
      return;
    }
    this.dragTimer += delta;
    if (this.dragTimer < DRAG_REPATH_MS) return;
    const w = this.world(p);
    if (Math.hypot(w.x - this.lastDrag.x, w.y - this.lastDrag.y) < 3) return;
    this.dragTimer = 0;
    this.lastDrag = w;
    this.travelTo(w);
  }

  private updateEnemy(e: CombatEnemy, dt: number, time: number): void {
    const hx = this.player.x;
    const hy = this.player.y;
    const dx = hx - e.x;
    const dy = hy - e.y;
    const dist = Math.hypot(dx, dy);

    if (!e.alive) return;

    // Взгляд на героиню (кроме рывка/удара: направление фиксируется на замахе).
    if (e.brain.state !== 'strike' && dist > 0.5) e.facing = { x: dx / dist, y: dy / dist };

    // Вход в комнату.
    if (e.entering) {
      const r = e.follower.step({ x: e.x, y: e.y }, e.def.speed * 1.4, dt);
      e.arcade.setVelocity(r.move.x * e.def.speed * 1.4, r.move.y * e.def.speed * 1.4);
      if (Math.abs(r.move.x) > 0.01) e.facing = { x: r.move.x, y: e.facing.y };
      if (r.arrived || r.stuck || !e.follower.active) {
        e.entering = false;
        e.arcade.setVelocity(0, 0);
        e.syncEnabled();
      }
      e.syncVisual(time, hx, hy);
      return;
    }

    const out = e.brain.update(dt, { dist, targetAlive: this.hero.alive });
    for (const ev of out.events) {
      if (ev.type === 'windup') {
        e.windupStartAt = this.hero.clock;
        this.events.emit('enemy-windup', e.id, ev.index);
      } else if (ev.type === 'strike-end') {
        if (!ev.hit && this.hero.alive && this.hero.lastDodgeAt >= e.windupStartAt) this.events.emit('dodge-success');
      }
    }

    // Движение: отбрасывание перебивает всё.
    if (e.knockT > 0) {
      const k = e.knockT / KNOCK_TIME;
      e.knockT -= dt;
      e.arcade.setVelocity(e.knock.x * Math.min(1, k), e.knock.y * Math.min(1, k));
    } else if (e.brain.state === 'approach') {
      this.steerEnemy(e, dt, out.advance);
    } else if (e.brain.state === 'strike') {
      e.arcade.setVelocity(e.facing.x * out.advance, e.facing.y * out.advance);
      this.resolveEnemyStrike(e, dist);
    } else {
      e.arcade.setVelocity(0, 0);
    }
    e.syncVisual(time, hx, hy);
  }

  private resolveEnemyStrike(e: CombatEnemy, dist: number): void {
    const a = e.brain.attack;
    if (!a || e.brain.strikeHit || !this.hero.alive) return;
    if (dist > a.reach) return;
    const dodging = this.hero.mode === 'dodge';
    e.brain.markStrikeHit();
    if (this.damageHeroine(a.damage, { x: e.x, y: e.y }, !!a.heavyShake)) return;
    if (dodging) {
      this.events.emit('dodge-success');
      floatText(this.fx, this.player.x, this.player.y, 'Уклон!', '#9fd0ff');
    }
  }

  private steerEnemy(e: CombatEnemy, dt: number, speed: number): void {
    const from = { x: e.x, y: e.y };
    const to = { x: this.player.x, y: this.player.y };
    if (lineClear(this.nav, from, to, this.radius)) {
      e.follower.cancel();
      const d = Math.hypot(to.x - from.x, to.y - from.y) || 1;
      e.arcade.setVelocity(((to.x - from.x) / d) * speed, ((to.y - from.y) / d) * speed);
      return;
    }
    e.repathT -= dt * 1000;
    if (e.repathT <= 0 || !e.follower.active) {
      e.repathT = ENEMY_REPATH_MS;
      const path = findPath(this.nav, from, to, this.radius);
      if (path && path.length) e.follower.set(path, from);
    }
    const r = e.follower.step(from, speed, dt);
    e.arcade.setVelocity(r.move.x * speed, r.move.y * speed);
  }
}
