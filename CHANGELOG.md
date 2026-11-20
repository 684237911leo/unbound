# Changelog

Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/). Версии — по `version.json` (versionName и versionCode).

## [Unreleased]

## [0.1.0] — 2026-11-20 (versionCode 1)

Первый выпуск: технический скелет и подписанный APK. Игровой механики пока нет.

### Added

- Проект на Vite, TypeScript (strict) и Phaser 3.90. Логическое разрешение 360×640, FIT-масштабирование, pixel art.
- Сцены: BootScene, PreloadScene (прогресс-бар, заглушечные текстуры `heroine` и `tile-deck`), MainMenuScene (заголовок, фоновый дождь, кнопка «Начать» с заглушкой, версия в углу).
- Ядро: типизированная шина событий EventBus (8 тестов), сериализуемое состояние GameState, SaveSystem с версиями, миграциями, резервной копией и защитой от порчи данных (11 тестов).
- Android-обёртка на Capacitor 8: `applicationId` `com.unbound.game`, полноэкранный вертикальная�й режим.
- Скрипт `scripts/build-apk.sh` для debug и release APK с проверками подписи, версии и метаданных.
- Постоянный ключ подписи (SIGNING.md). Релизный APK 0.1.0 подписан им и выпущен в `releases/`.
