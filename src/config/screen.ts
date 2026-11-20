// Адаптивный размер экрана: логическая ширина фиксирована, высота считается по пропорциям устройства.
export const GAME_WIDTH = 360;
export const GAME_MIN_HEIGHT = 640;
export const GAME_MAX_HEIGHT = 800;

/** Логическая высота для окна w×h (CSS-пикселей): 360·h/w, зажатая в [640, 800]. */
export function computeGameHeight(viewW: number, viewH: number): number {
  if (!(viewW > 0) || !(viewH > 0)) return GAME_MIN_HEIGHT;
  const h = Math.round((GAME_WIDTH * viewH) / viewW);
  return Math.min(GAME_MAX_HEIGHT, Math.max(GAME_MIN_HEIGHT, h));
}
