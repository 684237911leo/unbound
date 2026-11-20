# BUILD.md — сборка, запуск и выпуск UNBOUND

Структура проекта — в [PROJECT_MAP.md](PROJECT_MAP.md). Подпись и обновление поверх установленной версии — в [SIGNING.md](SIGNING.md).

## Требования

| Что | Версия / где |
|---|---|
| Node.js | 22 |
| JDK | 21 (`java` в `PATH`) |
| Android SDK | каталог в `$ANDROID_HOME` (или `$ANDROID_SDK_ROOT`); нужны `platforms;android-36` и `build-tools` (скрипт берёт самую новую версию) |
| Облачный контейнер | SDK лежит в `/opt/android-sdk` (`ANDROID_HOME` в окружении может быть не задан, тогда задайте вручную) |

## Команды

| Команда | Что делает |
|---|---|
| `npm install` | установка зависимостей |
| `npm run dev` | dev-сервер Vite для проверки в браузере |
| `npm test` | тесты Vitest (`tests/`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | `tsc --noEmit` и `vite build` в `dist/` |
| `npm run preview` | предпросмотр собранного `dist/` |
| `npm run apk:debug` | debug-APK (скрипт `scripts/build-apk.sh debug`) |
| `npm run apk:release` | release-APK, подписанный постоянным ключом (скрипт `scripts/build-apk.sh release`) |

## Что делает `scripts/build-apk.sh`

Скрипт останавливается при первой ошибке и печатает `ERROR: …`.

| Шаг | Что проверяется или делается |
|---|---|
| 1/9 Окружение | наличие `java` и `node`; `ANDROID_HOME` существует; в build-tools найдены `apksigner` и `aapt2` |
| 2/9 Файлы подписи | только для release: есть `android-signing/keystore.properties`, существует keystore, в файле указан `certSha256` |
| 3/9 version.json | читает `applicationId`, `versionName`, `versionCode`. Для release: `versionCode` должен быть больше, чем в `releases/last-release.json` (если файл есть) |
| 4/9 Web и Capacitor | `npm run build`, затем `npx cap sync android` |
| 5/9 Gradle | `./gradlew --no-daemon assembleDebug` или `assembleRelease` в `android/` |
| 6/9 Подпись | `apksigner verify --print-certs`. Для release SHA-256 сертификата сверяется с `certSha256` из `keystore.properties` |
| 7/9 Метаданные | `aapt2 dump badging`: совпадают `applicationId`, `versionCode`, `versionName` (у debug к имени добавляется `-debug`) |
| 8/9 Артефакт | release: копия в `releases/UNBOUND-v<версия>.apk` и перезапись `releases/last-release.json`. debug: копия в `builds/UNBOUND-v<версия>-debug.apk` |
| 9/9 Отчёт | режим, путь, размер, id, версии, SHA-256; в конце `BUILD OK` |

Переменные окружения для путей: `UNBOUND_RELEASES_DIR` (по умолчанию `releases`), `UNBOUND_BUILDS_DIR` (по умолчанию `builds`).

## Где лежат APK

- **release:** `releases/UNBOUND-v<версия>.apk` — коммитится в git. Вместе с ним обновляется `releases/last-release.json` (версия, versionCode, SHA-256 сертификата, дата сборки, размер).
- **debug:** `builds/UNBOUND-v<версия>-debug.apk` — каталог в `.gitignore`, в git не попадает. Debug подписан отладочным ключом и не ставится поверх release.

## Выпуск новой версии

1. В `version.json` увеличить `versionCode` (обязательно, больше предыдущего) и `versionName` (по смыслу).
2. Запустить `npm run apk:release`. Скрипт сам откажется собирать, если `versionCode` не вырос.
3. Проверить отчёт: `BUILD OK`, совпадение SHA-256 и версий.
4. Закоммитить `version.json`, `releases/UNBOUND-v<версия>.apk` и обновлённый `releases/last-release.json`.
5. Обновить [CHANGELOG.md](CHANGELOG.md) и [PROGRESS.md](PROGRESS.md).

Правила совместимости обновлений (applicationId, сертификат, versionCode) — в [SIGNING.md](SIGNING.md).

## Известные сбои

- **HTTP 429 от Maven Central** при загрузке зависимостей Gradle встречается время от времени. Это не ошибка проекта: просто запустите команду ещё раз.
- **Предупреждение Vite о размере чанка** (Phaser около 1.2 МБ) — ожидаемо и не блокирует сборку.
