// Эффект ходьбы без кадров анимации: подпрыгивание и лёгкое сплющивание (чистая математика).

export interface BobPose {
  /** Смещение спрайта по Y (отрицательное — вверх). */
  offsetY: number;
  scaleX: number;
  scaleY: number;
}

export const BOB_RATE = 16; // рад/с фазы шага
export const BOB_HEIGHT = 1.5; // px
export const BOB_SQUASH = 0.07;

export const IDLE_POSE: BobPose = { offsetY: 0, scaleX: 1, scaleY: 1 };

/** Поза по фазе шага. Нулевая сила движения — покой. */
export function bobPose(phase: number, strength: number): BobPose {
  if (strength <= 0) return IDLE_POSE;
  const s = Math.abs(Math.sin(phase));
  // В верхней точке (s=1) тело вытянуто, у земли (s=0) слегка сплющено.
  const squash = (1 - s) * BOB_SQUASH * strength;
  return {
    offsetY: -s * BOB_HEIGHT * strength,
    scaleX: 1 + squash,
    scaleY: 1 - squash,
  };
}
