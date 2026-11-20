import { describe, it, expect, vi } from 'vitest';
import { SaveSystem, MemoryStorageAdapter, CURRENT_SAVE_VERSION, MIGRATIONS } from '../src/core/SaveSystem';
import { createInitialState } from '../src/core/GameState';

function make(opts: ConstructorParameters<typeof SaveSystem>[0] = {}) {
  const adapter = new MemoryStorageAdapter();
  const warn = vi.fn();
  const sys = new SaveSystem({ adapter, warn, appVersion: 'test', ...opts });
  return { adapter, warn, sys };
}
const KEY = 'unbound.save.slot1';

describe('SaveSystem', () => {
  it('has version 1 and no migrations yet', () => {
    expect(CURRENT_SAVE_VERSION).toBe(1);
    expect(MIGRATIONS).toEqual([]);
  });

  it('round-trips state and writes the envelope', async () => {
    const { sys, adapter } = make({ now: () => new Date('2026-01-02T03:04:05Z') });
    const s = createInitialState();
    s.gold = 42;
    s.inventory.push({ itemId: 'rum', qty: 3 });
    s.location = { scene: 'Port', x: 1, y: 2 };
    expect(await sys.save(1, s)).toBe(true);
    expect(await sys.load(1)).toEqual(s);
    expect(JSON.parse(adapter.data.get(KEY)!)).toEqual({
      saveVersion: 1,
      savedAt: '2026-01-02T03:04:05.000Z',
      appVersion: 'test',
      state: s,
    });
  });

  it('hasSave / deleteSave / empty slot', async () => {
    const { sys } = make();
    expect(await sys.hasSave(1)).toBe(false);
    expect(await sys.load(1)).toBeNull();
    await sys.save(1, createInitialState());
    expect(await sys.hasSave(1)).toBe(true);
    expect(await sys.hasSave(2)).toBe(false);
    await sys.deleteSave(1);
    expect(await sys.hasSave(1)).toBe(false);
  });

  it('corrupt JSON returns null and keeps raw data under .corrupt', async () => {
    const { sys, adapter } = make();
    adapter.data.set(KEY, '{not json');
    expect(await sys.load(1)).toBeNull();
    expect(adapter.data.get(`${KEY}.corrupt`)).toBe('{not json');
  });

  it('structurally invalid envelope is treated as corrupt', async () => {
    const { sys, adapter } = make();
    adapter.data.set(KEY, JSON.stringify({ hello: 1 }));
    expect(await sys.load(1)).toBeNull();
    expect(adapter.data.has(`${KEY}.corrupt`)).toBe(true);
  });

  it('never throws when storage fails', async () => {
    const adapter = new MemoryStorageAdapter();
    adapter.get = async () => {
      throw new Error('boom');
    };
    const warn = vi.fn();
    const sys = new SaveSystem({ adapter, warn });
    expect(await sys.load(1)).toBeNull();
    expect(await sys.save(1, createInitialState())).toBe(false);
    expect(await sys.hasSave(1)).toBe(false);
  });

  it('newer saveVersion: load returns null with warning, save does not overwrite', async () => {
    const { sys, adapter, warn } = make();
    const future = JSON.stringify({ saveVersion: 99, savedAt: 'x', appVersion: 'y', state: createInitialState() });
    adapter.data.set(KEY, future);
    expect(await sys.load(1)).toBeNull();
    expect(warn).toHaveBeenCalled();
    expect(await sys.save(1, createInitialState())).toBe(false);
    expect(adapter.data.get(KEY)).toBe(future);
  });

  describe('migrations', () => {
    const migrations = [
      { from: 0, migrate: (s: unknown) => ({ ...(s as object), gold: (s as { coins: number }).coins }) },
    ];

    it('runs v0 -> v1 migration, backs up original first, stores migrated save', async () => {
      const { sys, adapter } = make({ migrations, currentVersion: 1 });
      const old = JSON.stringify({ saveVersion: 0, savedAt: 't', appVersion: 'old', state: { coins: 7 } });
      adapter.data.set(KEY, old);
      const st = await sys.load(1);
      expect(st).toMatchObject({ gold: 7 });
      expect(adapter.data.get(`${KEY}.backup.v0`)).toBe(old);
      expect(JSON.parse(adapter.data.get(KEY)!).saveVersion).toBe(1);
      expect(await sys.load(1)).toMatchObject({ gold: 7 });
    });

    it('backup is written before migration runs', async () => {
      const { sys, adapter } = make({
        currentVersion: 1,
        migrations: [{ from: 0, migrate: () => { throw new Error('bad'); } }],
      });
      const old = JSON.stringify({ saveVersion: 0, savedAt: 't', appVersion: 'o', state: {} });
      adapter.data.set(KEY, old);
      expect(await sys.load(1)).toBeNull(); // no throw
      expect(adapter.data.get(`${KEY}.backup.v0`)).toBe(old);
      expect(adapter.data.get(KEY)).toBe(old); // original untouched
    });

    it('chains multiple migrations in order', async () => {
      const { sys, adapter } = make({
        currentVersion: 2,
        migrations: [
          { from: 0, migrate: (s) => ({ ...(s as object), a: 1 }) },
          { from: 1, migrate: (s) => ({ ...(s as { a: number }), b: (s as { a: number }).a + 1 }) },
        ],
      });
      adapter.data.set(KEY, JSON.stringify({ saveVersion: 0, savedAt: 't', appVersion: 'o', state: {} }));
      expect(await sys.load(1)).toEqual({ a: 1, b: 2 });
    });

    it('missing migration step returns null with warning', async () => {
      const { sys, adapter, warn } = make({ currentVersion: 1, migrations: [] });
      adapter.data.set(KEY, JSON.stringify({ saveVersion: 0, savedAt: 't', appVersion: 'o', state: {} }));
      expect(await sys.load(1)).toBeNull();
      expect(warn).toHaveBeenCalled();
    });
  });
});
