import { describe, it, expect } from 'vitest';
import { findNearest } from '../src/systems/interaction/nearest';
import { bobPose } from '../src/systems/player/walkBob';
import { computeGameHeight } from '../src/config/screen';

describe('findNearest', () => {
  const items = [
    { id: 'a', x: 0, y: 0, radius: 20 },
    { id: 'b', x: 30, y: 0, radius: 20 },
    { id: 'far', x: 200, y: 200, radius: 10 },
  ];

  it('возвращает null, если никто не в радиусе', () => {
    expect(findNearest(items, 100, 100)).toBeNull();
    expect(findNearest([], 0, 0)).toBeNull();
  });

  it('выбирает ближайший из подходящих', () => {
    expect(findNearest(items, 22, 0)?.id).toBe('b');
    expect(findNearest(items, 5, 0)?.id).toBe('a');
  });

  it('учитывает индивидуальный радиус и границу включительно', () => {
    expect(findNearest(items, 20, 0)?.id).toBe('b'); // ближе к b (10) чем к a (20)
    expect(findNearest([{ id: 'x', x: 0, y: 0, radius: 10 }], 10, 0)?.id).toBe('x');
    expect(findNearest([{ id: 'x', x: 0, y: 0, radius: 10 }], 10.01, 0)).toBeNull();
  });

  it('при равном расстоянии побеждает первый', () => {
    const tie = [
      { id: 'first', x: -5, y: 0, radius: 20 },
      { id: 'second', x: 5, y: 0, radius: 20 },
    ];
    expect(findNearest(tie, 0, 0)?.id).toBe('first');
  });
});

describe('bobPose', () => {
  it('в покое — исходная поза', () => {
    expect(bobPose(1.3, 0)).toEqual({ offsetY: 0, scaleX: 1, scaleY: 1 });
  });
  it('при ходьбе подпрыгивает вверх и сплющивается, сохраняя малые значения', () => {
    const p = bobPose(Math.PI / 2, 1);
    expect(p.offsetY).toBeLessThan(0);
    expect(p.offsetY).toBeGreaterThan(-3);
    const low = bobPose(0, 1);
    expect(low.scaleY).toBeLessThan(1);
    expect(low.scaleX).toBeGreaterThan(1);
  });
});

describe('computeGameHeight', () => {
  it('высокий телефон: высота по пропорции, не выше 800', () => {
    expect(computeGameHeight(390, 844)).toBe(779);
    expect(computeGameHeight(360, 1000)).toBe(800);
  });
  it('низ — 640; мусор → 640', () => {
    expect(computeGameHeight(1280, 720)).toBe(640);
    expect(computeGameHeight(360, 640)).toBe(640);
    expect(computeGameHeight(0, 0)).toBe(640);
    expect(computeGameHeight(NaN, 100)).toBe(640);
  });
});
