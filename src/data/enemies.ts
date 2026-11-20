// Данные боя: статы героини и определения врагов. Баланс правится только здесь.
// Единицы: расстояния — логические px (тайл = 16), время — секунды, скорость — px/с.

import { CAPTAIN, GUARD_A, GUARD_B, type FrameRef } from './tiles';

export type EnemyId = 'guard_tutorial_1' | 'guard_tutorial_2' | 'captain';

export interface HeroineStats {
  maxHp: number;
  damage: number;
  /** Дальность сабли (между «ногами»). */
  reach: number;
  /** Дуга удара, градусы (поражаются все враги в дуге). */
  arcDeg: number;
  /** Перезарядка удара с момента начала. */
  attackCooldown: number;
  /** Длительность взмаха и момент попадания внутри него. */
  strikeTime: number;
  strikeContactAt: number;
  /** Рывок-уклонение. */
  dodgeDistance: number;
  dodgeTime: number;
  dodgeCooldown: number;
  /** Неуязвимость с начала рывка. */
  dodgeIframes: number;
  /** Оглушение после попадания и неуязвимость после него. */
  hurtTime: number;
  hurtIframes: number;
}

export const HEROINE_STATS: HeroineStats = {
  maxHp: 6,
  damage: 1,
  reach: 24,
  arcDeg: 150,
  attackCooldown: 0.5,
  strikeTime: 0.14,
  strikeContactAt: 0.07,
  dodgeDistance: 46,
  dodgeTime: 0.18,
  dodgeCooldown: 0.8,
  dodgeIframes: 0.3,
  hurtTime: 0.22,
  hurtIframes: 0.3,
};

export interface AttackDef {
  id: string;
  kind: 'light' | 'heavy' | 'lunge';
  /** Предупреждение (замах) перед первым ударом. */
  windup: number;
  /** Замах следующих ударов серии (быстрее). */
  followWindup: number;
  /** Количество ударов в серии [мин, макс]. */
  hits: [number, number];
  /** Длительность активной фазы удара. */
  active: number;
  /** Скорость шага вперёд во время удара (px/с). Для рывка — скорость рывка. */
  advanceSpeed: number;
  damage: number;
  /** Дальность поражения. */
  reach: number;
  /** С какой дистанции враг начинает замах. */
  startRange: number;
  /** Не выбирать атаку, если героиня ближе этого. */
  minRange?: number;
  /** Пауза после серии — окно для контратаки. */
  recover: number;
  /** Вес при случайном выборе. */
  weight: number;
  /** Сильная встряска камеры при попадании. */
  heavyShake?: boolean;
}

export interface EnemyDef {
  id: EnemyId;
  name: string;
  sprite: FrameRef;
  maxHp: number;
  speed: number;
  /** Не нападает, пока по нему не ударят. */
  passiveUntilHit: boolean;
  attacks: AttackDef[];
  /** Пауза между сериями (случайно в диапазоне). */
  restMin: number;
  restMax: number;
  /** Оглушение, когда удар пришёлся на замах. */
  staggerTime: number;
  /** После оглушения замах нельзя сбить ещё столько секунд (против «стан-лока»). */
  staggerImmunity: number;
  /** Короткая реакция на удар вне замаха. */
  flinchTime: number;
  /** Радиус тапа по врагу (px мира). */
  tapRadius: number;
  /** true — погибает (капитан), false — оглушён/вырублен (стражники). */
  fatal: boolean;
}

const guardLight = (over: Partial<AttackDef>): AttackDef => ({
  id: 'guard_swing',
  kind: 'light',
  windup: 0.9,
  followWindup: 0.9,
  hits: [1, 1],
  active: 0.14,
  advanceSpeed: 60,
  damage: 1,
  reach: 22,
  startRange: 20,
  recover: 1.0,
  weight: 1,
  ...over,
});

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  // Слабый, пассивный до первого удара, потом лениво отвечает.
  guard_tutorial_1: {
    id: 'guard_tutorial_1',
    name: 'Стражник',
    sprite: GUARD_A,
    maxHp: 2,
    speed: 30,
    passiveUntilHit: true,
    attacks: [guardLight({ windup: 1.0, recover: 1.2 })],
    restMin: 1.0,
    restMax: 1.5,
    staggerTime: 0.6,
    staggerImmunity: 0.5,
    flinchTime: 0.35,
    tapRadius: 13,
    fatal: false,
  },
  // Медленный, заметный замах: учит уклонению.
  guard_tutorial_2: {
    id: 'guard_tutorial_2',
    name: 'Стражник',
    sprite: GUARD_B,
    maxHp: 3,
    speed: 34,
    passiveUntilHit: false,
    attacks: [guardLight({ windup: 1.0, recover: 1.0 })],
    restMin: 0.9,
    restMax: 1.4,
    staggerTime: 0.6,
    staggerImmunity: 0.5,
    flinchTime: 0.3,
    tapRadius: 13,
    fatal: false,
  },
  // Опытный боец: серии из 2–3 быстрых ударов, тяжёлый замах, рывок.
  captain: {
    id: 'captain',
    name: 'Капитан',
    sprite: CAPTAIN,
    maxHp: 12,
    speed: 58,
    passiveUntilHit: false,
    attacks: [
      {
        id: 'combo',
        kind: 'light',
        windup: 0.55,
        followWindup: 0.28,
        hits: [2, 3],
        active: 0.12,
        advanceSpeed: 95,
        damage: 1,
        reach: 24,
        startRange: 22,
        recover: 0.8,
        weight: 0.4,
      },
      {
        id: 'heavy',
        kind: 'heavy',
        windup: 1.1,
        followWindup: 1.1,
        hits: [1, 1],
        active: 0.16,
        advanceSpeed: 45,
        damage: 2,
        reach: 28,
        startRange: 24,
        recover: 1.0,
        weight: 0.35,
        heavyShake: true,
      },
      {
        id: 'lunge',
        kind: 'lunge',
        windup: 0.7,
        followWindup: 0.7,
        hits: [1, 1],
        active: 0.22,
        advanceSpeed: 210,
        damage: 1,
        reach: 20,
        startRange: 85,
        minRange: 48,
        recover: 0.9,
        weight: 0.25,
      },
    ],
    restMin: 0.25,
    restMax: 0.55,
    staggerTime: 0.5,
    staggerImmunity: 2.0,
    flinchTime: 0.15,
    tapRadius: 14,
    fatal: true,
  },
};
