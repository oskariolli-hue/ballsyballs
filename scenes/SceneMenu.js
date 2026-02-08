import Phaser from 'phaser';
import { CONFIG } from '../config.js';

export default class SceneMenu extends Phaser.Scene {
    constructor() {
        super('SceneMenu');
    }
    preload() {
        this.load.audio('bgMusic', 'https://rosebud.ai/assets/streets.mp3?B0Pq');
    }
    create() {
        // Start background music if not already playing
        if (!this.sound.get('bgMusic')) {
            this.bgMusic = this.sound.add('bgMusic', {
                volume: 0.3,
                loop: true
            });
            this.bgMusic.play();
        }
        
        // Background gradient
        const graphics = this.add.graphics();
        graphics.fillGradientStyle(0x000033, 0x000033, 0x330033, 0x330033, 1);
        graphics.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

        // Title
        this.add.text(CONFIG.WIDTH / 2, 200, 'BALLSY BALLS', {
            fontFamily: '"Press Start 2P"',
            fontSize: '80px',
            fill: '#ffff00',
            stroke: '#000000',
            strokeThickness: 10
        }).setOrigin(0.5);

        // Subtitle
        this.add.text(CONFIG.WIDTH / 2, 320, 'SELECT YOUR ARENA', {
            fontFamily: '"Press Start 2P"',
            fontSize: '40px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        // Calculate button spacing to fit all three levels
        const buttonSpacing = 520; // Space between button centers
        const startX = CONFIG.WIDTH / 2 - buttonSpacing; // Left position
        
        // Beach Level Button
        const beachButton = this.createLevelButton(
            startX, 
            CONFIG.HEIGHT / 2 + 80, 
            'BEACH', 
            '#00ffff',
            '☀️ SUNNY & FUN',
            'NORMAL DIFFICULTY'
        );
        beachButton.on('pointerdown', () => {
            this.selectLevel('Beach');
        });

        // Lava Level Button
        const lavaButton = this.createLevelButton(
            CONFIG.WIDTH / 2, 
            CONFIG.HEIGHT / 2 + 80, 
            'LAVA', 
            '#ff4400',
            '🌋 HOT & DANGEROUS',
            'HARD DIFFICULTY'
        );
        lavaButton.on('pointerdown', () => {
            this.selectLevel('Lava');
        });

        // Hell (Winter) Level Button
        const hellButton = this.createLevelButton(
            startX + buttonSpacing * 2, 
            CONFIG.HEIGHT / 2 + 80, 
            'HELL', 
            '#00ddff',
            '❄️ HELL FREEZES OVER',
            '💀 CHUCK NORRIS 💀'
        );
        hellButton.on('pointerdown', () => {
            this.selectLevel('Hell');
        });

        // Instructions
        this.add.text(CONFIG.WIDTH / 2, CONFIG.HEIGHT - 100, 'CLICK TO SELECT LEVEL', {
            fontFamily: '"Press Start 2P"',
            fontSize: '28px',
            fill: '#aaaaaa'
        }).setOrigin(0.5);

        // Animated decorations
        this.time.addEvent({
            delay: 100,
            callback: () => this.animateTitle(),
            loop: true
        });
    }

    createLevelButton(x, y, title, color, subtitle, difficulty) {
        const container = this.add.container(x, y);

        // Button background with glow (wider boxes to fit text)
        const glow = this.add.rectangle(0, 0, 480, 340, Phaser.Display.Color.HexStringToColor(color).color, 0.2);
        const bg = this.add.rectangle(0, 0, 460, 320, 0x000000, 0.9);
        const border = this.add.rectangle(0, 0, 460, 320, Phaser.Display.Color.HexStringToColor(color).color, 0)
            .setStrokeStyle(6, Phaser.Display.Color.HexStringToColor(color).color);

        // Title (increased font size)
        const titleText = this.add.text(0, -90, title, {
            fontFamily: '"Press Start 2P"',
            fontSize: '56px',
            fill: color,
            stroke: '#000000',
            strokeThickness: 10
        }).setOrigin(0.5);

        // Subtitle (increased font size)
        const subtitleText = this.add.text(0, -10, subtitle, {
            fontFamily: '"Press Start 2P"',
            fontSize: '24px',
            fill: '#ffffff'
        }).setOrigin(0.5);

        // Difficulty (increased font size)
        const difficultyText = this.add.text(0, 40, difficulty, {
            fontFamily: '"Press Start 2P"',
            fontSize: '22px',
            fill: '#ffff00'
        }).setOrigin(0.5);

        // Play hint (increased font size)
        const playText = this.add.text(0, 110, '> CLICK TO PLAY <', {
            fontFamily: '"Press Start 2P"',
            fontSize: '18px',
            fill: color
        }).setOrigin(0.5);

        container.add([glow, bg, border, titleText, subtitleText, difficultyText, playText]);

        // Make interactive
        bg.setInteractive({ useHandCursor: true })
            .on('pointerover', () => {
                this.tweens.add({
                    targets: container,
                    scaleX: 1.05,
                    scaleY: 1.05,
                    duration: 200,
                    ease: 'Back.easeOut'
                });
                glow.setAlpha(0.4);
                playText.setScale(1.2);
            })
            .on('pointerout', () => {
                this.tweens.add({
                    targets: container,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 200
                });
                glow.setAlpha(0.2);
                playText.setScale(1);
            });

        return bg;
    }

    selectLevel(levelName) {
        // Flash effect
        this.cameras.main.flash(300, 255, 255, 255);
        
        // Play selection sound
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        
        osc.start(now);
        osc.stop(now + 0.15);

        // Start the game with selected level
        this.time.delayedCall(300, () => {
            this.scene.start('SceneMain', { level: levelName });
        });
    }

    animateTitle() {
        // Add some visual flair (optional)
    }
}
