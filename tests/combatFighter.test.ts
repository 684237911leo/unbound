import { describe, it, expect } from 'vitest';
import { ENEMIES, HEROINE_STATS } from '../src/data/enemies';
import { EnemyBrain, HeroineState, type BrainEvent } from '../src/systems/combat/fighter';

const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++ % v.length];
};

function run(brain: EnemyBrain, seconds: number, dist: number, step = 0.02): BrainEvent[] {
  const all: BrainEvent[] = [];
  for (let t = 0; t < seconds; t += step) all.push(...brain.update(step, { dist, targetAlive: true }).events);
  return all;
}

describe('HeroineState', () => {
  it('удар: перезарядка 0.5 с, контакт в середине взмаха', () => {
    const h = new HeroineState(HEROINE_STATS);
    expect(h.startAttack()).toBe(true);
    expect(h.startAttack()).toBe(false);
    let contacts = 0;
    for (let t = 0; t < 0.14; t += 0.01) for (const e of h.update(0.01)) if (e.type === 'contact') contacts++;
    expect(contacts).toBe(1);
    expect(h.mode).toBe('idle');
    expect(h.canAttack).toBe(false); // ещё перезарядка
    h.update(0.4);
    expect(h.canAttack).toBe(true);
  });

  it('рывок: неуязвимость 0.3 с, перезарядка 0.8 с', () => {
    const h = new HeroineState(HEROINE_STATS);
    expect(h.startDodge()).toBe(true);
    expect(h.invulnerable).toBe(true);
    expect(h.takeHit(1).hit).toBe(false);
    h.update(0.2);
    expect(h.mode).toBe('idle');
    expect(h.invulnerable).toBe(true);
    h.update(0.15);
    expect(h.invulnerable).toBe(false);
    expect(h.canDodge).toBe(false);
    h.update(0.5);
    expect(h.canDodge).toBe(true);
  });

  it('попадание: урон, оглушение, неуязвимость после удара, смерть', () => {
    const h = new HeroineState(HEROINE_STATS);
    const r = h.takeHit(2);
    expect(r).toEqual({ hit: true, dead: false });
    expect(h.hp).toBe(4);
    expect(h.mode).toBe('hurt');
    expect(h.takeHit(1).hit).toBe(false); // i-frames после удара
    h.update(0.5);
    expect(h.mode).toBe('idle');
    expect(h.takeHit(10)).toEqual({ hit: true, dead: true });
    expect(h.alive).toBe(false);
    expect(h.canAttack).toBe(false);
    expect(h.canDodge).toBe(false);
  });

  it('запоминает время рывка по часам боя', () => {
    const h = new HeroineState(HEROINE_STATS);
    h.update(1);
    h.startDodge();
    expect(h.lastDodgeAt).toBeCloseTo(1);
  });
});

