// Plain serializable game state. No logic here.

export interface InventoryItem {
  itemId: string;
  qty: number;
}

export interface QuestProgress {
  status: 'active' | 'done';
  step: number;
}

export interface GameState {
  /** Имя героини, введённое при новой игре. Пустая строка до ввода. */
  heroName: string;
  gold: number;
  flags: Record<string, boolean>;
  inventory: InventoryItem[];
  quests: Record<string, QuestProgress>;
  crew: string[];
  ship: string | null;
  reputation: Record<string, number>;
  discoveredLocations: string[];
  location: { scene: string; x: number; y: number } | null;
}

export function createInitialState(): GameState {
  return {
    heroName: '',
    gold: 0,
    flags: {},
    inventory: [],
    quests: {},
    crew: [],
    ship: null,
    reputation: {},
    discoveredLocations: [],
    location: null,
  };
}

/** Дополняет состояние полями, которых могло не быть в старом сохранении (та же версия формата). */
export function withDefaults(state: GameState): GameState {
  return {
    ...state,
    heroName: typeof state.heroName === 'string' ? state.heroName : '',
  };
}
