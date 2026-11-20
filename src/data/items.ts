// Предметы игры: данные без логики. Золото — не предмет, оно хранится в GameState.gold.

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  /** Цена продажи на рынке; null — не продаётся. */
  sellValue: number | null;
  /** Сюжетный предмет: нельзя продать или выбросить. */
  questItem: boolean;
}

export const ITEMS = {
  jewels: {
    id: 'jewels',
    name: 'Драгоценности',
    description: 'Кольцо и серьги из сундука капитана. На рынке за них дадут около шестидесяти золотых.',
    sellValue: 60,
    questItem: false,
  },
  captain_documents: {
    id: 'captain_documents',
    name: 'Документы капитана',
    description: 'Стопка бумаг, перевязанная шнуром. Сюжетный предмет, не продаётся.',
    sellValue: null,
    questItem: true,
  },
  sea_chart: {
    id: 'sea_chart',
    name: 'Морская карта',
    description: 'Свёрнутая морская карта из сундука капитана. Сюжетный предмет, не продаётся.',
    sellValue: null,
    questItem: true,
  },
} as const satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;

/** Содержимое сундука капитана (GAME_DESIGN.md §6.1). */
export const CHEST_GOLD = 280;
export const CHEST_ITEMS: ReadonlyArray<{ itemId: ItemId; qty: number }> = [
  { itemId: 'jewels', qty: 1 },
  { itemId: 'captain_documents', qty: 1 },
  { itemId: 'sea_chart', qty: 1 },
];
