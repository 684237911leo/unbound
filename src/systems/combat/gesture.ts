// Классификация жестов боя (без Phaser): тап / свайп / удержание. Координаты — логические px, время — мс.

/** Свайп: палец сместился дальше этого порога (логических px)... */
export const SWIPE_MIN_DIST = 24;
/** ...быстрее этого времени (мс). */
export const SWIPE_MAX_MS = 250;
/** Касание без смещения дольше этого времени — удержание (палец ведёт героиню). */
export const HOLD_MIN_MS = 350;

export interface PointerSample {
  x: number;
  y: number;
  /** Время, мс. */
  t: number;
}

export type Gesture =
  | { kind: 'tap' }
  | { kind: 'hold' }
  | { kind: 'swipe'; dir: { x: number; y: number }; distance: number };

function swipeOf(dx: number, dy: number): Gesture {
  const d = Math.hypot(dx, dy);
  return { kind: 'swipe', dir: { x: dx / d, y: dy / d }, distance: d };
}

/** Итоговая классификация по точкам нажатия и отпускания. */
export function classifyGesture(down: PointerSample, up: PointerSample): Gesture {
  const dx = up.x - down.x;
  const dy = up.y - down.y;
  const dist = Math.hypot(dx, dy);
  const dur = up.t - down.t;
  if (dist > SWIPE_MIN_DIST && dur < SWIPE_MAX_MS) return swipeOf(dx, dy);
  if (dist > SWIPE_MIN_DIST) return { kind: 'hold' }; // медленное перетаскивание
  return dur >= HOLD_MIN_MS ? { kind: 'hold' } : { kind: 'tap' };
}

/**
 * Следит за несколькими указателями. `move` возвращает свайп сразу, как только порог пройден
 * (не дожидаясь отпускания), `end` — итог жеста или null, если свайп уже выдан.
 */
export class GestureTracker {
  private readonly active = new Map<number, { start: PointerSample; fired: boolean }>();

  begin(id: number, s: PointerSample): void {
    this.active.set(id, { start: s, fired: false });
  }

  start(id: number): PointerSample | null {
    return this.active.get(id)?.start ?? null;
  }

  /** Свайп, если он только что распознан по движению. */
  move(id: number, s: PointerSample): Gesture | null {
    const a = this.active.get(id);
    if (!a || a.fired) return null;
    const dx = s.x - a.start.x;
    const dy = s.y - a.start.y;
    if (s.t - a.start.t >= SWIPE_MAX_MS) return null;
    if (Math.hypot(dx, dy) <= SWIPE_MIN_DIST) return null;
    a.fired = true;
    return swipeOf(dx, dy);
  }

  /** Жест при отпускании; null — если указатель неизвестен или свайп уже был выдан в `move`. */
  end(id: number, s: PointerSample): Gesture | null {
    const a = this.active.get(id);
    this.active.delete(id);
    if (!a || a.fired) return null;
    return classifyGesture(a.start, s);
  }

  /** Свайп уже выдан для этого указателя. */
  fired(id: number): boolean {
    return this.active.get(id)?.fired ?? false;
  }

  reset(): void {
    this.active.clear();
  }
}
