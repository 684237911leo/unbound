import { describe, it, expect } from 'vitest';
import type { EnemyId } from '../src/data/enemies';
import { Emitter } from '../src/systems/combat/emitter';
import type { CombatEvents } from '../src/systems/combat/events';
import { CABIN_TUTORIAL_STEPS, type TutorialHost, TutorialRunner } from '../src/systems/combat/tutorial';

function fakeHost(ids: EnemyId[]) {
  const alive = new Set<EnemyId>(ids);
  const held = new Map<EnemyId, boolean>();
  const log: string[] = [];
  const host: TutorialHost & { alive: Set<EnemyId>; held: Map<EnemyId, boolean>; log: string[]; frozen: boolean; swipeOnly: boolean; hint: string } = {
    events: new Emitter<CombatEvents>(),
    alive,
    held,
    log,
    frozen: false,
    swipeOnly: false,
    hint: '',
    aliveEnemyIds: () => [...alive],
    setHeld: (id, h) => void held.set(id, h),
    freeze(on) {
      host.frozen = on;
    },
    setSwipeOnly(on) {
      host.swipeOnly = on;
    },
    showHint(t) {
      host.hint = t;
      log.push(`hint:${t}`);
    },
    hideHint() {
      host.hint = '';
    },
  };
  return host;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('TutorialRunner (волна 0 кабинного обучения)', () => {
  it('шаг 1: подсказка, второй стражник удержан, шаг завершается нокаутом первого', async () => {
    const h = fakeHost(['guard_tutorial_1', 'guard_tutorial_2']);
    const r = new TutorialRunner(h, CABIN_TUTORIAL_STEPS);
    let done = false;
    void r.runWave(0, ['guard_tutorial_1', 'guard_tutorial_2']).then(() => (done = true));
    expect(h.hint).toBe('Коснись врага — атака');
    expect(h.held.get('guard_tutorial_1')).toBe(false);
    expect(h.held.get('guard_tutorial_2')).toBe(true);
    h.alive.delete('guard_tutorial_1');
    h.events.emit('enemy-down', 'guard_tutorial_1');
    await tick();
    // Шаг 2 начался: второй стражник выпущен, подсказка пока скрыта (до замаха).
    expect(h.held.get('guard_tutorial_2')).toBe(false);
    expect(h.hint).toBe('');
    expect(done).toBe(false);
  });

  it('шаг 2: время замирает на замахе до первого свайпа, затем уклонение + нокаут завершают волну', async () => {
    const h = fakeHost(['guard_tutorial_1', 'guard_tutorial_2']);
    const r = new TutorialRunner(h, CABIN_TUTORIAL_STEPS);
    let done = false;
    void r.runWave(0, ['guard_tutorial_1', 'guard_tutorial_2']).then(() => (done = true));
    h.alive.delete('guard_tutorial_1');
    h.events.emit('enemy-down', 'guard_tutorial_1');
    await tick();

    h.events.emit('enemy-windup', 'guard_tutorial_2', 0);
    expect(h.frozen).toBe(true);
    expect(h.swipeOnly).toBe(true);
    expect(h.hint).toBe('Свайп — уклонение');

    h.events.emit('dodge');
    expect(h.frozen).toBe(false);
    expect(h.swipeOnly).toBe(false);

    // Нокаут без удавшегося уклонения шаг не завершает (замах был).
    h.alive.delete('guard_tutorial_2');
    h.events.emit('enemy-down', 'guard_tutorial_2');
    await tick();
    expect(done).toBe(false);
    h.events.emit('dodge-success');
    await tick();
    expect(done).toBe(true);
    expect(h.hint).toBe('');
  });

  it('пауза срабатывает один раз', async () => {
    const h = fakeHost(['guard_tutorial_1', 'guard_tutorial_2']);
    const r = new TutorialRunner(h, CABIN_TUTORIAL_STEPS);
    void r.runWave(0, ['guard_tutorial_1', 'guard_tutorial_2']);
    h.events.emit('enemy-down', 'guard_tutorial_1');
    await tick();
    h.events.emit('enemy-windup', 'guard_tutorial_2', 0);
    h.events.emit('dodge');
    h.events.emit('enemy-windup', 'guard_tutorial_2', 0);
    expect(h.frozen).toBe(false);
  });

  it('cancel снимает паузу и подсказку', async () => {
    const h = fakeHost(['guard_tutorial_1']);
    const r = new TutorialRunner(h, CABIN_TUTORIAL_STEPS);
    void r.runWave(0, ['guard_tutorial_1']);
    expect(h.hint).not.toBe('');
    r.cancel();
    expect(h.hint).toBe('');
    expect(h.frozen).toBe(false);
  });

  it('шаг 3 (капитан): без подсказок, все включены, завершается по зачистке', async () => {
    const h = fakeHost(['captain']);
    const r = new TutorialRunner(h, CABIN_TUTORIAL_STEPS);
    let done = false;
    void r.runWave(1, ['captain']).then(() => (done = true));
    expect(h.hint).toBe('');
    expect(h.held.get('captain')).toBe(false);
    h.alive.delete('captain');
    h.events.emit('enemy-down', 'captain');
    await tick();
    expect(done).toBe(true);
  });
});
