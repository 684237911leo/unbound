import { describe, it, expect } from 'vitest';
import { GestureTracker, classifyGesture } from '../src/systems/combat/gesture';

const s = (x: number, y: number, t: number) => ({ x, y, t });

describe('classifyGesture', () => {
  it('короткое касание без смещения — тап', () => {
    expect(classifyGesture(s(100, 100, 0), s(102, 101, 120)).kind).toBe('tap');
  });
  it('быстрое смещение дальше порога — свайп с нормализованным направлением', () => {
    const g = classifyGesture(s(100, 100, 0), s(150, 100, 150));
    expect(g.kind).toBe('swipe');
    if (g.kind === 'swipe') {
      expect(g.dir.x).toBeCloseTo(1);
      expect(g.dir.y).toBeCloseTo(0);
      expect(g.distance).toBeCloseTo(50);
    }
  });
  it('диагональный свайп вверх-влево', () => {
    const g = classifyGesture(s(100, 100, 0), s(70, 70, 100));
    expect(g.kind).toBe('swipe');
    if (g.kind === 'swipe') expect(Math.hypot(g.dir.x, g.dir.y)).toBeCloseTo(1);
  });
  it('смещение ровно на порог не свайп', () => {
    expect(classifyGesture(s(0, 0, 0), s(24, 0, 100)).kind).toBe('tap');
  });
  it('смещение дальше порога, но медленно — удержание (перетаскивание)', () => {
    expect(classifyGesture(s(0, 0, 0), s(60, 0, 400)).kind).toBe('hold');
  });
  it('долгое касание на месте — удержание', () => {
    expect(classifyGesture(s(0, 0, 0), s(3, 3, 600)).kind).toBe('hold');
  });
});

describe('GestureTracker', () => {
  it('выдаёт свайп сразу при движении, а при отпускании — null', () => {
    const t = new GestureTracker();
    t.begin(1, s(0, 0, 0));
    expect(t.move(1, s(10, 0, 50))).toBeNull();
    expect(t.move(1, s(40, 0, 100))?.kind).toBe('swipe');
    expect(t.move(1, s(80, 0, 120))).toBeNull();
    expect(t.fired(1)).toBe(true);
    expect(t.end(1, s(80, 0, 130))).toBeNull();
  });
  it('медленное движение свайпом не считается', () => {
    const t = new GestureTracker();
    t.begin(1, s(0, 0, 0));
    expect(t.move(1, s(60, 0, 300))).toBeNull();
    expect(t.end(1, s(60, 0, 310))?.kind).toBe('hold');
  });
  it('тап при отпускании; неизвестный указатель — null', () => {
    const t = new GestureTracker();
    t.begin(2, s(5, 5, 0));
    expect(t.end(2, s(5, 5, 90))?.kind).toBe('tap');
    expect(t.end(9, s(0, 0, 1))).toBeNull();
  });
  it('указатели независимы', () => {
    const t = new GestureTracker();
    t.begin(1, s(0, 0, 0));
    t.begin(2, s(0, 0, 0));
    expect(t.move(1, s(50, 0, 80))?.kind).toBe('swipe');
    expect(t.end(2, s(1, 0, 80))?.kind).toBe('tap');
  });
});
