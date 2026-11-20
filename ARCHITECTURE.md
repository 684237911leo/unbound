# ARCHITECTURE.md — техническая архитектура UNBOUND

## Стек и почему

| Слой | Технология |
|---|---|
| Движок | **Phaser 3.90** (2D, WebGL/Canvas) |
| Язык | **TypeScript 5.9** (strict) |
| Сборка web | **Vite 7** |
| Тесты | **Vitest** (логика), Playwright (скриншоты/смоук в Chromium) |
| Android-обёртка | **Capacitor 8** → Gradle-проект в `android/` → подписанный APK |

Почему так: Phaser — зрелый 2D-движок с хорошей поддержкой pixel art, тайловых карт (Tiled), анимаций спрайтов и аркадной физики. Весь проект — текст (TS/JSON), его надёжно правят агенты, а игру можно запустить и проверить скриншотами прямо в облачном контейнере, без редактора. Capacitor упаковывает игру в нативное Android-приложение с обычной Gradle-подписью. Альтернатива (Godot) отвергнута: требует бинарного редактора/шаблонов экспорта и плохо проверяется автоматически.

## Принципы

1. **Системы — независимые модули** в `src/systems/<имя>/`, без зависимости от сцен. Общение между системами — через `EventBus` или через `GameState`.
2. **Данные отдельно от кода**: `src/data/` (персонажи, диалоги, квесты, предметы, корабли) — чистые типизированные объекты/JSON без логики.
3. **Сцены (`src/scenes/`) тонкие**: рисуют, принимают ввод, вызывают системы.
4. **Единое сериализуемое состояние** `GameState` — всё, что попадает в сохранение, живёт там.
5. Модуль создаётся, только когда он нужен текущему этапу. Никаких «заглушек, выглядящих готовыми».

## Модули (план; статус — в PROGRESS.md)

| Модуль | Путь | Назначение | Зависит от |
|---|---|---|---|
| EventBus | `src/core/EventBus.ts` | Типизированные события | — |
| GameState | `src/core/GameState.ts` | Сериализуемое состояние игры | — |
| SaveSystem | `src/core/SaveSystem.ts` | Сохранение/загрузка, версии, миграции, бэкап | GameState, Capacitor Preferences |
| Version | `vite define` `__APP_VERSION__`, `__APP_VERSION_CODE__` | Версия в игре | `version.json` |
| Player | `src/systems/player/` | Движение, анимации, ввод (клавиатура + сенсор) | — |
| Interaction | `src/systems/interaction/` | Взаимодействие с объектами/NPC | Player |
| Dialogue | `src/systems/dialogue/` | Диалоговые деревья из `src/data/dialogues` | GameState (флаги) |
| Quest | `src/systems/quest/` | Квесты и цели | GameState, EventBus |
| Inventory / Economy | `src/systems/inventory/`, `src/systems/economy/` | Предметы, золото, торговля | GameState |
| NPC | `src/systems/npc/` | Расписания и перемещение NPC | Dialogue |
| Combat | `src/systems/combat/` | Базовый сухопутный бой | Player |
| Ship / Crew | `src/systems/ship/`, `src/systems/crew/` | Аренда судна, найм команды | GameState, Economy |
| Sailing / World | `src/systems/sailing/`, `src/systems/world/` | Мореплавание, карта мира | Ship |
| Reputation / Factions | `src/systems/reputation/` | Репутация в портах | GameState |
| Audio | `src/systems/audio/` | Музыка и звуки | — |
| UI | `src/ui/` | HUD, окна, сенсорные кнопки | системы через EventBus |

## Экран и графика

- Логическое разрешение **360×640** (9:16), `Scale.FIT`, `pixelArt: true`, `roundPixels: true`. Ориентация — **вертикальная (portrait)**, управление одной рукой: джойстик и кнопка действия в нижней трети экрана, под большим пальцем.
- Базовый тайл 16×16, персонажи ~16×24/16×32. Карты — Tiled JSON в `public/assets/tilesets` / `public/assets/maps`.
- Ввод: клавиатура (ПК/отладка) + сенсорный джойстик и кнопка действия (Android). Окна диалогов — в нижней части экрана.

## Сохранения

- Хранилище: Capacitor **Preferences** → на Android это приватные SharedPreferences приложения (`/data/data/com.unbound.game/`). Не очищаются при обновлении APK поверх. В браузере — fallback на `localStorage`.
- Формат: `{ saveVersion: number, savedAt: string, appVersion: string, state: GameState }`.
- `saveVersion` растёт при каждом несовместимом изменении. Миграции — упорядоченный список функций `vN → vN+1`. Перед миграцией создаётся резервная копия под отдельным ключом.
- Расположение/ключи сохранений не меняются без миграции.

## Android

- `applicationId` = `com.unbound.game` (неизменен), версия — из `version.json` (единый источник для Gradle и игры).
- Подпись: постоянный keystore `android-signing/unbound-release.jks`, подробности в SIGNING.md.
- Будущая проверка обновлений: файл-манифест (`latest.json` с versionCode, versionName, changelog, url) → игра сравнивает versionCode и предлагает скачать APK, установка — только через системный установщик с подтверждением пользователя. На этапе 1 не реализуется.
