// Tiny typed event emitter. Intentionally has no Phaser dependency so it can be unit-tested.

export interface GameEvents {
  'gold:changed': { gold: number };
  'flag:set': { key: string; value: boolean };
}

type Listener<T> = (payload: T) => void;

export class EventBus<E = GameEvents> {
  private listeners = new Map<keyof E, Set<Listener<never>>>();

  on<K extends keyof E>(event: K, listener: Listener<E[K]>): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<never>);
  }

  off<K extends keyof E>(event: K, listener: Listener<E[K]>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(listener as Listener<never>);
    if (set.size === 0) this.listeners.delete(event);
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    // Copy so listeners may safely unsubscribe during emit.
    for (const listener of [...set]) {
      (listener as Listener<E[K]>)(payload);
    }
  }
}

export const eventBus = new EventBus<GameEvents>();
