// Логика бойцов без Phaser: состояние героини и конечный автомат врага.
// Время — секунды (dt), расстояния — логические px.

import type { AttackDef, EnemyDef, HeroineStats } from '../../data/enemies';

// ───────────────────────────── Героиня ─────────────────────────────

export type HeroineMode = 'idle' | 'strike' | 'dodge' | 'hurt' | 'down';

export type HeroineEvent = { type: 'contact' } | { type: 'strike-end' } | { type: 'dodge-end' } | { type: 'hurt-end' };

export class HeroineState {
  hp: number;
  mode: HeroineMode = 'idle';
  /** Часы боя, с (для «когда был рывок»). */
  clock = 0;
  lastDodgeAt = -Infinity;
  private attackCd = 0;
  private dodgeCd = 0;
  private iframes = 0;
  private modeTimer = 0;
  private contactPending = false;

  constructor(readonly stats: HeroineStats) {
    this.hp = stats.maxHp;
  }

  get maxHp(): number {
    return this.stats.maxHp;
  }
  get alive(): boolean {
    return this.mode !== 'down';
  }
  get invulnerable(): boolean {
    return this.iframes > 0;
  }
  get canAttack(): boolean {
    return this.mode === 'idle' && this.attackCd <= 0;
  }
  get canDodge(): boolean {
    return (this.mode === 'idle' || this.mode === 'strike') && this.dodgeCd <= 0;
  }
  get dodgeCooldownLeft(): number {
    return Math.max(0, this.dodgeCd);
  }
  get attackCooldownLeft(): number {
    return Math.max(0, this.attackCd);
  }
  /** Можно ли двигаться (ходьба). */
  get canWalk(): boolean {
    return this.mode === 'idle';
  }

  reset(): void {
    this.hp = this.stats.maxHp;
    this.mode = 'idle';
    this.attackCd = 0;
    this.dodgeCd = 0;
    this.iframes = 0;
    this.modeTimer = 0;
    this.contactPending = false;
    this.lastDodgeAt = -Infinity;
  }

  heal(n: number): void {
    if (this.alive) this.hp = Math.min(this.stats.maxHp, this.hp + n);
  }

  startAttack(): boolean {
    if (!this.canAttack) return false;
    this.mode = 'strike';
    this.modeTimer = this.stats.strikeTime;
    this.attackCd = this.stats.attackCooldown;
    this.contactPending = true;
    return true;
  }

  startDodge(): boolean {
    if (!this.canDodge) return false;
    this.mode = 'dodge';
    this.modeTimer = this.stats.dodgeTime;
    this.dodgeCd = this.stats.dodgeCooldown;
    this.iframes = Math.max(this.iframes, this.stats.dodgeIframes);
    this.contactPending = false;
    this.lastDodgeAt = this.clock;
    return true;
  }

  /** Получение удара. `hit` false — поглощён неуязвимостью. */
  takeHit(damage: number): { hit: boolean; dead: boolean } {
    if (!this.alive || this.iframes > 0) return { hit: false, dead: false };
    this.hp = Math.max(0, this.hp - damage);
    this.iframes = this.stats.hurtIframes;
    this.contactPending = false;
    if (this.hp <= 0) {
      this.mode = 'down';
      return { hit: true, dead: true };
    }
    this.mode = 'hurt';
    this.modeTimer = this.stats.hurtTime;
    return { hit: true, dead: false };
  }

  update(dt: number): HeroineEvent[] {
    const ev: HeroineEvent[] = [];
    this.clock += dt;
    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.dodgeCd > 0) this.dodgeCd -= dt;
    if (this.iframes > 0) this.iframes -= dt;
    if (this.mode === 'strike') {
      const elapsed = this.stats.strikeTime - this.modeTimer;
      if (this.contactPending && elapsed + dt >= this.stats.strikeContactAt) {
        this.contactPending = false;
        ev.push({ type: 'contact' });
      }
      this.modeTimer -= dt;
      if (this.modeTimer <= 0) {
        this.mode = 'idle';
        ev.push({ type: 'strike-end' });
      }
    } else if (this.mode === 'dodge') {
      this.modeTimer -= dt;
      if (this.modeTimer <= 0) {
        this.mode = 'idle';
        ev.push({ type: 'dodge-end' });
      }
    } else if (this.mode === 'hurt') {
      this.modeTimer -= dt;
      if (this.modeTimer <= 0) {
        this.mode = 'idle';
        ev.push({ type: 'hurt-end' });
      }
    }
    return ev;
  }
}

// ───────────────────────────── Враг ─────────────────────────────

export type EnemyState = 'idle' | 'approach' | 'windup' | 'strike' | 'recover' | 'stagger' | 'down';

export type BrainEvent =
  | { type: 'windup'; attack: AttackDef; index: number; total: number }
  | { type: 'strike'; attack: AttackDef; index: number; total: number }
  | { type: 'strike-end'; attack: AttackDef; hit: boolean; last: boolean }
  | { type: 'stagger' }
  | { type: 'ko' };

export interface BrainInput {
  /** Расстояние до героини. */
  dist: number;
  targetAlive: boolean;
}

export interface BrainOutput {
  /** Скорость к героине (px/с); 0 — стоять. */
  advance: number;
  events: BrainEvent[];
}

