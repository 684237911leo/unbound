# SIGNING.md — подпись APK и обновления

## Постоянный ключ

| Параметр | Значение |
|---|---|
| Keystore | `android-signing/unbound-release.jks` (PKCS12) |
| Конфигурация | `android-signing/keystore.properties` (пароли там же) |
| Alias | `unbound` |
| Алгоритм | RSA 4096, SHA256withRSA |
| Срок | до 2126 года |
| SHA-256 сертификата | `34:1A:E6:9E:B8:85:B3:52:20:23:FA:D5:99:72:99:50:B0:54:1A:BD:EA:29:98:96:A5:C9:16:3F:14:B3:DA:D2` |
| applicationId | `com.unbound.game` |

Ключ создан один раз (2026-11-20) и хранится в репозитории с согласия владельца проекта (игра для личного использования).

### Запрещено

- Генерировать новый keystore (если файл существует — использовать его; если пропал — восстановить из git, а не создавать новый).
- Менять alias, пароли, applicationId.
- Удалять `android-signing/` при очистке.
- Подписывать release-сборку debug-ключом.

## Как работает подпись

`android/app/build.gradle` читает `android-signing/keystore.properties` и применяет `signingConfigs.release` к release-сборке. Скрипт `scripts/build-apk.sh release` после сборки проверяет через `apksigner verify --print-certs`, что SHA-256 сертификата совпадает с `certSha256` из `keystore.properties`; при несовпадении сборка считается проваленной.

## Обновление поверх установленной версии

Android установит новый APK поверх старого без удаления и без потери данных, если:

1. совпадает `applicationId` (`com.unbound.game`);
2. совпадает сертификат подписи (этот keystore);
3. `versionCode` новой версии **больше** установленной.

Версия задаётся в `version.json`:

| versionName | versionCode |
|---|---|
| 0.1.0 | 1 |
| 0.2.0 | 2 |
| 0.3.0 | 3 |

Перед релизом увеличь `versionCode` (обязательно) и `versionName` (по смыслу). Скрипт откажется собирать release, если `versionCode` не больше последнего выпущенного (`releases/last-release.json`).

Сохранения лежат в приватных SharedPreferences приложения и при обновлении не удаляются.

## Ручная установка на телефон

1. Скачать `releases/UNBOUND-vX.Y.Z.apk` на телефон.
2. Открыть файл, разрешить установку из этого источника (один раз).
3. Нажать «Обновить»/«Установить». Удалять старую версию не нужно.

Debug-сборки (`UNBOUND-vX.Y.Z-debug.apk`) подписаны отладочным ключом и **не ставятся поверх release** — они только для проверки.
