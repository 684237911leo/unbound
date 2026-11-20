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
  const base = createInitialState();
  const obj = <T extends object>(v: unknown, fallback: T): T =>
    typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as T) : fallback;
  return {
    ...base,
    ...state,
    heroName: typeof state.heroName === 'string' ? state.heroName : '',
    gold: typeof state.gold === 'number' && Number.isFinite(state.gold) ? state.gold : 0,
    flags: obj(state.flags, base.flags),
    inventory: Array.isArray(state.inventory) ? state.inventory : [],
    quests: obj(state.quests, base.quests),
    crew: Array.isArray(state.crew) ? state.crew : [],
    reputation: obj(state.reputation, base.reputation),
    discoveredLocations: Array.isArray(state.discoveredLocations) ? state.discoveredLocations : [],
    location: state.location ?? null,
  };
}
