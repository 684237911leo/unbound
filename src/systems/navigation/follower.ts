// Движение по маршруту (без Phaser): по текущей позиции выдаёт вектор скорости [-1..1] и сообщает о прибытии.

import type { Point } from './grid';

export const ARRIVE_EPS = 1.5;
const STUCK_WINDOW = 0.6; // с
const STUCK_MIN_PROGRESS = 3; // px за окно

export class PathFollower {
  private path: Point[] = [];
  private stuckTimer = 0;
  private stuckFrom: Point = { x: 0, y: 0 };

  get active(): boolean {
    return this.path.length > 0;
  }

  get destination(): Point | null {
    return this.path.length ? this.path[this.path.length - 1] : null;
  }

  set(path: readonly Point[], from: Point): void {
    this.path = path.map((p) => ({ ...p }));
    this.stuckTimer = 0;
    this.stuckFrom = { ...from };
  }

  cancel(): void {
    this.path = [];
  }

  /**
   * Шаг: вернёт вектор движения (длина ≤ 1; перед целью снижается, чтобы не «дрожать»).
   * `speed` — px/с, `dt` — секунды. `arrived` true в кадре, когда достигнута последняя точка; `stuck` — упёрлась в препятствие.
   */
  step(pos: Point, speed: number, dt: number): { move: Point; arrived: boolean; stuck: boolean } {
    while (this.path.length > 0) {
      const t = this.path[0];
      if (Math.hypot(t.x - pos.x, t.y - pos.y) > ARRIVE_EPS) break;
      this.path.shift();
      if (this.path.length === 0) return { move: { x: 0, y: 0 }, arrived: true, stuck: false };
    }
    if (this.path.length === 0) return { move: { x: 0, y: 0 }, arrived: false, stuck: false };

    this.stuckTimer += dt;
    if (this.stuckTimer >= STUCK_WINDOW) {
      const moved = Math.hypot(pos.x - this.stuckFrom.x, pos.y - this.stuckFrom.y);
      this.stuckTimer = 0;
      this.stuckFrom = { ...pos };
      if (moved < STUCK_MIN_PROGRESS) {
        this.path = [];
        return { move: { x: 0, y: 0 }, arrived: false, stuck: true };
      }
    }

    const t = this.path[0];
    const dx = t.x - pos.x;
    const dy = t.y - pos.y;
    const dist = Math.hypot(dx, dy);
    const maxStep = Math.max(speed * dt, 1e-6);
    const k = Math.min(1, dist / maxStep) / dist;
    return { move: { x: dx * k, y: dy * k }, arrived: false, stuck: false };
  }
}
