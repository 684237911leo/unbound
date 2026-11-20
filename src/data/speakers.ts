// Подписи говорящих. Данные без логики; подстановка имени героини — в systems/dialogue/text.ts.
import type { SpeakerId } from '../systems/dialogue/types';

export interface SpeakerInfo {
  /** Подпись на плашке. '{name}' — имя героини. null — без плашки (ремарка). */
  label: string | null;
}

export const SPEAKERS: Record<SpeakerId, SpeakerInfo> = {
  heroine: { label: '{name}' },
  sailor: { label: 'Матрос' },
  captain: { label: 'Капитан' },
  guard: { label: 'Стражник' },
  narrator: { label: null },
};
