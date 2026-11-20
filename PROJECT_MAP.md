# PROJECT_MAP.md — карта проекта UNBOUND

Навигационный индекс: что где лежит и что уже работает. Правила и решения не дублируются, а даны ссылками:
[AGENTS.md](AGENTS.md) · [CLAUDE.md](CLAUDE.md) · [GAME_DESIGN.md](GAME_DESIGN.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [SIGNING.md](SIGNING.md) · [BUILD.md](BUILD.md) · [PROGRESS.md](PROGRESS.md) · [TODO.md](TODO.md) · [CHANGELOG.md](CHANGELOG.md)

## Структура проекта

```
unbound/
├── AGENTS.md, CLAUDE.md, GAME_DESIGN.md, ARCHITECTURE.md, ASSETS.md, SIGNING.md   документация (см. ссылки выше)
├── PROJECT_MAP.md, BUILD.md, PROGRESS.md, TODO.md, CHANGELOG.md                   навигация, сборка, статус, план
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
│   ├── config/
│   │   ├── game.ts                   конфиг Phaser (pixelArt, Scale.FIT, arcade, DOM-контейнер)
│   │   └── screen.ts                 ширина 360, адаптивная высота 640–800 по пропорциям окна
│   ├── core/                         ядро без логики игры
│   │   ├── EventBus.ts               типизированная шина событий
│   │   ├── GameState.ts              сериализуемое состояние игры (интерфейс + начальное значение, heroName)
│   │   ├── SaveSystem.ts             сохранения: envelope, миграции, бэкап, защита от порчи
│   │   └── session.ts                текущая партия: newGame/continueGame, autosave в слот 1, положение героини
│   ├── scenes/                       тонкие сцены Phaser
│   │   ├── BootScene.ts              переход к PreloadScene
│   │   ├── PreloadScene.ts           прогресс-бар, загрузка листов Kenney, генерация процедурных текстур
│   │   ├── MainMenuScene.ts          меню: «Новая игра», «Продолжить» (+ подтверждение), версия
│   │   ├── NameEntryScene.ts         ввод имени героини (HTML input, кириллица, 1–16 символов)
│   │   └── DeckScene.ts              палуба: карта, герой, касания, взаимодействия, автосохранение
│   ├── systems/                      игровые системы
│   │   ├── fx/shipTextures.ts        процедурные текстуры: доски, вода, мачта (mast-gen)
│   │   ├── input/                    InputController.ts (WASD/стрелки, E/Space), vector.ts (нормализация)
│   │   ├── interaction/              InteractionSystem.ts (реестр объектов, подсказка, запуск), nearest.ts (ближайший объект, тап)
│   │   ├── navigation/               grid.ts (A*, 8 направлений без срезания углов, сглаживание), follower.ts (проход маршрута)
│   │   └── player/                   Player.ts (тело, тень, вид, движение), walkBob.ts (покачивание при ходьбе)
│   ├── ui/                           MessageBox.ts (окно текста), MenuButton.ts (кнопка), RainEffect.ts (дождь)
│   └── data/                         данные игры без логики
│       ├── tiles.ts                  кадры спрайтов Kenney: ключи тайлов, героиня (99), матрос (86), сундук и др.
│       └── maps/deck.ts              карта палубы 14×32 тайла: земля, объекты, проходимость (одна сетка для пути и коллайдеров)
├── tests/
│   ├── eventBus.test.ts              8 тестов EventBus
│   ├── interaction.test.ts           8 тестов: ближайший объект, bobPose, computeGameHeight
│   ├── navigation.test.ts            16 тестов: A*, сглаживание, PathFollower, ввод и касания
│   └── saveSystem.test.ts            12 тестов SaveSystem
├── public/assets/                    статика
│   ├── third_party/<автор>-<пак>/    сторонние CC0-листы (см. «Ресурсы»)
│   └── audio/, sprites/, tilesets/   каждая папка содержит только .gitkeep
├── scripts/build-apk.sh              сборка и проверка APK (см. BUILD.md)
├── releases/                         выпущенные APK (UNBOUND-v0.1.0.apk, UNBOUND-v0.2.1.apk) и last-release.json
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

### Модули

| Модуль | Файл | Назначение | Зависит от | Статус |
|---|---|---|---|---|
| EventBus | `src/core/EventBus.ts` | Типизированная шина событий; экземпляр `eventBus`. События: `gold:changed`, `flag:set` | — | готов, 8 тестов |
| GameState | `src/core/GameState.ts` | Интерфейс `GameState` (включая `heroName`), `createInitialState()`, `withDefaults()`. Только данные | — | готов, тестов нет |
| SaveSystem | `src/core/SaveSystem.ts` | `save/load/hasSave/deleteSave`, envelope с `saveVersion`, миграции, `.backup`/`.corrupt` | GameState, `@capacitor/preferences` | готов, 12 тестов |
| Session | `src/core/session.ts` | `newGame`, `continueGame`, `hasSave`, `autosave` (слот 1, очередь записей), `setLocation` | GameState, SaveSystem | готов, тестов нет |
| Game config | `src/config/game.ts` | `createGameConfig()`: Scale.FIT, pixelArt, arcade, DOM-контейнер | phaser, screen | готов |
| Screen | `src/config/screen.ts` | Ширина 360, `computeGameHeight()` (высота 640–800 по пропорциям окна) | — | готов, тесты в interaction.test.ts |
| Version | `vite.config.ts` (`define`) | `__APP_VERSION__`, `__APP_VERSION_CODE__` из `version.json` | `version.json` | готов |
| BootScene | `src/scenes/BootScene.ts` | Сразу переходит в PreloadScene | Phaser | готов |
| PreloadScene | `src/scenes/PreloadScene.ts` | Прогресс-бар, загрузка двух листов, генерация `ship-gen` и `mast-gen` | config, fx | готов |
| MainMenuScene | `src/scenes/MainMenuScene.ts` | Меню: «Новая игра» (при наличии сохранения — подтверждение), «Продолжить», версия | session, MenuButton, RainEffect | готов |
| NameEntryScene | `src/scenes/NameEntryScene.ts` | HTML-поле имени, проверка `^\p{L}[\p{L} -]*$`, до 16 символов; старт новой партии | session, DOM | готов, не проверен на устройстве |
| DeckScene | `src/scenes/DeckScene.ts` | Палуба: мир с зумом ×2, камера следует за героиней, ночной тон, тап-маршрут, интерактивные объекты, автосохранение | map/deck, tiles, Player, navigation, interaction, ui, session | готов |
| InputController | `src/systems/input/InputController.ts` | Клавиши WASD/стрелки (движение), E/Space (действие); только ПК | Phaser | готов |
| Navigation | `src/systems/navigation/grid.ts`, `follower.ts` | A* по сетке (8 направлений, без срезания углов), сглаживание линией видимости, проход маршрута, остановка при застревании | — (без Phaser) | готов, 16 тестов |
| Player | `src/systems/player/Player.ts`, `walkBob.ts` | Физическое тело, тень, вид, скорость 70 px/с, покачивание при ходьбе | Phaser, tiles | готов |
| InteractionSystem | `src/systems/interaction/` | Реестр объектов (`register`), ближайший объект, подсказка над объектом, тап по объекту, запуск действия | ui, nearest | готов, тесты в interaction.test.ts |
| MessageBox | `src/ui/MessageBox.ts` | Окно текста внизу экрана; закрывается тапом | Phaser | готов |
| MenuButton | `src/ui/MenuButton.ts` | Кнопка меню (Phaser-контейнер) | Phaser | готов |
| RainEffect | `src/ui/RainEffect.ts` | Дождь (фон меню и палуба) | Phaser | готов |
| fx | `src/systems/fx/shipTextures.ts` | Процедурные текстуры: доски палубы, вода (2 кадра), мачта 32×32 | Phaser, tiles | готов |

Точка входа: `src/main.ts`. Сцены: BootScene → PreloadScene → MainMenuScene → NameEntryScene / DeckScene.

Планируемые модули (Dialogue, Quest, Inventory/Economy, Combat, Ship/Crew, Sailing/World, Reputation, Audio и др.) описаны в [ARCHITECTURE.md](ARCHITECTURE.md), раздел «Модули»; их статус — здесь, в таблице выше.

## Игровые механики

| Механика | Где в коде | Статус |
|---|---|---|
| Главное меню («Новая игра», «Продолжить») | `src/scenes/MainMenuScene.ts` | готово |
| Ввод имени героини | `src/scenes/NameEntryScene.ts` | готово (клавиатура телефона не проверена) |
| Управление персонажем (тап-to-move, клавиатура на ПК) | `src/systems/input/`, `src/systems/player/`, `src/scenes/DeckScene.ts` | готово |
| Поиск пути, обход препятствий | `src/systems/navigation/` | готово |
| Взаимодействие с объектами (тап по объекту → подход → действие) | `src/systems/interaction/` | готово (базовое, на палубе) |
| Сохранение и загрузка (слот 1, автосейв, положение героини) | `src/core/SaveSystem.ts`, `src/core/session.ts` | готово |
| Диалоги | — | не начато |
| Сухопутный бой | — | не начато |
| Квесты | — | не начато |
| Инвентарь | — | не начато |
| Экономика, торговля | — | не начато |
| Корабли, аренда и найм судна | — | не начато |
| Команда, найм | — | не начато |
| Мореплавание, карта мира | — | не начато |
| Репутация и фракции | — | не начато |

## Игровой контент

Данные в `src/data/` есть только для палубы и кадров спрайтов. Утверждённый текст — в GAME_DESIGN.md. Имена подпапок `src/data/<…>` предварительные, кроме `dialogues` (из ARCHITECTURE.md).

| Категория | Утверждённый текст | Где в коде |
|---|---|---|
| Палуба (сцена 1, карта 14×32) | GAME_DESIGN.md §3 | `src/data/maps/deck.ts` (карта), `src/scenes/DeckScene.ts` (объекты) |
| Тексты осмотра на палубе (4 объекта) | временные, сверка с GAME_DESIGN.md §3 не сделана | `DeckScene.registerInteractables()`: каюта капитана, бочка, ящик, борт («Смотреть на шторм») |
| Героиня | GAME_DESIGN.md §2 (имя вводит игрок) | `src/scenes/NameEntryScene.ts`, `GameState.heroName`; спрайт — `src/data/tiles.ts` |
| Матрос на палубе | GAME_DESIGN.md §4 | `DeckScene.buildSailor()` — статичен, диалог в этапе 4 |
| NPC (Гидеон, Марта, Бран, Элин) | GAME_DESIGN.md §4 | `src/data/characters/` (нет) |
| Диалоги главы 1 | GAME_DESIGN.md §3 (сцены 1–5), §5 (финал) | `src/data/dialogues/` (нет) |
| Диалоги Солёной Гавани | GAME_DESIGN.md §4 | `src/data/dialogues/` (нет) |
| Квесты главы 1 | GAME_DESIGN.md §5 | `src/data/quests/` (нет) |
| Предметы | не описаны в дизайне, нет данных | `src/data/items/` (нет) |
| Корабли («Морская крыса») | GAME_DESIGN.md §6 | `src/data/ships/` (нет) |
| Команда | GAME_DESIGN.md §4 (Бран, Элин), §8 | `src/data/crew/` (нет) |
| Фракции | только перечень в GAME_DESIGN.md §7, без деталей | `src/data/factions/` (нет) |
| Карты и локации (Солёная Гавань) | GAME_DESIGN.md §4 (список локаций), §3 | `src/data/maps/` — только `deck.ts`; Tiled JSON в `public/assets/maps/` (нет) |

## Ресурсы

- `public/assets/third_party/<автор>-<пак>/` — бесплатные CC0-листы спрайтов (Kenney Tiny Town, Tiny Dungeon, Roguelike RPG/Indoor/Characters, Majadroid Tiny Islands). Описание, сетки и пробелы — **ASSETS.md**. Основной стиль — Kenney Tiny.
- **Загружаются в игру** (`SHEET_FILES` в `src/data/tiles.ts`, загрузка в `PreloadScene`):
  - `tiny-town` — `kenney-tiny-town/tilemap_packed.png`, 16×16: забор палубы, стены и окна каюты;
  - `tiny-dungeon` — `kenney-tiny-dungeon/tilemap_packed.png`, 16×16: героиня (кадр 99), матрос (86), бочка, ящик, сундук.
- **Не загружаются:** Roguelike RPG/Indoor/Characters и Majadroid Tiny Islands лежат в `third_party/`, но в игре пока не используются.
- **Процедурные** (`src/systems/fx/shipTextures.ts`, создаются в `PreloadScene`): `ship-gen` — 5 кадров 16×16 (доски `plank_a/b/c`, вода `water_a/b`); `mast-gen` — мачта 32×32.
- `public/assets/sprites/`, `tilesets/`, `audio/` — пока пустые (только `.gitkeep`). Звука пока нет.
- Базовые размеры из ARCHITECTURE.md: тайл 16×16, персонажи 16×24 / 16×32.

## Android и сборка

- **applicationId:** `com.unbound.game` (не меняется).
- **versionName / versionCode:** задаются только в `version.json` (сейчас 0.2.1 / 3). Читаются `android/app/build.gradle`, `vite.config.ts` и скриптом сборки.
- **Ключ подписи:** `android-signing/unbound-release.jks`, alias `unbound`. Конфигурация — `android-signing/keystore.properties`. Пароли и содержимое файла в документах не приводятся. SHA-256 сертификата совпадает с 0.1.0, поэтому 0.2.0 ставится поверх 0.1.0.
- **Выпуск:** `releases/UNBOUND-v0.2.1.apk`, метаданные — `releases/last-release.json`.
- **Процесс сборки и выпуска:** [BUILD.md](BUILD.md).
- **Правила подписи и способ установки APK на телефон:** [SIGNING.md](SIGNING.md).
