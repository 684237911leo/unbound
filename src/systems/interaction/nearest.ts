// Чистая логика выбора ближайшего объекта (без Phaser).

export interface Spot {
  x: number;
  y: number;
  /** Радиус срабатывания. */
  radius: number;
}

/** Ближайший объект, в радиус которого попадает точка (px, py); при равенстве побеждает первый. */
export function findNearest<T extends Spot>(items: readonly T[], px: number, py: number): T | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const item of items) {
    const d = Math.hypot(item.x - px, item.y - py);
    if (d <= item.radius && d < bestDist) {
      best = item;
      bestDist = d;
    }
  }
  return best;
}

export interface Tappable extends Spot {
  /** Радиус касания по объекту (px мира); по умолчанию DEFAULT_TAP_RADIUS. */
  tapRadius?: number;
}

export const DEFAULT_TAP_RADIUS = 16;

/** Объект под касанием (wx, wy): ближайший, чей радиус касания накрывает точку. */
export function findTapped<T extends Tappable>(items: readonly T[], wx: number, wy: number): T | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const item of items) {
    const d = Math.hypot(item.x - wx, item.y - wy);
    if (d <= (item.tapRadius ?? DEFAULT_TAP_RADIUS) && d < bestDist) {
      best = item;
      bestDist = d;
    }
  }
  return best;
}
