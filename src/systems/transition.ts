import type Phaser from 'phaser';

/** Затемняет все камеры сцены и запускает другую сцену. Повторный вызов игнорируется. */
export function fadeToScene(scene: Phaser.Scene, key: string, ms = 450): void {
  const s = scene as Phaser.Scene & { __fading?: boolean };
  if (s.__fading) return;
  s.__fading = true;
  for (const c of scene.cameras.cameras) c.fadeOut(ms, 0, 0, 0);
  scene.time.delayedCall(ms + 40, () => scene.scene.start(key));
}

/** Плавно проявляет сцену на всех камерах (вызывать после создания камер). */
export function fadeInScene(scene: Phaser.Scene, ms = 450): void {
  for (const c of scene.cameras.cameras) c.fadeIn(ms, 0, 0, 0);
}
