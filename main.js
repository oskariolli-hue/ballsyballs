import Phaser from 'phaser';
import { CONFIG } from './config.js';
import SceneMenu from './scenes/SceneMenu.js';
import SceneMain from './scenes/SceneMain.js';

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: CONFIG.WIDTH,
    height: CONFIG.HEIGHT,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [SceneMenu, SceneMain],
    pixelArt: false,
    antialias: true,
};

const game = new Phaser.Game(config);
