import Phaser from 'phaser';
import {
  ROOM_COLS,
  ROOM_OBJECTS,
  ROOM_POINTS,
  ROOM_ROWS,
  ROOM_TILE,
  buildRoomNavGrid,
} from '../data/maps/combatRoom';
import { HEROINE, TILES, type TileKey } from '../data/tiles';
import { CombatController } from '../systems/combat/CombatController';
import { type EncounterDef, CombatEncounter } from '../systems/combat/encounter';
import { CABIN_TUTORIAL_STEPS } from '../systems/combat/tutorial';
import type { EnemyId } from '../data/enemies';
import { Player } from '../systems/player/Player';
import { HintPanel } from '../ui/HintPanel';

const T = ROOM_TILE;

/** Схватка в каюте: стражники (обучение) → капитан. Определение схватки не зависит от сцены. */
export const CABIN_FIGHT: EncounterDef = {
  id: 'cabin_fight',
  heroineStart: 'heroine',
  healBetweenWaves: true,
  waves: [
    {
      enemies: [
        { id: 'guard_tutorial_1', spawn: 'door', stand: 'guard_a' },
        { id: 'guard_tutorial_2', spawn: 'door', stand: 'guard_b' },
      ],
    },
    { enemies: [{ id: 'captain', spawn: 'door', stand: 'captain' }] },
  ],
  tutorial: CABIN_TUTORIAL_STEPS,
};

/** Тестовая арена боя: комната ~12×14 тайлов. Открывается по `?scene=combat`. */
export class CombatSandboxScene extends Phaser.Scene {
  private combat!: CombatController;
  private encounter!: CombatEncounter;
  private hint!: HintPanel;
  private won = false;

  constructor() {
    super('CombatSandboxScene');
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const worldW = ROOM_COLS * T;
    const worldH = ROOM_ROWS * T;
    this.won = false;

    this.cameras.main.setBackgroundColor('#0b0f1a');
    this.physics.world.setBounds(0, 0, worldW, worldH);
    const worldLayer = this.add.layer();
    const uiLayer = this.add.layer().setDepth(10);

    const nav = buildRoomNavGrid();
    const walls = this.physics.add.staticGroup();

    for (let row = 0; row < ROOM_ROWS; row++) {
      for (let col = 0; col < ROOM_COLS; col++) {
        const plank = (['plank_a', 'plank_b', 'plank_c'] as const)[(col * 3 + row * 5 + col * row) % 3];
        worldLayer.add(this.add.image(col * T + T / 2, row * T + T / 2, 'ship-gen', plank).setDepth(-1000));
        const key: TileKey | null = ROOM_OBJECTS[row][col];
        if (key) {
          const def = TILES[key];
          worldLayer.add(this.add.image(col * T + T / 2, row * T + T / 2, def.texture, def.frame).setDepth(row * T + T));
        }
      }
    }
    for (let row = 0; row < ROOM_ROWS; row++) {
      let run = -1;
      for (let col = 0; col <= ROOM_COLS; col++) {
        const solid = col < ROOM_COLS && nav.blocked[row][col];
        if (solid && run < 0) run = col;
        if (!solid && run >= 0) {
          const zone = this.add.zone(((run + col) / 2) * T, row * T + T / 2, (col - run) * T, T);
          this.physics.add.existing(zone, true);
          walls.add(zone);
          run = -1;
        }
      }
    }

    const start = ROOM_POINTS.heroine;
    const player = new Player(this, start.x, start.y, HEROINE);
    worldLayer.add([player.shadow, player.view]);
    this.physics.add.collider(player.body, walls);

    // Камеры: мир с зумом по ширине комнаты, интерфейс — отдельная камера без зума.
    const cam = this.cameras.main;
    cam.setZoom(W / worldW);
    cam.centerOn(worldW / 2, worldH / 2);
    const uiCam = this.cameras.add(0, 0, W, H, false, 'ui');
    uiCam.ignore(worldLayer);
    cam.ignore(uiLayer);

    this.hint = new HintPanel(this, uiLayer);
    this.combat = new CombatController({ scene: this, worldLayer, uiLayer, nav, walls, player });
    this.combat.attach();
    this.encounter = new CombatEncounter(this.combat, CABIN_FIGHT, ROOM_POINTS, this.hint);
    void this.encounter.run().then(() => {
      this.won = true;
      this.combat.setInputEnabled(false);
      this.hint.banner('Капитан повержен', 3000);
    });

    // Отладочный доступ для Playwright-проверок. На геймплей не влияет.
    (window as unknown as { __unbound: unknown }).__unbound = {
      game: this.game,
      combat: {
        snapshot: () => ({
          ...this.combat.snapshot(),
          hint: this.hint.text,
          attempt: this.encounter.attempt,
          won: this.won,
        }),
        worldToScreen: (x: number, y: number) => {
          const v = cam.worldView;
          return { x: (x - v.x) * cam.zoom, y: (y - v.y) * cam.zoom };
        },
        // Только для автотестов:
        damageHeroine: (n: number) => this.combat.debugDamageHeroine(n),
        knockOut: (id: EnemyId) => this.combat.debugKnockOut(id),
      },
    };

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.encounter.abort();
      this.combat.destroy();
      this.hint.destroy();
    });
  }

  update(time: number, delta: number): void {
    this.combat.update(time, delta);
  }
}
