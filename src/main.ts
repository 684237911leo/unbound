import Phaser from 'phaser';
import { createGameConfig } from './config/game';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MainMenuScene } from './scenes/MainMenuScene';

new Phaser.Game(createGameConfig([BootScene, PreloadScene, MainMenuScene]));
