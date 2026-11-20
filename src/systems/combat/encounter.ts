// Схватка: волны врагов + шаги обучения. Не привязана к сцене: сцена даёт точки появления и контроллер.
// Поражение — не game over: схватка начинается заново (контрольная точка = начало схватки).

import type { EnemyId } from '../../data/enemies';
import type { Point } from '../navigation/grid';
import type { CombatController } from './CombatController';
import { Emitter } from './emitter';
import { type TutorialHost, TutorialRunner, type TutorialStepDef } from './tutorial';

export interface WaveEnemy {
  id: EnemyId;
  /** Имя точки появления (например, дверь). */
  spawn: string;
  /** Имя точки, куда враг входит и где включается; без неё стоит в точке появления. */
  stand?: string;
}

export interface EncounterWave {
  enemies: WaveEnemy[];
}

export interface EncounterDef {
  id: string;
  waves: EncounterWave[];
  /** Шаги обучения; пусто/нет — обычный бой. */
  tutorial?: TutorialStepDef[];
  /** Точка, где стоит героиня в начале (и после поражения). */
  heroineStart: string;
  /** Лечить героиню до полного здоровья перед следующими волнами (по умолчанию да). */
  healBetweenWaves?: boolean;
}

export interface HintApi {
  show(text: string, sub?: string): void;
  hide(): void;
  banner(text: string, ms?: number): void;
}

export interface EncounterEvents {
  'wave-start': [index: number];
  retry: [attempt: number];
  won: [];
}

const RETRY_DELAY_MS = 1300;
const BANNER_MS = 1400;

export class CombatEncounter {
  readonly events = new Emitter<EncounterEvents>();
  /** Номер попытки (0 — первая). */
  attempt = 0;
  private tutorialDone: boolean;
  private tutorial: TutorialRunner | null = null;
  private aborted = false;

  constructor(
    private readonly combat: CombatController,
    readonly def: EncounterDef,
    private readonly points: Record<string, Point>,
    private readonly hint: HintApi,
  ) {
    this.tutorialDone = !def.tutorial || def.tutorial.length === 0;
  }

  /** Запускает схватку; промис разрешается 'won', когда повержены все волны. Поражения перезапускают её сами. */
  async run(): Promise<'won'> {
    for (;;) {
      const result = await this.attemptOnce();
      if (result === 'won') {
        this.events.emit('won');
        return 'won';
      }
      if (this.aborted) return new Promise<'won'>(() => undefined);
      this.attempt++;
      this.hint.banner('Ещё раз', BANNER_MS);
      this.events.emit('retry', this.attempt);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }

  abort(): void {
    this.aborted = true;
    this.tutorial?.cancel();
  }

  private point(name: string): Point {
    const p = this.points[name];
    if (!p) throw new Error(`encounter ${this.def.id}: no point "${name}"`);
    return p;
  }

  private async attemptOnce(): Promise<'won' | 'lost'> {
    const combat = this.combat;
    const useTutorial = !this.tutorialDone;
    combat.clearEnemies();
    combat.resetHeroine(this.point(this.def.heroineStart));
    this.hint.hide();

    let lost = false;
    const lostPromise = new Promise<'lost'>((resolve) => {
      const off = combat.events.on('heroine-down', () => {
        lost = true;
        off();
        resolve('lost');
      });
    });

    const host: TutorialHost = {
      events: combat.events,
      aliveEnemyIds: () => combat.aliveEnemies().map((e) => e.id),
      setHeld: (id, held) => combat.setHeld(id, held),
      freeze: (on) => combat.freeze(on),
      setSwipeOnly: (on) => combat.setSwipeOnly(on),
      showHint: (t, s) => this.hint.show(t, s),
      hideHint: () => this.hint.hide(),
    };
    this.tutorial = useTutorial ? new TutorialRunner(host, this.def.tutorial!) : null;

    const play = async (): Promise<'won'> => {
      for (let w = 0; w < this.def.waves.length; w++) {
        if (w > 0 && this.def.healBetweenWaves !== false) combat.healHeroine(combat.hero.maxHp);
        this.events.emit('wave-start', w);
        const wave = this.def.waves[w];
        if (w > 0) this.tutorialDone = true; // дошли до основного боя: при поражении обучение не повторяется
        const scripted = useTutorial && this.def.tutorial!.some((s) => s.wave === w);
        for (const we of wave.enemies) {
          const from = this.point(we.spawn);
          combat.spawnEnemy(we.id, from, {
            walkTo: we.stand ? this.point(we.stand) : undefined,
            held: scripted,
            aggressive: !useTutorial,
          });
        }
        if (this.tutorial && scripted) {
          // Входящие стражники не нападают, пока шаг обучения их не выпустит.
          await this.tutorial.runWave(
            w,
            wave.enemies.map((e) => e.id),
          );
        }
        await this.untilCleared();
      }
      return 'won';
    };

    const result = await Promise.race([play(), lostPromise]);
    this.tutorial?.cancel();
    this.tutorial = null;
    if (result === 'lost' || lost) return 'lost';
    return 'won';
  }

  private untilCleared(): Promise<void> {
    if (this.combat.aliveEnemies().length === 0) return Promise.resolve();
    return new Promise((resolve) => {
      const off = this.combat.events.on('enemy-down', () => {
        if (this.combat.aliveEnemies().length === 0) {
          off();
          resolve();
        }
      });
    });
  }
}
