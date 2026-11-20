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
