# ASSETS.md: сторонние pixel-art ассеты UNBOUND

Все паки ниже взяты с opengameart.org, лицензия **CC0 1.0** (проверено по полю License на каждой странице OGA, 2026-11-20). Копии лежат в `public/assets/third_party/<автор>-<пак>/`, рядом с каждой лежит `LICENSE.txt` с источником и текстом лицензии. Общий объём: около 364 КБ.

Стиль: 16×16, вид сверху (3/4). **Основной стиль — Kenney Tiny (Tiny Town + Tiny Dungeon)**; паки Roguelike (Kenney) и Tiny Islands (Majadroid) — дополнение, использовать так, чтобы не ломать единый стиль. Pirate Ship Tile Set (Chasersgaming) рассмотрен и отклонён Opus: другая стилистика (тёмная, NES-подобная, вид сбоку).

## Таблица паков

| Пак | Источник (OGA) | Автор | Лицензия | Локальный путь | Тайл | Раскладка листа | Использование в UNBOUND |
|---|---|---|---|---|---|---|---|
| Tiny Town | https://opengameart.org/content/tiny-town | Kenney | CC0 | `public/assets/third_party/kenney-tiny-town/tilemap_packed.png` | 16×16, отступ 0 (в оригинале 1 px, здесь упакован без них) | 192×176 px = 12×11 тайлов | Солёная Гавань: дома, деревья, заборы, трава, дороги, стены |
| Tiny Dungeon | https://opengameart.org/content/tiny-dungeon | Kenney | CC0 | `public/assets/third_party/kenney-tiny-dungeon/tilemap_packed.png` | 16×16, отступ 0 (упакован) | 192×176 px = 12×11 тайлов | NPC (люди-персонажи в нижних рядах), сундуки, бочки, предметы |
| Roguelike/RPG pack (1700+ tiles) | https://opengameart.org/content/roguelikerpg-pack-1700-tiles | Kenney Vleugels for Kenney | CC0 | `public/assets/third_party/kenney-roguelike-rpg/roguelikeSheet_transparent.png` | 16×16, отступ 1 px | 968×526 px = 57×31 ячеек (шаг 17 px) | Палуба (доски), каюта, стены, вода, двери, окна, деревья, крыши |
| Roguelike Indoor pack | https://opengameart.org/content/roguelike-indoor-pack | Kenney Vleugels for Kenney | CC0 | `public/assets/third_party/kenney-roguelike-indoor/roguelikeIndoor_transparent.png` | 16×16, отступ 1 px | 457×305 px = 27×18 ячеек (шаг 17 px; последний столбец и часть строк пустые) | Каюта капитана: столы, стулья, кровати, сундуки, шкафы, полки |
| Roguelike Characters pack | https://opengameart.org/content/roguelike-character-pack | Kenney Vleugels for Kenney | CC0 | `public/assets/third_party/kenney-roguelike-characters/roguelikeChar_transparent.png` | 16×16, отступ 1 px | 918×203 px = 54×12 ячеек (шаг 17 px) | NPC и героиня: модульные тела и одежда, головные уборы, оружие. Собирать из частей, готовых персонажей здесь нет |
| Tiny Islands - 16x16 Tilemap | https://opengameart.org/content/tiny-islands-16x16-tilemap | Majadroid (Maik Hoffmann) | CC0 | `public/assets/third_party/majadroid-tiny-islands/tilemap.png` | 16×16, отступ 0 | 224×160 px = 14×10 тайлов | Вода, берег, песок, острова: побережье и выход к морю |

Ширина и высота листов и сетки измерены Pillow (PIL 12.3.0) по прозрачным промежуткам; значения сверены с `spritesheetInfo.txt` и `Tilesheet.txt` авторов.

## Как пользоваться в Phaser

- Kenney Tiny Town / Tiny Dungeon: `load.spritesheet(key, path, { frameWidth: 16, frameHeight: 16 })`, без margin и spacing.
- Kenney Roguelike (RPG, Indoor, Characters): `frameWidth: 16, frameHeight: 16, margin: 1, spacing: 1`. В Phaser первый тайл начинается с margin 0, шаг равен 16 + spacing.
- Majadroid Tiny Islands: `frameWidth: 16, frameHeight: 16`, без margin и spacing.

## Проверка стиля

Контактный лист для просмотра: `/tmp/claude-0/-home-user-unbound/35efba59-9728-5b7b-bb47-9520729d46fd/scratchpad/contact.png` (каждый лист в 2×, с подписью).

- Kenney-паки (Tiny Town, Tiny Dungeon, Roguelike RPG, Indoor, Characters) выглядят как одна семья: 16 px, вид сверху, плоские цвета.
- Majadroid Tiny Islands: другая палитра (мягкие голубые и зелёные), вид сверху. Использовать только для воды и берега; если на экране не сочетается с Kenney, заменить.

## Пробелы (что ещё нужно)

1. Анимация ходьбы: ни в одном из добавленных паков нет кадров ходьбы (Kenney — статичные персонажи). Нужны 4 направления × 2–3 кадра для героини и NPC.
2. Спрайт героини: готового 16×16 или 16×24 персонажа-героини в паках нет. Героиню собрать из Roguelike Characters (тело + одежда + причёска) или нарисовать.
3. Корабль: готового корабля в стиле Kenney Tiny нет. Палубу и каюту собираем из деревянных тайлов (настил, стены, мебель); силуэт корабля на море — нарисовать отдельно в том же стиле.
4. Причал и доки: готовых тайлов «дерево-причал» с опорами нет. Частичный вариант: доски из Roguelike RPG, но нужны переходы «суша – настил – вода».
5. Вода с анимацией: Majadroid — статичная вода. Нужна анимированная вода (2–4 кадра) для Солёной Гавани.
6. Лодки малые: нет шлюпки 16×16 для причала.

## Найденные, но не добавленные кандидаты

- Kenney Pirate Pack (`pirate-pack-190`, CC0): тайлы 64×64, не 16×16. Масштаб не совпадает, в проект не добавлен.
- 16×16 Ship Collection (Master484, `1616-ship-collection`, CC0): космические корабли, не пиратские. Не добавлен.
- RPG Town (ansimuz, `rpg-town-pixel-art-assets`, CC0): тайлы 16×16, есть `hero.png` и `npc.png` (48×64, кадры ходьбы 16×16). Может закрыть пробел 1 и 2, но стиль и вид отличаются от Kenney. Не добавлен; решение за владельцем.
- RPG Dock (Healy, `rpg-dock-wip`, CC0): причал и тайлы, но WIP и другая палитра. Не добавлен.
- Shoreline wave animation (Eldiran, `16x16-shoreline-wave-animation-tiles`, CC0): кадры воды, сетка неровная, не добавлен.
- Simple generic ship (`simple-generic-ship`, CC0) и The Boat (`the-boat`, CC0): изометрия и мелкие лодки, другой стиль. Не добавлены.
- Отклонены по лицензии: Sailors & Pirates (CC-BY), Black Sail Ship (CC-BY), Roguelike/RPG Items и Monsters (CC-BY-SA), Interior Tileset 16x16 (CC-BY-SA), 16x16 RPG Tileset (GPL), Cottage core и Warm eclectic furniture (CC-BY 4.0), 16x16 Game Assets (CC-BY 4.0).
