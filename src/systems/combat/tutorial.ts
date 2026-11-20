// Обучение бою: шаги с подсказками, паузой на замахе и условиями завершения. Без Phaser (тестируется через TutorialHost).

import type { EnemyId } from '../../data/enemies';
import type { Emitter } from './emitter';
import type { CombatEvents } from './events';

export type StepDone =
  /** Враг вырублен. */
  | { type: 'ko'; enemy: EnemyId }
  /** Враг вырублен и хотя бы одно уклонение удалось (или враг не успел замахнуться). */
  | { type: 'dodge-ko'; enemy: EnemyId }
  /** Все враги волны повержены. */
  | { type: 'clear' };

export interface TutorialStepDef {
  id: string;
  /** Волна энкаунтера, к которой относится шаг. */
  wave: number;
  /** Подсказка внизу экрана (null — без подсказки). */
  hint: string | null;
  subHint?: string;
  /** Какие враги действуют на этом шаге; остальные удерживаются. */
  enable: EnemyId[] | 'all';
  /** Время замирает на первом замахе включённых врагов, пока игрок не сделает свайп. */
  pauseOnWindup?: boolean;
  done: StepDone;
}

/** Что обучению нужно от боя. Реализуется CombatController-ом (и подделкой в тестах). */
export interface TutorialHost {
  events: Emitter<CombatEvents>;
  aliveEnemyIds(): EnemyId[];
  setHeld(id: EnemyId, held: boolean): void;
  freeze(on: boolean): void;
  setSwipeOnly(on: boolean): void;
  showHint(text: string, sub?: string): void;
  hideHint(): void;
}

export class TutorialRunner {
  private cleanups: Array<() => void> = [];

  constructor(
    private readonly host: TutorialHost,
    readonly steps: readonly TutorialStepDef[],
  ) {}

  /** Выполняет шаги волны по порядку; промис разрешается, когда выполнен последний. */
  async runWave(wave: number, waveEnemies: readonly EnemyId[]): Promise<void> {
    for (const step of this.steps.filter((s) => s.wave === wave)) {
      await this.runStep(step, waveEnemies);
    }
  }

  /** Отмена (поражение/выход): снимает слушатели, паузу и подсказку. Висящие промисы не разрешаются. */
  cancel(): void {
    for (const c of this.cleanups) c();
    this.cleanups = [];
    this.host.freeze(false);
    this.host.setSwipeOnly(false);
    this.host.hideHint();
  }

  private runStep(step: TutorialStepDef, waveEnemies: readonly EnemyId[]): Promise<void> {
    const host = this.host;
    return new Promise<void>((resolve) => {
      const enabled = (id: EnemyId): boolean => step.enable === 'all' || step.enable.includes(id);
      for (const id of waveEnemies) host.setHeld(id, !enabled(id));

      const down = new Set<EnemyId>();
      const windupSeen = new Set<EnemyId>();
      let dodged = false;
      let paused = false;
      let swiped = false;
      let finished = false;

      const off: Array<() => void> = [];
      const finish = (): void => {
        if (finished) return;
        finished = true;
        for (const o of off) o();
        host.hideHint();
        if (paused) {
          host.freeze(false);
          host.setSwipeOnly(false);
        }
        resolve();
      };

      const check = (): void => {
        const d = step.done;
        if (d.type === 'ko' && down.has(d.enemy)) finish();
        else if (d.type === 'dodge-ko' && down.has(d.enemy) && (dodged || !windupSeen.has(d.enemy))) finish();
        else if (d.type === 'clear' && host.aliveEnemyIds().length === 0) finish();
      };

      if (step.hint && !step.pauseOnWindup) host.showHint(step.hint, step.subHint);

      off.push(
        host.events.on('enemy-down', (id) => {
          down.add(id);
          check();
        }),
        host.events.on('dodge-success', () => {
          dodged = true;
          check();
        }),
        host.events.on('enemy-windup', (id) => {
          if (!enabled(id)) return;
          windupSeen.add(id);
          if (step.pauseOnWindup && !paused && !swiped) {
            paused = true;
            host.freeze(true);
            host.setSwipeOnly(true);
            if (step.hint) host.showHint(step.hint, step.subHint);
          }
        }),
        host.events.on('dodge', () => {
          swiped = true;
          if (paused) {
            paused = false;
            host.freeze(false);
            host.setSwipeOnly(false);
          }
        }),
      );
      this.cleanups.push(() => {
        finished = true;
        for (const o of off) o();
      });
      check();
    });
  }
}

/** Обучение схватки в каюте: шаги 1–3 из GAME_DESIGN.md. */
export const CABIN_TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    id: 'attack',
    wave: 0,
    hint: 'Коснись врага — атака',
    enable: ['guard_tutorial_1'],
    done: { type: 'ko', enemy: 'guard_tutorial_1' },
  },
  {
    id: 'dodge',
    wave: 0,
    hint: 'Свайп — уклонение',
    subHint: 'проведи пальцем в сторону от врага',
    enable: ['guard_tutorial_2'],
    pauseOnWindup: true,
    done: { type: 'dodge-ko', enemy: 'guard_tutorial_2' },
  },
  {
    id: 'captain',
    wave: 1,
    hint: null,
    enable: 'all',
    done: { type: 'clear' },
  },
];
