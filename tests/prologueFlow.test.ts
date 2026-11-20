import { describe, it, expect } from 'vitest';
import { createInitialState, withDefaults, type GameState } from '../src/core/GameState';
import {
  FLAGS,
  PROLOGUE_STEPS,
  advancePrologue,
  getPrologueStep,
  grantChestLoot,
  itemCount,
  objectiveFor,
  sceneForState,
  setFlag,
} from '../src/core/prologue';
import { CHEST_GOLD, CHEST_ITEMS, ITEMS } from '../src/data/items';
import { MemoryStorageAdapter, SaveSystem } from '../src/core/SaveSystem';

describe('шаги пролога', () => {
  it('новая партия начинается с deck', () => {
    expect(getPrologueStep(createInitialState())).toBe('deck');
  });

  it('шаги идут только вперёд', () => {
    const s = createInitialState();
    expect(advancePrologue(s, 'cabin')).toBe(true);
    expect(advancePrologue(s, 'deck')).toBe(false);
    expect(advancePrologue(s, 'cabin')).toBe(false);
    expect(getPrologueStep(s)).toBe('cabin');
    expect(advancePrologue(s, 'morning')).toBe(true);
    expect(getPrologueStep(s)).toBe('morning');
  });

  it('done закрывает квест', () => {
    const s = createInitialState();
    advancePrologue(s, 'done');
    expect(s.quests.prologue).toEqual({ status: 'done', step: PROLOGUE_STEPS.indexOf('done') });
  });

  it('испорченный шаг читается как deck', () => {
    const s = createInitialState();
    s.quests.prologue = { status: 'active', step: 99 };
    expect(getPrologueStep(s)).toBe('deck');
  });

  it('сцена продолжения соответствует шагу', () => {
    const s = createInitialState();
    const expected: Record<string, string> = {
      deck: 'DeckScene',
      cabin: 'CabinScene',
      cabin_fight_won: 'CabinScene',
      chest_looted: 'CabinScene',
      morning: 'DeckScene',
      done: 'EndCardScene',
    };
    for (const step of PROLOGUE_STEPS) {
      advancePrologue(s, step);
      expect(sceneForState(s)).toBe(expected[step]);
    }
  });

  it('цель по шагам', () => {
    const s = createInitialState();
    expect(objectiveFor(s)).toBeNull();
    setFlag(s, FLAGS.summonsDone);
    expect(objectiveFor(s)).toBe('Цель: каюта капитана');
    advancePrologue(s, 'cabin_fight_won');
    expect(objectiveFor(s)).toBe('Цель: осмотреть каюту');
    grantChestLoot(s);
    expect(objectiveFor(s)).toBe('Цель: выйти на палубу');
    advancePrologue(s, 'morning');
    expect(objectiveFor(s)).toBeNull();
    setFlag(s, FLAGS.morningTalkDone);
    expect(objectiveFor(s)).toBe('Цель: сойти на берег');
  });
});

describe('награда из сундука', () => {
  it('выдаёт золото и предметы один раз', () => {
    const s = createInitialState();
    expect(grantChestLoot(s)).toBe(true);
    expect(s.gold).toBe(CHEST_GOLD);
    expect(itemCount(s, 'jewels')).toBe(1);
    expect(itemCount(s, 'captain_documents')).toBe(1);
    expect(itemCount(s, 'sea_chart')).toBe(1);
    expect(getPrologueStep(s)).toBe('chest_looted');
    expect(grantChestLoot(s)).toBe(false);
    expect(s.gold).toBe(CHEST_GOLD);
    expect(s.inventory).toHaveLength(3);
  });

  it('не дублируется после сохранения и загрузки', async () => {
    const sys = new SaveSystem({ adapter: new MemoryStorageAdapter() });
    const s = createInitialState();
    grantChestLoot(s);
    await sys.save(1, s);
    const loaded = (await sys.load(1)) as GameState;
    expect(loaded.gold).toBe(CHEST_GOLD);
    expect(grantChestLoot(loaded)).toBe(false);
    expect(loaded.gold).toBe(CHEST_GOLD);
    expect(sceneForState(loaded)).toBe('CabinScene');
  });

  it('не выдаётся повторно, если шаг уже позже', () => {
    const s = createInitialState();
    advancePrologue(s, 'morning');
    expect(grantChestLoot(s)).toBe(false);
    expect(s.gold).toBe(0);
  });
});

describe('withDefaults', () => {
  it('заполняет отсутствующие поля старого сохранения', () => {
    const old = { heroName: 'Аня', gold: 5 } as unknown as GameState;
    const s = withDefaults(old);
    expect(s.flags).toEqual({});
    expect(s.inventory).toEqual([]);
    expect(s.quests).toEqual({});
    expect(s.gold).toBe(5);
    expect(getPrologueStep(s)).toBe('deck');
  });
});

describe('данные предметов', () => {
  it('id совпадает с ключом, названия и описания заданы', () => {
    for (const [key, it_] of Object.entries(ITEMS)) {
      expect(it_.id).toBe(key);
      expect(it_.name.length).toBeGreaterThan(0);
      expect(it_.description.length).toBeGreaterThan(0);
    }
  });

  it('драгоценности продаются за 60, сюжетные предметы не продаются', () => {
    expect(ITEMS.jewels.sellValue).toBe(60);
    expect(ITEMS.captain_documents.sellValue).toBeNull();
    expect(ITEMS.sea_chart.sellValue).toBeNull();
    expect(ITEMS.captain_documents.questItem).toBe(true);
    expect(ITEMS.sea_chart.questItem).toBe(true);
    expect(ITEMS.jewels.questItem).toBe(false);
  });

  it('сундук: 280 золотых и три предмета из каталога', () => {
    expect(CHEST_GOLD).toBe(280);
    for (const it_ of CHEST_ITEMS) expect(ITEMS[it_.itemId]).toBeDefined();
    expect(CHEST_ITEMS.map((i) => i.itemId).sort()).toEqual(['captain_documents', 'jewels', 'sea_chart']);
  });
});
