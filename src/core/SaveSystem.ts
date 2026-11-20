import type { GameState } from './GameState';

/** Minimal async key-value storage. */
export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface SaveEnvelope {
  saveVersion: number;
  savedAt: string;
  appVersion: string;
  state: GameState;
}

/** Migration from saveVersion `from` to `from + 1`; receives and returns the raw state. */
export interface Migration {
  from: number;
  migrate: (state: unknown) => unknown;
}

export const CURRENT_SAVE_VERSION = 1;

/** Ordered list of vN -> vN+1 migrations. Empty while CURRENT_SAVE_VERSION is 1. */
export const MIGRATIONS: Migration[] = [];

export const SAVE_KEY_PREFIX = 'unbound.save.';

/** Default adapter: Capacitor Preferences (Android SharedPreferences; localStorage in browser). */
export function createPreferencesAdapter(): StorageAdapter {
  const prefs = () => import('@capacitor/preferences').then((m) => m.Preferences);
  return {
    async get(key) {
      return (await (await prefs()).get({ key })).value;
    },
    async set(key, value) {
      await (await prefs()).set({ key, value });
    },
    async remove(key) {
      await (await prefs()).remove({ key });
    },
  };
}

export class MemoryStorageAdapter implements StorageAdapter {
  readonly data = new Map<string, string>();
  async get(key: string) {
    return this.data.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.data.set(key, value);
  }
  async remove(key: string) {
    this.data.delete(key);
  }
}

export interface SaveSystemOptions {
  adapter?: StorageAdapter;
  currentVersion?: number;
  migrations?: Migration[];
  appVersion?: string;
  now?: () => Date;
  warn?: (message: string) => void;
}

function defaultAppVersion(): string {
  return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'unknown';
}

export class SaveSystem {
  private adapter: StorageAdapter;
  private currentVersion: number;
  private migrations: Migration[];
  private appVersion: string;
  private now: () => Date;
  private warn: (message: string) => void;

  constructor(opts: SaveSystemOptions = {}) {
    this.adapter = opts.adapter ?? createPreferencesAdapter();
    this.currentVersion = opts.currentVersion ?? CURRENT_SAVE_VERSION;
    this.migrations = opts.migrations ?? MIGRATIONS;
    this.appVersion = opts.appVersion ?? defaultAppVersion();
    this.now = opts.now ?? (() => new Date());
    this.warn = opts.warn ?? ((m) => console.warn(m));
  }

  static slotKey(slot: number | string): string {
    return `${SAVE_KEY_PREFIX}slot${slot}`;
  }

  /** Returns false if the save was refused or storage failed. Never throws. */
  async save(slot: number | string, state: GameState): Promise<boolean> {
    const key = SaveSystem.slotKey(slot);
    try {
      const existing = await this.adapter.get(key);
      if (existing !== null) {
        const v = this.peekVersion(existing);
        if (v !== null && v > this.currentVersion) {
          this.warn(`SaveSystem: slot ${slot} holds saveVersion ${v} > supported ${this.currentVersion}; not overwriting`);
          return false;
        }
      }
      const envelope: SaveEnvelope = {
        saveVersion: this.currentVersion,
        savedAt: this.now().toISOString(),
        appVersion: this.appVersion,
        state,
      };
      await this.adapter.set(key, JSON.stringify(envelope));
      return true;
    } catch (e) {
      this.warn(`SaveSystem: save failed for slot ${slot}: ${String(e)}`);
      return false;
    }
  }

  /** Returns the state, or null if absent, corrupt or from a newer version. Never throws. */
  async load(slot: number | string): Promise<GameState | null> {
    const key = SaveSystem.slotKey(slot);
    try {
      const raw = await this.adapter.get(key);
      if (raw === null) return null;

      let env: SaveEnvelope;
      try {
        env = JSON.parse(raw) as SaveEnvelope;
        if (
          env === null ||
          typeof env !== 'object' ||
          typeof env.saveVersion !== 'number' ||
          typeof env.state !== 'object' ||
          env.state === null
        ) {
          throw new Error('invalid envelope');
        }
      } catch {
        await this.adapter.set(`${key}.corrupt`, raw);
        this.warn(`SaveSystem: slot ${slot} is corrupt; raw data kept under ${key}.corrupt`);
        return null;
      }

      if (env.saveVersion > this.currentVersion) {
        this.warn(`SaveSystem: slot ${slot} has saveVersion ${env.saveVersion} > supported ${this.currentVersion}; ignoring`);
        return null;
      }

      if (env.saveVersion < this.currentVersion) {
        return await this.migrateAndStore(key, slot, raw, env);
      }
      return env.state;
    } catch (e) {
      this.warn(`SaveSystem: load failed for slot ${slot}: ${String(e)}`);
      return null;
    }
  }

  async hasSave(slot: number | string): Promise<boolean> {
    try {
      return (await this.adapter.get(SaveSystem.slotKey(slot))) !== null;
    } catch {
      return false;
    }
  }

  async deleteSave(slot: number | string): Promise<void> {
    try {
      await this.adapter.remove(SaveSystem.slotKey(slot));
    } catch (e) {
      this.warn(`SaveSystem: delete failed for slot ${slot}: ${String(e)}`);
    }
  }

  private peekVersion(raw: string): number | null {
    try {
      const v = (JSON.parse(raw) as { saveVersion?: unknown }).saveVersion;
      return typeof v === 'number' ? v : null;
    } catch {
      return null;
    }
  }

  private async migrateAndStore(
    key: string,
    slot: number | string,
    raw: string,
    env: SaveEnvelope,
  ): Promise<GameState | null> {
    // Back up the untouched original before any migration runs.
    await this.adapter.set(`${key}.backup.v${env.saveVersion}`, raw);

    let state: unknown = env.state;
    for (let v = env.saveVersion; v < this.currentVersion; v++) {
      const m = this.migrations.find((x) => x.from === v);
      if (!m) {
        this.warn(`SaveSystem: no migration from v${v} for slot ${slot}; ignoring save`);
        return null;
      }
      state = m.migrate(state);
    }
    const migrated: SaveEnvelope = {
      saveVersion: this.currentVersion,
      savedAt: env.savedAt,
      appVersion: this.appVersion,
      state: state as GameState,
    };
    await this.adapter.set(key, JSON.stringify(migrated));
    return migrated.state;
  }
}
