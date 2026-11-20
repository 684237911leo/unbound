// Прогресс пролога «Последний приказ»: цепочка шагов, выдача награды, цель. Без Phaser, тестируется отдельно.
// Хранится в GameState.quests.prologue (step — индекс в PROLOGUE_STEPS) и GameState.flags.

import { CHEST_GOLD, CHEST_ITEMS } from '../data/items';
import type { GameState } from './GameState';

export const PROLOGUE_STEPS = ['deck', 'cabin', 'cabin_fight_won', 'chest_looted', 'morning', 'done'] as const;
export type PrologueStep = (typeof PROLOGUE_STEPS)[number];

export const PROLOGUE_QUEST = 'prologue';

export const FLAGS = {
  /** Матрос на палубе уже передал приказ капитана (сцена 1 сыграна). */
  summonsDone: 'prologue.summons_done',
  /** Сундук капитана опустошён (награда выдана). */
  chestLooted: 'prologue.chest_looted',
  /** Утренний разговор с матросом сыгран. */
  morningTalkDone: 'prologue.morning_talk_done',
} as const;

export function stepIndex(step: PrologueStep): number {
  return PROLOGUE_STEPS.indexOf(step);
}

export function getPrologueStep(state: GameState): PrologueStep {
  const q = state.quests[PROLOGUE_QUEST];
  const i = q?.step;
  if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= PROLOGUE_STEPS.length) return 'deck';
  return PROLOGUE_STEPS[i];
}

export function atLeast(state: GameState, step: PrologueStep): boolean {
  return stepIndex(getPrologueStep(state)) >= stepIndex(step);
}

/** Переводит шаг вперёд. Назад не идёт (повторный вызов безопасен). Возвращает true, если шаг изменился. */
export function advancePrologue(state: GameState, step: PrologueStep): boolean {
  if (stepIndex(step) <= stepIndex(getPrologueStep(state)) && state.quests[PROLOGUE_QUEST]) return false;
  state.quests[PROLOGUE_QUEST] = { status: step === 'done' ? 'done' : 'active', step: stepIndex(step) };
  return true;
}

export function hasFlag(state: GameState, key: string): boolean {
  return state.flags[key] === true;
}

export function setFlag(state: GameState, key: string): void {
  state.flags[key] = true;
}

/** Какая сцена продолжает игру с этого состояния. */
export function sceneForState(state: GameState): string {
  switch (getPrologueStep(state)) {
    case 'deck':
    case 'morning':
      return 'DeckScene';
    case 'cabin':
    case 'cabin_fight_won':
    case 'chest_looted':
      return 'CabinScene';
    case 'done':
      return 'EndCardScene';
  }
}

export function addItem(state: GameState, itemId: string, qty: number): void {
  const row = state.inventory.find((i) => i.itemId === itemId);
  if (row) row.qty += qty;
  else state.inventory.push({ itemId, qty });
}

export function itemCount(state: GameState, itemId: string): number {
  return state.inventory.find((i) => i.itemId === itemId)?.qty ?? 0;
}

/**
 * Выдаёт содержимое сундука капитана: золото, драгоценности, документы, карту.
 * Идемпотентно: повторный вызов (в том числе после загрузки сохранения) ничего не меняет и возвращает false.
 */
export function grantChestLoot(state: GameState): boolean {
  if (hasFlag(state, FLAGS.chestLooted) || atLeast(state, 'chest_looted')) return false;
  state.gold += CHEST_GOLD;
  for (const it of CHEST_ITEMS) addItem(state, it.itemId, it.qty);
  setFlag(state, FLAGS.chestLooted);
  advancePrologue(state, 'chest_looted');
  return true;
}

/** Текущая цель для строки вверху экрана; null — цели нет. */
export function objectiveFor(state: GameState): string | null {
  switch (getPrologueStep(state)) {
    case 'deck':
      return hasFlag(state, FLAGS.summonsDone) ? 'Цель: каюта капитана' : null;
    case 'cabin':
      return null;
    case 'cabin_fight_won':
      return 'Цель: осмотреть каюту';
    case 'chest_looted':
      return 'Цель: выйти на палубу';
    case 'morning':
      return hasFlag(state, FLAGS.morningTalkDone) ? 'Цель: сойти на берег' : null;
    case 'done':
      return null;
  }
}
