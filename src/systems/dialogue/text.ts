// Чистые помощники диалогов (без Phaser): подстановка имени, подпись, скорость печати.
import { SPEAKERS } from '../../data/speakers';
import type { DialogueLine, SpeakerId } from './types';

export const NAME_PLACEHOLDER = '{name}';
/** Подпись героини, если имя ещё не введено. */
export const FALLBACK_HERO_NAME = 'Героиня';
/** Скорость печати, символов в секунду. */
export const TYPE_SPEED_CPS = 40;

/** Заменяет все {name} на имя героини. */
export function substituteName(text: string, heroName: string): string {
  return text.split(NAME_PLACEHOLDER).join(heroName);
}

/** Подпись говорящего для плашки; null — плашку не показывать. */
export function resolveSpeakerLabel(speaker: SpeakerId, heroName: string): string | null {
  const template = SPEAKERS[speaker].label;
  if (template === null) return null;
  const name = heroName.trim() === '' ? FALLBACK_HERO_NAME : heroName.trim();
  return substituteName(template, name);
}

export interface ResolvedLine {
  speaker: SpeakerId;
  label: string | null;
  text: string;
}

/** Реплика с подставленным именем и подписью — то, что рисует DialogueBox. */
export function resolveLine(line: DialogueLine, heroName: string): ResolvedLine {
  return {
    speaker: line.speaker,
    label: resolveSpeakerLabel(line.speaker, heroName),
    text: substituteName(line.text, heroName),
  };
}

/**
 * Сколько символов открыто после прошедшего времени. Возвращает дробное значение,
 * видимый префикс — floor(значения). Не выходит за total.
 */
export function nextReveal(revealed: number, deltaMs: number, total: number): number {
  if (revealed >= total) return total;
  return Math.min(total, revealed + (deltaMs * TYPE_SPEED_CPS) / 1000);
}
