import type { EnemyId } from '../../data/enemies';

/** События боя (подписываются обучение, схватка, сцена). */
export interface CombatEvents {
  /** Враг начал замах (первый удар серии — index 0). */
  'enemy-windup': [id: EnemyId, index: number];
  /** Враг сбит с замаха. */
  'enemy-stagger': [id: EnemyId];
  /** Враг вырублен/убит. */
  'enemy-down': [id: EnemyId];
  /** Героиня начала уклонение (свайп принят). */
  dodge: [];
  /** Уклонение удалось: удар врага пришёл мимо или поглощён неуязвимостью. */
  'dodge-success': [];
  /** Героиня ударила саблей. */
  attack: [];
  'heroine-hit': [hp: number];
  'heroine-down': [];
}