describe('EnemyBrain', () => {
  it('пассивный стражник стоит, пока по нему не ударят', () => {
    const b = new EnemyBrain(ENEMIES.guard_tutorial_1, seq(0.5));
    const ev = run(b, 5, 30);
    expect(ev).toHaveLength(0);
    expect(b.state).toBe('idle');
    const r = b.takeHit(1);
    expect(r.applied).toBe(true);
    expect(b.aggroed).toBe(true);
  });

  it('цикл: подход → замах → удар → пауза → снова', () => {
    const b = new EnemyBrain(ENEMIES.guard_tutorial_2, seq(0.5));
    const states = new Set<string>();
    let strikes = 0;
    for (let t = 0; t < 8; t += 0.02) {
      const out = b.update(0.02, { dist: t < 1 ? 50 : 15, targetAlive: true });
      states.add(b.state);
      strikes += out.events.filter((e) => e.type === 'strike').length;
    }
    for (const s of ['approach', 'windup', 'strike', 'recover', 'idle']) expect(states.has(s)).toBe(true);
    expect(strikes).toBeGreaterThanOrEqual(2);
  });

  it('замах гвардейца длится ~1 с, у капитана серия начинается с ~0.55 с', () => {
    const g = new EnemyBrain(ENEMIES.guard_tutorial_2, seq(0.5));
    g.update(1, { dist: 10, targetAlive: true }); // idle → approach
    g.update(0.02, { dist: 10, targetAlive: true });
    expect(g.state).toBe('windup');
    expect(g.windupTotal).toBeCloseTo(1.0);

    const c = new EnemyBrain(ENEMIES.captain, seq(0.0)); // rng=0: первая атака — combo, 2 удара
    c.update(1, { dist: 10, targetAlive: true });
    c.update(0.02, { dist: 10, targetAlive: true });
    expect(c.state).toBe('windup');
    expect(c.attack?.id).toBe('combo');
    expect(c.windupTotal).toBeCloseTo(0.55);
  });

  it('серия капитана: 2–3 быстрых удара подряд, затем пауза', () => {
    const c = new EnemyBrain(ENEMIES.captain, seq(0.0, 0.99)); // combo, 2 удара (hits по rng 0.99 → 3?)
    const ev = run(c, 4, 10);
    const strikes = ev.filter((e) => e.type === 'strike');
    const firstSeries = strikes.filter((e) => e.type === 'strike' && e.attack.id === 'combo');
    expect(firstSeries.length).toBeGreaterThanOrEqual(2);
    const follow = ev.find((e) => e.type === 'windup' && e.index === 1);
    expect(follow).toBeDefined();
  });

  it('удар в замах сбивает; сразу после стана — иммунитет', () => {
    const b = new EnemyBrain(ENEMIES.guard_tutorial_2, seq(0.5));
    run(b, 1.2, 10);
    expect(b.state).toBe('windup');
    const r = b.takeHit(1);
    expect(r.staggered).toBe(true);
    expect(b.state).toBe('stagger');
    expect(b.attack).toBeNull();
  });

  it('удар вне замаха не сбивает атаку, но бьёт по hp; hp<=0 — нокаут', () => {
    const b = new EnemyBrain(ENEMIES.guard_tutorial_2, seq(0.5));
    expect(b.takeHit(1).staggered).toBe(false);
    expect(b.hp).toBe(2);
    const r = b.takeHit(5);
    expect(r.ko).toBe(true);
    expect(b.alive).toBe(false);
    expect(b.takeHit(1).applied).toBe(false);
  });

  it('иммунитет к стану после первого оглушения (против стан-лока)', () => {
    const b = new EnemyBrain(ENEMIES.captain, seq(0.0));
    run(b, 0.7, 10); // идём в замах
    expect(b.state).toBe('windup');
    expect(b.takeHit(1).staggered).toBe(true);
    // Через стан и отдых капитан снова замахивается, но ещё в окне иммунитета.
    let seen = false;
    for (let t = 0; t < 2 && !seen; t += 0.02) {
      b.update(0.02, { dist: 10, targetAlive: true });
      if (b.state === 'windup') {
        seen = true;
        const imm = b.takeHit(1);
        if (t < 1.2 - 0.7) expect(imm.staggered).toBe(false);
      }
    }
  });

  it('рывок выбирается только при достаточной дистанции', () => {
    // rng=0.95 → хвост списка весов (lunge); вблизи lunge исключён.
    const near = new EnemyBrain(ENEMIES.captain, seq(0.95));
    near.update(1, { dist: 20, targetAlive: true });
    near.update(0.02, { dist: 20, targetAlive: true });
    expect(near.attack?.kind).not.toBe('lunge');
    const far = new EnemyBrain(ENEMIES.captain, seq(0.95));
    far.update(1, { dist: 100, targetAlive: true });
    far.update(0.02, { dist: 100, targetAlive: true });
    far.update(0.02, { dist: 80, targetAlive: true });
    expect(far.attack?.kind).toBe('lunge');
  });

  it('выключенный ИИ ничего не делает', () => {
    const b = new EnemyBrain(ENEMIES.guard_tutorial_2, seq(0.5));
    b.enabled = false;
    expect(run(b, 5, 10)).toHaveLength(0);
    expect(b.state).toBe('idle');
  });
});
