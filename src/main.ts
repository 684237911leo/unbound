import Phaser from 'phaser';
import { createGameConfig } from './config/game';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { DeckScene } from './scenes/DeckScene';

const game = new Phaser.Game(createGameConfig([BootScene, PreloadScene, MainMenuScene, DeckScene]));

// Отладочный доступ для Playwright-проверок (fps, положение игрока). На геймплей не влияет.
(window as unknown as { __game: Phaser.Game }).__game = game;
