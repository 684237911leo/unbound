// Определения схваток. Не зависят от сцены: точки появления задаёт сцена (ROOM_POINTS / CABIN_POINTS).
import type { EncounterDef } from '../systems/combat/encounter';
import { CABIN_TUTORIAL_STEPS } from '../systems/combat/tutorial';

/** Схватка в каюте: стражники (обучение) → капитан, встающий из-за стола. */
export const CABIN_FIGHT: EncounterDef = {
  id: 'cabin_fight',
  heroineStart: 'heroine',
  healBetweenWaves: true,
  waves: [
    {
      enemies: [
        { id: 'guard_tutorial_1', spawn: 'door', stand: 'guard_a' },
        { id: 'guard_tutorial_2', spawn: 'door', stand: 'guard_b' },
      ],
    },
    { enemies: [{ id: 'captain', spawn: 'desk', stand: 'captain' }] },
  ],
  tutorial: CABIN_TUTORIAL_STEPS,
};
