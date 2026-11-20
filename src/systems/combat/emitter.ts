// Минимальный типизированный эмиттер без Phaser (чтобы логику боя можно было тестировать в node).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (...args: any[]) => void;

export class Emitter<Events extends { [K in keyof Events]: unknown[] }> {
  private readonly handlers = new Map<keyof Events, Set<Handler>>();

  on<K extends keyof Events>(event: K, fn: (...args: Events[K]) => void): () => void {
    let set = this.handlers.get(event);
    if (!set) this.handlers.set(event, (set = new Set()));
    set.add(fn as Handler);
    return () => this.off(event, fn);
  }

  off<K extends keyof Events>(event: K, fn: (...args: Events[K]) => void): void {
    this.handlers.get(event)?.delete(fn as Handler);
  }

  once<K extends keyof Events>(event: K, fn: (...args: Events[K]) => void): () => void {
    const off = this.on(event, ((...args: Events[K]) => {
      off();
      fn(...args);
    }) as (...args: Events[K]) => void);
    return off;
  }

  emit<K extends keyof Events>(event: K, ...args: Events[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const fn of [...set]) (fn as (...a: Events[K]) => void)(...args);
  }

  clear(): void {
    this.handlers.clear();
  }
}
