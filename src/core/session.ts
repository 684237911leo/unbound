import { type GameState, createInitialState } from './GameState';
import { SaveSystem } from './SaveSystem';

/** Единственный слот ручного и автосохранения. */
export const SAVE_SLOT = 1;

/** Одна общая копия SaveSystem на приложение. */
const saves = new SaveSystem();

/** Текущая партия в памяти; null, пока игра не начата или не загружена. */
let current: GameState | null = null;

/** Запись идёт по очереди: два автосохранения не перемешиваются. */
let writeChain: Promise<unknown> = Promise.resolve();

export function getState(): GameState | null {
  return current;
}

/** Начинает новую партию в памяти. На диск пишет вызывающий через autosave(). */
export function newGame(name: string): GameState {
  const state = createInitialState();
  state.heroName = name;
  current = state;
  return state;
}

/** Загружает слот 1 в память. Возвращает null, если сохранения нет или оно не читается. */
export async function continueGame(): Promise<GameState | null> {
  const loaded = await saves.load(SAVE_SLOT);
  current = loaded;
  return loaded;
}

export async function hasSave(): Promise<boolean> {
  return saves.hasSave(SAVE_SLOT);
}

/** Пишет текущую партию в слот 1. false, если партии нет или запись не удалась. */
export function autosave(): Promise<boolean> {
  const job = writeChain.then(async () => {
    if (!current) return false;
    return saves.save(SAVE_SLOT, current);
  });
  writeChain = job.catch(() => false);
  return job;
}

/** Запоминает положение героини в текущей партии (без записи на диск). */
export function setLocation(scene: string, x: number, y: number): void {
  if (current) current.location = { scene, x, y };
}