export class EnemyBrain {
  hp: number;
  state: EnemyState = 'idle';
  /** Оставшееся время текущего состояния. */
  timer = 0;
  /** Полная длительность текущего замаха (для индикатора). */
  windupTotal = 0;
  attack: AttackDef | null = null;
  comboIndex = 0;
  comboTotal = 0;
  /** Удар текущей фазы strike уже нанёс урон. */
  strikeHit = false;
  /** Включён ли ИИ (держим врагов на месте, пока шаг обучения их не выпустил). */
  enabled = true;
  /** Нападает ли (пассивный стражник — только после первого удара). */
  aggroed: boolean;
  private rest = 0;
  private immune = 0;
  private nextAttack: AttackDef | null = null;

  constructor(
    readonly def: EnemyDef,
    private readonly rng: () => number = Math.random,
  ) {
    this.hp = def.maxHp;
    this.aggroed = !def.passiveUntilHit;
    this.rest = 0.3;
  }

  get alive(): boolean {
    return this.state !== 'down';
  }
  get windupProgress(): number {
    return this.state === 'windup' && this.windupTotal > 0 ? 1 - this.timer / this.windupTotal : 0;
  }

  private pick(dist: number): AttackDef {
    const options = this.def.attacks.filter((a) => (a.minRange ?? 0) <= dist);
    const pool = options.length ? options : this.def.attacks.filter((a) => a.kind !== 'lunge');
    const total = pool.reduce((s, a) => s + a.weight, 0);
    let r = this.rng() * total;
    for (const a of pool) {
      r -= a.weight;
      if (r <= 0) return a;
    }
    return pool[pool.length - 1];
  }

  private beginWindup(duration: number, ev: BrainEvent[]): void {
    this.state = 'windup';
    this.timer = duration;
    this.windupTotal = duration;
    ev.push({ type: 'windup', attack: this.attack!, index: this.comboIndex, total: this.comboTotal });
  }

  /** Попадание по врагу. `staggered` — замах сбит. */
  takeHit(damage: number): { applied: boolean; staggered: boolean; ko: boolean } {
    if (this.state === 'down') return { applied: false, staggered: false, ko: false };
    this.hp = Math.max(0, this.hp - damage);
    this.aggroed = true;
    if (this.hp <= 0) {
      this.state = 'down';
      this.attack = null;
      return { applied: true, staggered: false, ko: true };
    }
    if (this.state === 'windup' && this.immune <= 0) {
      this.state = 'stagger';
      this.timer = this.def.staggerTime;
      this.attack = null;
      this.immune = this.def.staggerImmunity;
      return { applied: true, staggered: true, ko: false };
    }
    if (this.state === 'idle' || this.state === 'approach') {
      this.state = 'stagger';
      this.timer = this.def.flinchTime;
      this.nextAttack = null;
    }
    return { applied: true, staggered: false, ko: false };
  }

  /** Отметить, что текущий удар попал (один урон за удар). */
  markStrikeHit(): void {
    this.strikeHit = true;
  }

  update(dt: number, input: BrainInput): BrainOutput {
    const ev: BrainEvent[] = [];
    let advance = 0;
    if (this.state === 'down') return { advance, events: ev };
    if (this.immune > 0) this.immune -= dt;
    if (!this.enabled) return { advance, events: ev };

    switch (this.state) {
      case 'idle': {
        if (!this.aggroed || !input.targetAlive) break;
        this.rest -= dt;
        if (this.rest <= 0) this.state = 'approach';
        break;
      }
      case 'approach': {
        if (!input.targetAlive) {
          this.state = 'idle';
          break;
        }
        if (!this.nextAttack || input.dist < (this.nextAttack.minRange ?? 0)) this.nextAttack = this.pick(input.dist);
        const a = this.nextAttack;
        if (input.dist <= a.startRange) {
          this.attack = a;
          this.nextAttack = null;
          this.comboIndex = 0;
          this.comboTotal = a.hits[0] + Math.floor(this.rng() * (a.hits[1] - a.hits[0] + 1));
          this.beginWindup(a.windup, ev);
        } else {
          advance = this.def.speed;
        }
        break;
      }
      case 'windup': {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.state = 'strike';
          this.timer = this.attack!.active;
          this.strikeHit = false;
          ev.push({ type: 'strike', attack: this.attack!, index: this.comboIndex, total: this.comboTotal });
        }
        break;
      }
      case 'strike': {
        const a = this.attack!;
        advance = a.advanceSpeed;
        this.timer -= dt;
        if (this.timer <= 0) {
          const last = this.comboIndex + 1 >= this.comboTotal;
          ev.push({ type: 'strike-end', attack: a, hit: this.strikeHit, last });
          if (last) {
            this.state = 'recover';
            this.timer = a.recover;
            advance = 0;
          } else {
            this.comboIndex++;
            this.beginWindup(a.followWindup, ev);
            advance = 0;
          }
        }
        break;
      }
      case 'recover': {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.state = 'idle';
          this.attack = null;
          this.rest = this.def.restMin + this.rng() * (this.def.restMax - this.def.restMin);
        }
        break;
      }
      case 'stagger': {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.state = 'idle';
          this.rest = this.def.restMin * 0.5;
        }
        break;
      }
    }
    return { advance, events: ev };
  }
}
