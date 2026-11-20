# PROJECT_MAP.md — карта проекта UNBOUND

Навигационный индекс: что где лежит и что уже работает. Правила и решения не дублируются, а даны ссылками:
[AGENTS.md](AGENTS.md) · [CLAUDE.md](CLAUDE.md) · [GAME_DESIGN.md](GAME_DESIGN.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [SIGNING.md](SIGNING.md) · [BUILD.md](BUILD.md) · [PROGRESS.md](PROGRESS.md) · [TODO.md](TODO.md) · [CHANGELOG.md](CHANGELOG.md)

## Структура проекта

```
unbound/
├── AGENTS.md, CLAUDE.md, GAME_DESIGN.md, ARCHITECTURE.md, SIGNING.md   документация (см. ссылки выше)
├── PROJECT_MAP.md, BUILD.md, PROGRESS.md, TODO.md, CHANGELOG.md        навигация, сборка, статус, план
├── package.json, package-lock.json   зависимости и npm-скрипты
├── tsconfig.json                     TypeScript (strict), включает src/ и tests/
├── vite.config.ts                    сборка web; вшивает версию из version.json
├── capacitor.config.ts               appId, appName, webDir=dist
├── index.html                        точка входа веб-страницы, контейнер #game
├── version.json                      ЕДИНЫЙ источник версии (applicationId, versionName, versionCode)
├── .gitignore                        node_modules, dist, builds, android-артефакты
├── src/
│   ├── main.ts                       создаёт Phaser.Game, список сцен
│   ├── vite-env.d.ts                 типы __APP_VERSION__ и __APP_VERSION_CODE__
│   ├── config/game.ts                размер 360×640, конфиг Phaser (pixelArt, FIT, arcade)
│   ├── core/                         ядро без логики игры
│   │   ├── EventBus.ts               типизированная шина событий
│   │   ├── GameState.ts              сериализуемое состояние игры (интерфейс + начальное значение)
│   │   └── SaveSystem.ts             сохранения: envelope, миграции, бэкап, защита от порчи
│   ├── scenes/                       тонкие сцены Phaser
│   │   ├── BootScene.ts              переход к PreloadScene
│   │   ├── PreloadScene.ts           прогресс-бар, генерация заглушечных текстур
│   │   └── MainMenuScene.ts          главное меню
│   ├── systems/                      игровые системы (пусто, .gitkeep)
│   ├── ui/                           HUD и окна (пусто, .gitkeep)
│   └── data/                         данные игры без логики (пусто, .gitkeep)
├── tests/
│   ├── eventBus.test.ts              8 тестов EventBus
│   └── saveSystem.test.ts            11 тестов SaveSystem
├── public/assets/                    статика (сейчас пусто, см. раздел «Ресурсы»)
│   ├── audio/, sprites/, tilesets/   каждая папка содержит только .gitkeep
├── scripts/build-apk.sh              сборка и проверка APK (см. BUILD.md)
├── releases/                         выпущенные APK и last-release.json
├── android-signing/                  постоянный ключ подписи (см. SIGNING.md)
│   ├── unbound-release.jks           keystore
│   └── keystore.properties           конфигурация подписи (содержит пароли: не копировать в документы)
└── android/                          Capacitor-проект Android (Gradle)
    ├── app/build.gradle              applicationId, версия из version.json, signingConfig release
    ├── app/src/main/AndroidManifest.xml   активность, ориентация portrait, INTERNET
    ├── app/src/main/java/com/unbound/game/MainActivity.java   полноэкранный режим (immersive)
    ├── app/src/main/res/values/styles.xml    тема приложения и тема splash
    ├── variables.gradle              minSdk 24, compileSdk/targetSdk 36, версии библиотек
    └── …                             остальное — стандартный шаблон Capacitor (не описывается)
```

Тестовые шаблоны `android/app/src/androidTest/` и `android/app/src/test/` лежат в пакете `com.getcapacitor.myapp` (остаток шаблона, к игре не относится).

## Архитектура

### Модули, которые существуют сейчас

| Модуль | Файл | Назначение | Зависит от | Статус |
|---|---|---|---|---|
| EventBus | `src/core/EventBus.ts` | Типизированная шина событий; экземпляр `eventBus`. События: `gold:changed`, `flag:set` | — | готов, 8 тестов |
| GameState | `src/core/GameState.ts` | Интерфейс `GameState`, `createInitialState()`. Только данные | — | готов, тестов нет |
| SaveSystem | `src/core/SaveSystem.ts` | `save/load/hasSave/deleteSave`, envelope с `saveVersion`, миграции, `.backup`/`.corrupt` | GameState, `@capacitor/preferences` | готов, 11 тестов; в сцены не подключён |
| Game config | `src/config/game.ts` | Размер 360×640, `createGameConfig()` | phaser | готов |
| Version | `vite.config.ts` (`define`) | `__APP_VERSION__`, `__APP_VERSION_CODE__` из `version.json` | `version.json` | готов |
| BootScene | `src/scenes/BootScene.ts` | Сразу переходит в PreloadScene | Phaser | готов |
| PreloadScene | `src/scenes/PreloadScene.ts` | Прогресс-бар, заглушечные текстуры `heroine`, `tile-deck` | config | готов (заглушки) |
| MainMenuScene | `src/scenes/MainMenuScene.ts` | Заголовок, фоновый дождь, кнопка «Начать» (пока выводит «Пролог в разработке»), версия | config | готов (заглушка) |

Точка входа: `src/main.ts`. Планируемые модули (Player, Dialogue, Quest, Inventory/Economy, Combat, Ship/Crew, Sailing/World, Reputation, Audio, UI и др.) описаны в [ARCHITECTURE.md](ARCHITECTURE.md), раздел «Модули»; их статус — здесь, в таблице выше.

## Игровые механики

| Механика | Где в коде | Статус |
|---|---|---|
| Главное меню | `src/scenes/MainMenuScene.ts` | есть (заглушка) |
| Управление персонажем | — | не начато |
| Взаимодействие с объектами и NPC | — | не начато |
| Диалоги | — | не начато |
| Сухопутный бой | — | не начато |
| Квесты | — | не начато |
| Инвентарь | — | не начато |
| Экономика, торговля | — | не начато |
| Корабли, аренда и найм судна | — | не начато |
| Команда, найм | — | не начато |
| Мореплавание, карта мира | — | не начато |
| Репутация и фракции | — | не начато |
| Сохранение и загрузка | `src/core/SaveSystem.ts` (ядро готово, в игре не используется) | не начато в игре |

## Игровой контент

Данных в коде пока нет: папки `src/data/` пустые. Утверждённый текст — в GAME_DESIGN.md. Имена подпапок `src/data/<…>` предварительные, кроме `dialogues` (из ARCHITECTURE.md).

| Категория | Утверждённый текст | Будущие данные |
|---|---|---|
| Героиня | GAME_DESIGN.md §2 (имя не согласовано) | `src/data/characters/` |
| NPC (Гидеон, Марта, Бран, Элин) | GAME_DESIGN.md §4 | `src/data/characters/` |
| Диалоги главы 1 | GAME_DESIGN.md §3 (сцены 1–5), §5 (финал) | `src/data/dialogues/` |
| Диалоги Солёной Гавани | GAME_DESIGN.md §4 | `src/data/dialogues/` |
| Квесты главы 1 | GAME_DESIGN.md §5 | `src/data/quests/` |
| Предметы | не описаны в дизайне, нет данных | `src/data/items/` |
| Корабли («Морская крыса») | GAME_DESIGN.md §6 | `src/data/ships/` |
| Команда | GAME_DESIGN.md §4 (Бран, Элин), §8 | `src/data/crew/` |
| Фракции | только перечень в GAME_DESIGN.md §7, без деталей | `src/data/factions/` |
| Карты и локации (Солёная Гавань) | GAME_DESIGN.md §4 (список локаций), §3 | `src/data/maps/`, Tiled JSON в `public/assets/maps/` |

## Ресурсы

- `public/assets/third_party/<автор>-<пак>/` — бесплатные CC0-листы спрайтов (Kenney Tiny Town, Tiny Dungeon, Roguelike RPG/Indoor/Characters, Majadroid Tiny Islands). Описание, сетки и пробелы — **ASSETS.md**. Основной стиль — Kenney Tiny.
- `public/assets/sprites/`, `tilesets/`, `audio/` — пока пустые (только `.gitkeep`), для своих/доработанных ресурсов. Звука пока нет.
- В игру ассеты ещё не подключены.
- Заглушки в `PreloadScene.generatePlaceholderTextures()`:
  - `heroine` — 16×24, тёмно-красный прямоугольник;
  - `tile-deck` — 16×16, коричневая доска с полосой.
- Базовые размеры из ARCHITECTURE.md: тайл 16×16, персонажи 16×24 / 16×32.

## Android и сборка

- **applicationId:** `com.unbound.game` (не меняется).
- **versionName / versionCode:** задаются только в `version.json` (сейчас 0.1.0 / 1). Читаются `android/app/build.gradle`, `vite.config.ts` и скриптом сборки.
- **Ключ подписи:** `android-signing/unbound-release.jks`, alias `unbound`. Конфигурация — `android-signing/keystore.properties`. Пароли и содержимое файла в документах не приводятся.
- **Процесс сборки и выпуска:** [BUILD.md](BUILD.md).
- **Правила подписи и способ установки APK на телефон:** [SIGNING.md](SIGNING.md).
