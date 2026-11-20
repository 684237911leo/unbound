// Чистая математика ввода (без Phaser). Джойстика нет: движение — по тапу, клавиатура — для отладки на ПК.

export interface Vec2 {
  x: number;
  y: number;
}

/** Ограничивает длину вектора единицей (диагональ не быстрее прямой). */
export function clampLength(x: number, y: number, max = 1): Vec2 {
  const len = Math.hypot(x, y);
  if (len <= max || len === 0) return { x, y };
  const k = max / len;
  return { x: x * k, y: y * k };
}

/** Клавиши → вектор: противоположные клавиши гасят друг друга, диагональ нормализуется. */
export function keyboardVector(left: boolean, right: boolean, up: boolean, down: boolean): Vec2 {
  const x = (right ? 1 : 0) - (left ? 1 : 0);
  const y = (down ? 1 : 0) - (up ? 1 : 0);
  return clampLength(x, y);
}
