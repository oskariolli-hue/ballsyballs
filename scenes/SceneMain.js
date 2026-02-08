import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { ASSETS } from '../Assets.js';
import Player from '../entities/Player.js';
import Ball from '../entities/Ball.js';
import PowerUp from '../entities/PowerUp.js';
import HeatHaze from '../pipelines/HeatHaze.js';

export default class SceneMain extends Phaser.Scene {
    constructor() {
        super('SceneMain');
    }

    init(data) {
        // Get selected level from menu (default to Beach)
        this.selectedLevel = data.level || 'Beach';
        
        // Level-specific configurations
        if (this.selectedLevel === 'Lava') {
            this.levelConfig = {
                name: 'LAVA',
                background: ASSETS.BACKGROUND_LAVA,
                backgroundKey: 'background_lava',
                ball: ASSETS.BALL_LAVA,
                ballKey: 'ball_lava',
                netTexture: 'lavapole2',
                netHeight: CONFIG.NET_HEIGHT * 1.3, // 30% taller net
                ballSpeed: 1.2, // 20% faster ball
                gravity: CONFIG.GRAVITY * 1.15, // More gravity
                cloudColor: 0xff4400, // Orange volcanic particles
                cloudAlpha: 0.3
            };
        } else if (this.selectedLevel === 'Hell') {
            this.levelConfig = {
                name: 'HELL',
                background: ASSETS.BACKGROUND_FREEZE,
                backgroundKey: 'background_freeze',
                ball: ASSETS.BALL_BEACH, // Using regular ball for now
                ballKey: 'ball_freeze',
                netTexture: 'icepole',
                netHeight: CONFIG.NET_HEIGHT * 1.15, // 15% taller net (reduced for frozen pole)
                ballSpeed: 1.944, // 20% faster than before (1.62 * 1.2) - INSANE speed!
                gravity: CONFIG.GRAVITY * 1.25, // Even more gravity
                cloudColor: 0xaaddff, // Icy blue snowflakes
                cloudAlpha: 0.7
            };
        } else {
            this.levelConfig = {
                name: 'BEACH',
                background: ASSETS.BACKGROUND_BEACH,
                backgroundKey: 'background_beach',
                ball: ASSETS.BALL_BEACH,
                ballKey: 'ball_beach',
                netTexture: 'polewood',
                netHeight: CONFIG.NET_HEIGHT,
                ballSpeed: 1.0,
                gravity: CONFIG.GRAVITY,
                cloudColor: 0xffffff, // White clouds
                cloudAlpha: 0.5
            };
        }
    }

    preload() {
        this.load.image(this.levelConfig.backgroundKey, this.levelConfig.background);
        this.load.image('player1', ASSETS.PLAYER_CYAN);
        this.load.image('player2', ASSETS.PLAYER_MAGENTA);
        this.load.image(this.levelConfig.ballKey, this.levelConfig.ball);
        this.load.image('icon-shrink', ASSETS.ICON_SHRINK);
        this.load.image('icon-slow', ASSETS.ICON_SLOW);
        this.load.image('icon-multiball', ASSETS.ICON_MULTIBALL);
        this.load.image('polewood', 'https://rosebud.ai/assets/polewood.png?NPbA');
        this.load.image('lavapole2', 'https://rosebud.ai/assets/lavapole2.png?xruG');
        this.load.image('icepole', 'https://rosebud.ai/assets/freezingpole.png?zvRu'); // Frozen pole for Hell level
        this.load.audio('bgMusic', 'https://rosebud.ai/assets/streets.mp3?B0Pq');
        this.load.audio('bgMusicLava', 'https://rosebud.ai/assets/streets-lava.mp3?c8gq');
    }
    create() {
        // Initialize Web Audio Context for sound effects
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Apply Heat Haze effect for Lava level
        if (this.selectedLevel === 'Lava' && this.game.renderer.type === Phaser.WEBGL) {
            this.cameras.main.setPostPipeline(HeatHaze);
        }
        
        // Create soft shadow texture programmatically if it doesn't exist
        if (!this.textures.exists('soft-shadow')) {
            const shadowSize = 128;
            const canvas = this.textures.createCanvas('soft-shadow', shadowSize, shadowSize);
            const ctx = canvas.context;
            // Radial gradient for soft shadow: Dark center -> Transparent edge
            const gradient = ctx.createRadialGradient(shadowSize/2, shadowSize/2, 0, shadowSize/2, shadowSize/2, shadowSize/2);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 1.0)');    // Dark center (Increased from 0.8 for stronger potential shadows)
            gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.5)');  // Soft falloff
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');      // Transparent edge
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, shadowSize, shadowSize);
            canvas.refresh();
        }

        // Start background music
        const musicKey = this.selectedLevel === 'Lava' ? 'bgMusicLava' : 'bgMusic';
        
        if (!this.sound.get(musicKey)) {
            // Stop any potentially playing music first (though usually scenes are cleared)
            this.sound.stopAll();
            
            this.bgMusic = this.sound.add(musicKey, {
                volume: 0.3,
                loop: true
            });
            this.bgMusic.play();
        }
        
        // Track who last hit the ball
        this.lastBallHitter = null; // 'player1' or 'player2'
        
        // Match statistics
        this.matchStats = {
            startTime: Date.now(),
            player1Hits: 0,
            player2Hits: 0,
            totalRallies: 0,
            longestRally: 0,
            currentRally: 0,
            powerUpsCollected: { player1: 0, player2: 0 }
        };
        // Background
        const bg = this.add.image(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, this.levelConfig.backgroundKey);
        bg.setDisplaySize(CONFIG.WIDTH, CONFIG.HEIGHT);
        
        // Initialize level-specific effects
        if (this.selectedLevel === 'Lava') {
            this.createLavaBubbles();
            this.createLavaEmbers();
        } else if (this.selectedLevel === 'Hell') {
            // Winter/Ice effects
            this.createSnowfall();
            this.createIceCrystals();
            this.createFrostBreath();
        } else {
            // Beach effects
            this.createWaveFoam();
            this.createBeachAmbience();
        }

        // Create explosion emitter
        this.createExplosionEmitter();

        // Clouds/particles (slow moving) - different per level
        this.clouds = [];
        for (let i = 0; i < 3; i++) {
            const cloud = this.add.circle(
                Phaser.Math.Between(0, CONFIG.WIDTH), 
                Phaser.Math.Between(100, 300), 
                50, 
                this.levelConfig.cloudColor, 
                this.levelConfig.cloudAlpha
            );
            cloud.setScale(Phaser.Math.FloatBetween(1, 3), Phaser.Math.FloatBetween(0.5, 1));
            this.clouds.push(cloud);
        }
        
        // Net pole - wooden pole image, height varies by level
        this.net = this.add.image(
            CONFIG.WIDTH / 2, 
            CONFIG.GROUND_Y - this.levelConfig.netHeight / 2, 
            this.levelConfig.netTexture
        );
        
        // Scale to match original net dimensions
        this.net.setDisplaySize(CONFIG.NET_WIDTH, this.levelConfig.netHeight);
        
        // Add physics - static body for collisions
        this.physics.add.existing(this.net, true);
        
        // Set physics body to match visual dimensions and extend slightly above to prevent jumping on top
        // Make physics width NARROWER than visual so ball hits the "core" of the pole, not the air around it
        const physicsNetWidth = 40;
        // Make physics height slightly shorter than visual to avoid invisible collision at top
        const physicsNetHeight = this.levelConfig.netHeight * 0.95; // 95% of visual height
        this.net.body.setSize(physicsNetWidth, physicsNetHeight);
        // Offset body so it's at the bottom of the visual net
        const heightOffset = this.levelConfig.netHeight - physicsNetHeight;
        this.net.body.setOffset((CONFIG.NET_WIDTH - physicsNetWidth) / 2, heightOffset); 
        // Create a separate INVISIBLE BARRIER strictly for players
        // This sits above the net and prevents players from jumping over, but the ball ignores it
        const barrierHeight = 1000;
        const netTopY = CONFIG.GROUND_Y - this.levelConfig.netHeight;
        this.playerBarrier = this.add.rectangle(
            CONFIG.WIDTH / 2,
            netTopY - (barrierHeight / 2) + 20, // Start from net top with small overlap
            physicsNetWidth,
            barrierHeight,
            0x000000,
            0 // Invisible
        );
        this.physics.add.existing(this.playerBarrier, true); // Static body
        // Ground visual
        this.ground = this.add.rectangle(CONFIG.WIDTH / 2, CONFIG.GROUND_Y + 50, CONFIG.WIDTH, 100, 0x000000, 0);
        this.physics.add.existing(this.ground, true);

        // Score
        this.score1 = 0;
        this.score2 = 0;
        this.scoreText = this.add.text(CONFIG.WIDTH / 2, 80, '0 - 0', {
            fontFamily: '"Press Start 2P"',
            fontSize: '64px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);

        // Display level name with title
        let levelColor = '#00ffff';
        if (this.selectedLevel === 'Lava') levelColor = '#ff4400';
        if (this.selectedLevel === 'Hell') levelColor = '#00ddff';
        
        // Hell level gets special styling with warning
        let levelTitle = `BALLSY BALLS - ${this.levelConfig.name}`;
        if (this.selectedLevel === 'Hell') {
            levelTitle = `BALLSY BALLS - ${this.levelConfig.name} 🔥💀`;
        }
        
        this.titleText = this.add.text(CONFIG.WIDTH / 2, 40, levelTitle, {
            fontFamily: '"Press Start 2P"',
            fontSize: '32px',
            fill: levelColor
        }).setOrigin(0.5);
        
        // Hell level: Add difficulty warning
        if (this.selectedLevel === 'Hell') {
            this.difficultyText = this.add.text(CONFIG.WIDTH / 2, 120, 'CHUCK NORRIS DIFFICULTY', {
                fontFamily: '"Press Start 2P"',
                fontSize: '18px',
                fill: '#ff0000',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5).setDepth(100);
            
            // Pulse animation for warning
            this.tweens.add({
                targets: this.difficultyText,
                scaleX: 1.1,
                scaleY: 1.1,
                alpha: { from: 1, to: 0.6 },
                duration: 800,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            
            // Fade out after 5 seconds
            this.time.delayedCall(5000, () => {
                if (this.difficultyText) {
                    this.tweens.add({
                        targets: this.difficultyText,
                        alpha: 0,
                        duration: 1000,
                        onComplete: () => {
                            if (this.difficultyText) {
                                this.difficultyText.destroy();
                            }
                        }
                    });
                }
            });
        }

        // Players
        this.p1Controls = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        // Initialize touch control state
        this.touchControls = {
            up: false,
            down: false,
            left: false,
            right: false
        };

        // Create mobile UI controls
        this.createMobileControls();

        // Create a merged control object that checks both keyboard and touch
        // We use getters so it always checks the current state
        const mergedP1Controls = {
            get up() { return { isDown: this.scene.p1Controls.up.isDown || this.scene.touchControls.up } },
            get down() { return { isDown: this.scene.p1Controls.down.isDown || this.scene.touchControls.down } },
            get left() { return { isDown: this.scene.p1Controls.left.isDown || this.scene.touchControls.left } },
            get right() { return { isDown: this.scene.p1Controls.right.isDown || this.scene.touchControls.right } },
            scene: this
        };

        this.p2Controls = this.input.keyboard.createCursorKeys();

        this.player1 = new Player(this, CONFIG.WIDTH * 0.25, CONFIG.GROUND_Y - 100, 'player1', mergedP1Controls);
        this.player2 = new Player(this, CONFIG.WIDTH * 0.75, CONFIG.GROUND_Y - 100, 'player2', this.p2Controls);
        
        // Scale players - Base 10% smaller (0.25 * 0.9 = 0.225), Hell level gets additional 10% reduction
        let playerScale = 0.225; // 10% smaller than original 0.25
        if (this.selectedLevel === 'Hell') playerScale = 0.2025; // Additional 10% smaller for Hell (0.225 * 0.9)
        this.player1.setScale(playerScale);
        this.player2.setScale(playerScale);

        // Ball
        this.ball = new Ball(this, CONFIG.WIDTH * 0.25, CONFIG.GROUND_Y - 400, this.levelConfig.ballKey);
        // Scale ball based on level - Base 5% smaller, Hell gets additional 10% reduction
        let ballScale = 0.171; // Beach: 0.18 * 0.95 = 0.171 (5% smaller)
        if (this.selectedLevel === 'Lava') ballScale = 0.152; // Lava: 0.16 * 0.95 = 0.152 (5% smaller)
        if (this.selectedLevel === 'Hell') ballScale = 0.1539; // Hell: 0.171 * 0.9 = 0.1539 (additional 10% smaller)
        this.ball.setScale(ballScale);
        this.ball.levelSpeedMultiplier = this.levelConfig.ballSpeed; // Apply level speed multiplier
        
        // Multiball system
        this.balls = [this.ball]; // Array to hold all active balls
        this.extraBalls = []; // Track extra balls from multiball power-up
        this.multiballActive = false;
        this.ballsLeftText = null; // Text showing balls remaining

        // Physics Collisions
        this.physics.add.collider(this.player1, this.net);
        this.physics.add.collider(this.player2, this.net);
        // Add collision between players and the high invisible barrier (Ball ignores this!)
        this.physics.add.collider(this.player1, this.playerBarrier);
        this.physics.add.collider(this.player2, this.playerBarrier);
        
        this.physics.add.collider(this.player1, this.ground);
        this.physics.add.collider(this.player2, this.ground);
        
        this.physics.add.collider(this.ball, this.net, () => {
             this.playHitSound(0.5);
        });

        // Ball vs Ground - Score point immediately on contact
        // This ensures the point is counted when the ball hits the visual floor (960px)
        // instead of falling through to the world bottom (1080px)
        this.physics.add.collider(this.ball, this.ground, (ball) => {
            this.handleBallFloor(ball);
        });

        // Ball vs Players
        this.physics.add.collider(this.ball, this.player1, (ball, p1) => this.handleBallPlayerCollision(ball, p1));
        this.physics.add.collider(this.ball, this.player2, (ball, p2) => this.handleBallPlayerCollision(ball, p2));

        // World bounds for ball (floor logic)
        this.physics.world.on('worldbounds', (body, up, down, left, right) => {
            if (body.gameObject === this.ball && down) {
                this.handleBallFloor();
            }
        });

        // Serve instructions
        this.serveText = this.add.text(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, 'HIT THE BALL TO SERVE!', {
            fontFamily: '"Press Start 2P"',
            fontSize: '40px',
            fill: '#ffffff'
        }).setOrigin(0.5);

        this.add.text(CONFIG.WIDTH * 0.25, CONFIG.HEIGHT - 50, 'WASD: MOVE/JUMP/DIVE', {
            fontFamily: '"Press Start 2P"',
            fontSize: '20px',
            fill: '#00ffff'
        }).setOrigin(0.5);

        this.add.text(CONFIG.WIDTH * 0.75, CONFIG.HEIGHT - 50, 'CPU PLAYER (AUTO)', {
            fontFamily: '"Press Start 2P"',
            fontSize: '20px',
            fill: '#ff00ff'
        }).setOrigin(0.5);

        this.servingSide = 1; // 1 for Player 1, 2 for Player 2
        this.isServing = true;
        
        // Power-up system
        this.activePowerUp = null;
        this.powerUpEffects = {
            player1: { type: null, endTime: 0, tween: null, overlay: null },
            player2: { type: null, endTime: 0, tween: null, overlay: null }
        };
        
        // Create power-up effect overlays for each player
        this.createPowerUpOverlays();

        // Initialize power-up colliders array
        this.powerUpColliders = [];
        
        // Spawn first power-up after delay
        this.time.delayedCall(5000, () => this.spawnPowerUp());
        
        // ESC key to return to menu
        this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.isPaused = false;
        this.confirmDialog = null;
    }

    handleBallPlayerCollision(ball, player) {
        if (this.isServing) {
            this.isServing = false;
            this.serveText.setVisible(false);
            ball.body.setAllowGravity(true);
        }
        // Track who hit the ball
        this.lastBallHitter = player === this.player1 ? 'player1' : 'player2';
        
        // Update match statistics
        if (player === this.player1) {
            this.matchStats.player1Hits++;
        } else {
            this.matchStats.player2Hits++;
            
            // Hell level: CPU celebrates good hits with visual effect
            if (this.selectedLevel === 'Hell') {
                // Reset desperate save flag if it was set
                if (this.aiState && this.aiState.desperateSaveAttempt) {
                    this.aiState.desperateSaveAttempt = false;
                }
                
                // 40% chance to show taunt after hit
                if (Math.random() > 0.6) {
                    const tauntMessages = ['💪', '🔥', '⚡', '💀', '👑'];
                    const taunt = Phaser.Utils.Array.GetRandom(tauntMessages);
                    
                    const tauntText = this.add.text(
                        this.player2.x, 
                        this.player2.y - 120, 
                        taunt, 
                        {
                            fontSize: '48px'
                        }
                    ).setOrigin(0.5).setDepth(150);
                    
                    this.tweens.add({
                        targets: tauntText,
                        y: tauntText.y - 60,
                        alpha: { from: 1, to: 0 },
                        duration: 1000,
                        ease: 'Power2',
                        onComplete: () => tauntText.destroy()
                    });
                }
            }
        }
        this.matchStats.currentRally++;
        if (this.matchStats.currentRally > this.matchStats.longestRally) {
            this.matchStats.longestRally = this.matchStats.currentRally;
        }
        
        // Determine which player hit the ball
        const isPlayer1 = player === this.player1;
        const isPlayer2 = player === this.player2;
        
        // Special logic: bounce angle depends on where on the player it hit
        const diff = ball.x - player.x;
        let velocityX = ball.body.velocity.x * 0.5 + diff * 20 + player.body.velocity.x * 0.5;
        
        // CPU (player2) aims towards opponent's side - Hell level gets PERFECT aim
        if (isPlayer2) {
            // Hell level: Superhuman precision, other levels: normal behavior
            let randomSpread = 600; // Beach/Lava: wide spread
            let aimInfluence = 0.8; // Beach/Lava: moderate aim
            
            if (this.selectedLevel === 'Hell') {
                // GOD-LIKE PRECISION: Perfect aim with strategic power
                randomSpread = 20; // Almost zero spread
                aimInfluence = 4.0; // Extremely strong aiming influence
            }
            
            // Calculate target: aim for the opponent's court
            const targetX = CONFIG.WIDTH * 0.25 + (Math.random() * randomSpread - randomSpread/2); 
            const directionToTarget = targetX - ball.x;
            
            // Mix calculated trajectory with target direction
            velocityX = velocityX * 0.4 + directionToTarget * aimInfluence;
            
            // Hell level: Tactical Spiking
            if (this.selectedLevel === 'Hell') {
                // If ball is high and near net, smash it down!
                const isNearNet = ball.x > CONFIG.WIDTH * 0.5 && ball.x < CONFIG.WIDTH * 0.65;
                if (isNearNet && ball.y < CONFIG.HEIGHT * 0.4) {
                    velocityY = 800; // Force downwards spike
                    velocityX = -800; // Sharp angle over the net
                }
            }
            
            // Ensure it goes towards left (player 1's side)
            if (velocityX > -100) {
                velocityX = -300 - Math.random() * 200;
            }
            
            // Hell level: Add strategic placement (aim for corners)
            if (this.selectedLevel === 'Hell' && Math.random() > 0.5) {
                // 50% chance to aim for corners (harder to reach)
                const cornerTarget = Math.random() > 0.5 ? 150 : CONFIG.WIDTH * 0.4;
                const cornerDirection = cornerTarget - ball.x;
                velocityX = velocityX * 0.3 + cornerDirection * 2.0;
            }
        }
        
        // Pukkauksen pitää toimia oikein - ensure enough height
        // Hell/Lava level: higher trajectory to clear the taller net
        let velocityY = -1200;
        if (isPlayer2 && this.selectedLevel === 'Lava') {
            velocityY = -1350; // 12.5% more vertical force for AI on lava level
        }
        if (isPlayer2 && this.selectedLevel === 'Hell') {
            velocityY = -1500; // 25% more vertical force for AI on Hell level (tallest net!)
        }
        
        // Apply level speed multiplier
        ball.setVelocity(velocityX * this.levelConfig.ballSpeed, velocityY * this.levelConfig.ballSpeed);
        
        // Add some spin
        ball.setAngularVelocity(velocityX * 2);
    }

    handleBallFloor(ball = this.ball) {
        if (this.isServing) return;

        const ballX = ball.x;
        const ballY = ball.y; // Capture position before reset

        // Show visual "Point!" popup at impact location
        this.showPointPopup(ballX, ballY - 20);

        // Particle explosion effect
        this.createExplosion(ballX, ballY);

        // Level-specific ground impact effects
        if (this.selectedLevel === 'Lava') {
            this.createLavaGroundImpact(ballX, ballY);
        } else if (this.selectedLevel === 'Hell') {
            this.createIceGroundImpact(ballX, ballY);
        }

        // Screen shake effect - strongest for Hell, strong for Lava
        let shakeIntensity = 0.01; // Beach default
        if (this.selectedLevel === 'Lava') shakeIntensity = 0.015;
        if (this.selectedLevel === 'Hell') shakeIntensity = 0.02; // Strongest shake!
        this.cameras.main.shake(200, shakeIntensity);
        
        // Play ground hit sound
        this.playGroundHitSound();

        // Update rally stats - rally ended
        if (this.matchStats.currentRally > 0) {
            this.matchStats.totalRallies++;
        }
        this.matchStats.currentRally = 0;

        // MULTIBALL: If this is an extra ball, remove it
        if (this.multiballActive && ball !== this.ball) {
            this.removeExtraBall(ball);
            return; // Don't score a point or reset round
        }

        if (ballX < CONFIG.WIDTH / 2) {
            this.score2++;
            this.servingSide = 1; // Lost point, you serve
        } else {
            this.score1++;
            this.servingSide = 2; // Lost point, you serve
        }

        this.updateScore();
        this.resetRound();
    }

    createLavaGroundImpact(x, y) {
        // Create lava splash particles
        const particleCount = 30;
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI - Math.PI / 2; // Upward spray
            const speed = 200 + Math.random() * 300;
            const size = 5 + Math.random() * 10;
            
            const particle = this.add.circle(x, y, size, 0xff4400, 1);
            particle.setBlendMode(Phaser.BlendModes.ADD);
            particle.setDepth(20);
            
            // Add glow
            const glow = this.add.circle(x, y, size * 1.5, 0xff8800, 0.6);
            glow.setBlendMode(Phaser.BlendModes.ADD);
            glow.setDepth(19);
            
            this.tweens.add({
                targets: particle,
                x: x + Math.cos(angle) * speed * 0.8,
                y: y + Math.sin(angle) * speed - 100,
                alpha: 0,
                scale: 0.2,
                duration: 800 + Math.random() * 400,
                ease: 'Power2',
                onComplete: () => particle.destroy()
            });
            
            this.tweens.add({
                targets: glow,
                x: x + Math.cos(angle) * speed * 0.8,
                y: y + Math.sin(angle) * speed - 100,
                alpha: 0,
                scale: 0.1,
                duration: 800 + Math.random() * 400,
                ease: 'Power2',
                onComplete: () => glow.destroy()
            });
        }

        // Lava pool splash waves
        for (let i = 0; i < 3; i++) {
            const wave = this.add.circle(x, y, 20, 0xff2200, 0);
            wave.setStrokeStyle(4 - i, 0xff6600);
            wave.setBlendMode(Phaser.BlendModes.ADD);
            wave.setDepth(18);
            
            this.tweens.add({
                targets: wave,
                radius: 100 + i * 30,
                alpha: { from: 0.8, to: 0 },
                duration: 600 + i * 100,
                delay: i * 100,
                ease: 'Quad.easeOut',
                onComplete: () => wave.destroy()
            });
        }

        // Rising heat distortion effect
        for (let i = 0; i < 8; i++) {
            const heat = this.add.circle(
                x + (Math.random() - 0.5) * 80,
                y,
                15 + Math.random() * 15,
                0xffaa00,
                0.3
            );
            heat.setBlendMode(Phaser.BlendModes.ADD);
            heat.setDepth(19);
            
            this.tweens.add({
                targets: heat,
                y: y - 200 - Math.random() * 100,
                x: heat.x + (Math.random() - 0.5) * 50,
                scaleX: { from: 1, to: 2 },
                scaleY: { from: 1, to: 0.3 },
                alpha: 0,
                duration: 1000 + Math.random() * 500,
                ease: 'Sine.easeOut',
                onComplete: () => heat.destroy()
            });
        }

        // Molten rock chunks
        for (let i = 0; i < 5; i++) {
            const angle = Math.random() * Math.PI * 0.8 + Math.PI * 0.1;
            const chunk = this.add.rectangle(
                x,
                y,
                8 + Math.random() * 8,
                8 + Math.random() * 8,
                0x661100
            );
            chunk.setDepth(20);
            
            // Add glow to chunk
            const chunkGlow = this.add.circle(
                x,
                y,
                chunk.width,
                0xff4400,
                0.8
            );
            chunkGlow.setBlendMode(Phaser.BlendModes.ADD);
            chunkGlow.setDepth(19);
            
            const distance = 100 + Math.random() * 150;
            const targetX = x + Math.cos(angle) * distance;
            const targetY = y + Math.sin(angle) * distance;
            
            this.tweens.add({
                targets: [chunk, chunkGlow],
                x: targetX,
                y: targetY,
                rotation: Math.random() * Math.PI * 4,
                alpha: { from: 1, to: 0 },
                duration: 1200,
                ease: 'Power2',
                onComplete: () => {
                    chunk.destroy();
                    chunkGlow.destroy();
                }
            });
        }

        // Fiery flash
        const flash = this.add.circle(x, y, 80, 0xffff00, 0.8);
        flash.setBlendMode(Phaser.BlendModes.ADD);
        flash.setDepth(21);
        
        this.tweens.add({
            targets: flash,
            scale: 2.5,
            alpha: 0,
            duration: 300,
            ease: 'Quad.easeOut',
            onComplete: () => flash.destroy()
        });
    }

    createExplosionEmitter() {
        // Create particle emitter for explosion
        // We create it once and reuse it
        if (this.explosionParticles) {
            this.explosionParticles.destroy();
        }

        this.explosionParticles = this.add.particles(0, 0, this.levelConfig.ballKey, {
            lifespan: 800,
            speed: { min: 100, max: 300 },
            scale: { start: 0.1, end: 0 },
            alpha: { start: 1, end: 0 },
            gravityY: 500,
            blendMode: 'ADD',
            emitting: false
        });
        
        this.explosionParticles.setDepth(20);
    }

    createExplosion(x, y) {
        if (this.explosionParticles) {
            // Trigger explosion
            this.explosionParticles.explode(20, x, y);
        }
        
        // Use color based on level for the ring effect
        let color = 0xffffaa; // Beach default
        if (this.selectedLevel === 'Lava') color = 0xffaa00;
        if (this.selectedLevel === 'Hell') color = 0xaaddff; // Icy blue
        
        // Create a ring wave effect
        const ring = this.add.circle(x, y, 10, color, 0);
        ring.setStrokeStyle(4, color);
        
        this.tweens.add({
            targets: ring,
            radius: 100,
            alpha: { from: 1, to: 0 },
            strokeWidth: 0,
            duration: 400,
            ease: 'Quad.easeOut',
            onComplete: () => ring.destroy()
        });
    }

    showPointPopup(x, y) {
        // Create a container for the effect
        const container = this.add.container(x, y);
        
        // "POINT!" text with thick stroke
        const text = this.add.text(0, 0, 'POINT!', {
            fontFamily: '"Press Start 2P"',
            fontSize: '24px',
            fill: '#ffff00',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        
        // Star/burst shape behind text
        const burst = this.add.star(0, 0, 5, 30, 60, 0xff0000);
        burst.setAlpha(0.7);
        
        // Shockwave ring
        const ring = this.add.circle(0, 0, 10, 0xffffff, 0);
        ring.setStrokeStyle(4, 0xffffff);
        
        container.add([burst, ring, text]);
        container.setDepth(100); // On top of everything
        
        // Animate the popup
        
        // 1. Text pops up and floats
        this.tweens.add({
            targets: text,
            y: -50,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 500,
            ease: 'Back.easeOut'
        });
        
        // 2. Burst spins and fades
        this.tweens.add({
            targets: burst,
            angle: 180,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 600,
            ease: 'Quad.easeOut'
        });
        
        // 3. Ring expands rapidly
        this.tweens.add({
            targets: ring,
            radius: 80,
            alpha: { from: 1, to: 0 },
            strokeWidth: 0,
            duration: 400,
            ease: 'Quad.easeOut'
        });
        
        // 4. Whole container fades out and destroys
        this.tweens.add({
            targets: container,
            alpha: 0,
            duration: 300,
            delay: 700,
            onComplete: () => container.destroy()
        });
    }

    updateScore() {
        this.scoreText.setText(`${this.score1} - ${this.score2}`);
        if (this.score1 >= CONFIG.MAX_SCORE || this.score2 >= CONFIG.MAX_SCORE) {
            this.gameOver();
        }
    }

    resetRound() {
        this.isServing = true;
        // Reset last ball hitter when round resets
        this.lastBallHitter = this.servingSide === 1 ? 'player1' : 'player2';
        
        // ⚠️ FAILSAFE #2: HARDENED AI RESET - Aggressively reset AI state
        if (this.aiState) {
            console.log('🔄 AI RESET: Clearing all AI state for new round');
            this.aiState.serveAttemptTimer = 0;
            this.aiState.serveStartTime = 0;
            this.aiState.stuckTimer = 0;
            this.aiState.lastJumpTime = 0;
            this.aiState.backwardsFacing = 0;
            this.aiState.lastPosition = this.player2.x;
        }
        
        // Force AI player into correct starting position if they're serving
        if (this.servingSide === 2) {
            console.log('🎯 AI SERVE: Positioning AI for serve');
            const serveX = CONFIG.WIDTH * 0.8;
            const serveY = CONFIG.GROUND_Y - 100;
            this.player2.setPosition(serveX, serveY);
            this.player2.setVelocity(0, 0); // Stop all movement
            this.player2.setAngularVelocity(0); // Stop rotation if any
        }
        
        // Clean up multiball state
        if (this.multiballActive) {
            // Destroy all extra balls
            for (const extraBall of this.extraBalls) {
                if (extraBall && extraBall.active) {
                    extraBall.destroy();
                }
            }
            this.extraBalls = [];
            this.balls = [this.ball];
            this.multiballActive = false;
            
            // Remove balls left text
            if (this.ballsLeftText) {
                this.ballsLeftText.destroy();
                this.ballsLeftText = null;
            }
        }
        
        // Position the ball in the air so player can hit it to serve
        this.ball.reset(this.servingSide === 1 ? CONFIG.WIDTH * 0.2 : CONFIG.WIDTH * 0.8, CONFIG.HEIGHT * 0.5);
        this.serveText.setVisible(true);
    }

    serveBall() {
        this.isServing = false;
        this.serveText.setVisible(false);
        this.ball.serve(this.servingSide === 1 ? 1 : -1);
    }
    playHitSound(pitch = 1) {
        this.playTone(300 * pitch, 0.1, 'sine', 0.18);
    }
    
    playCollectionSound() {
        // Upward sweep for collection
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        // Frequency sweep upward
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
        
        // Volume envelope
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        
        osc.type = 'square';
        osc.start(now);
        osc.stop(now + 0.15);
    }
    
    playActivationSound(type) {
        // Different sounds for different power-up types
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        
        if (type === 'shrink') {
            // Downward whoosh for shrink
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(200, now + 0.3);
            
            gain.gain.setValueAtTime(0.24, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            
            osc.type = 'sawtooth';
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'slow') {
            // Pulsing tone for slow
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const lfo = ctx.createOscillator();
            const lfoGain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            lfo.connect(lfoGain);
            lfoGain.connect(gain.gain);
            
            osc.frequency.setValueAtTime(300, now);
            lfo.frequency.setValueAtTime(8, now);
            
            gain.gain.setValueAtTime(0.12, now);
            lfoGain.gain.setValueAtTime(0.09, now);
            
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            
            osc.type = 'triangle';
            lfo.type = 'sine';
            
            osc.start(now);
            lfo.start(now);
            osc.stop(now + 0.4);
            lfo.stop(now + 0.4);
        }
    }
    
    playRecoverySound() {
        // Bright chime for recovery
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        
        osc1.frequency.setValueAtTime(523.25, now); // C5
        osc2.frequency.setValueAtTime(659.25, now); // E5
        
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        
        osc1.type = 'sine';
        osc2.type = 'sine';
        
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.3);
        osc2.stop(now + 0.3);
    }
    
    playGroundHitSound() {
        // Heavy thud sound for ground impact
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        // Low frequency drop
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
        
        // Quick decay
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        
        // Square wave for "crunchy" sound
        osc.type = 'square';
        
        osc.start(now);
        osc.stop(now + 0.2);
        
        // Add a noise burst for texture
        const bufferSize = ctx.sampleRate * 0.1; // 0.1 seconds
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = ctx.createGain();
        
        noise.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        
        noiseGain.gain.setValueAtTime(0.1, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        
        noise.start(now);
    }
    
    playTone(frequency, duration, type = 'sine', volume = 0.18) {
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.setValueAtTime(frequency, now);
        osc.type = type;
        
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        
        osc.start(now);
        osc.stop(now + duration);
    }

    update() {
        // Handle ESC key to show exit confirmation
        if (Phaser.Input.Keyboard.JustDown(this.escKey) && !this.isPaused) {
            this.showExitConfirmation();
        }
        
        // Skip rest of update if paused
        if (this.isPaused) {
            return;
        }
        
        // Move clouds
        this.clouds.forEach(cloud => {
            cloud.x += 0.5;
            if (cloud.x > CONFIG.WIDTH + 200) cloud.x = -200;
        });

        // Update power-up
        if (this.activePowerUp) {
            this.activePowerUp.update();
        }
        
        // Update power-up effects
        this.updatePowerUpEffects();

        this.player1.update();
        
        // AI Logic for Player 2
        this.updateAI();
        this.player2.update();
        
        // ⚠️ FAILSAFE #3: Continuous AI position monitoring during serve
        if (this.isServing && this.servingSide === 2) {
            const ballX = this.ball.x;
            const distanceToBall = Math.abs(this.player2.x - ballX);
            
            // If AI is extremely far from serve position, aggressively reposition
            if (distanceToBall > 800) {
                console.log('🚨 EMERGENCY REPOSITION: AI way too far from serve ball');
                const emergencyX = ballX + 100; // Position near ball
                this.player2.setX(emergencyX);
                
                // Keep AI on the right side
                if (this.player2.x < CONFIG.WIDTH / 2 + 100) {
                    this.player2.setX(CONFIG.WIDTH / 2 + 100);
                }
            }
            
            // Update serve text with countdown when approaching timeout
            if (this.aiState && this.aiState.serveStartTime > 0) {
                const timeElapsed = this.time.now - this.aiState.serveStartTime;
                const timeRemaining = 3000 - timeElapsed;
                
                if (timeRemaining < 2000 && timeRemaining > 0) {
                    const secondsLeft = Math.ceil(timeRemaining / 1000);
                    this.serveText.setText(`CPU SERVING... ${secondsLeft}`);
                    
                    // Flash warning at 1 second
                    if (secondsLeft === 1) {
                        const flashAlpha = 0.5 + Math.sin(this.time.now / 100) * 0.5;
                        this.serveText.setAlpha(flashAlpha);
                    }
                }
            }
        } else if (this.isServing && this.servingSide === 1) {
            // Reset serve text for player 1
            if (this.serveText.text !== 'HIT THE BALL TO SERVE!') {
                this.serveText.setText('HIT THE BALL TO SERVE!');
                this.serveText.setAlpha(1);
            }
        }

        // Update all balls (main ball + extra balls from multiball)
        for (const ball of this.balls) {
            if (ball && ball.active) {
                ball.update();
            }
        }

        // Constrain players to their respective sides - ULTRA STRICT boundaries
        // We calculate exact boundaries so player collider edge never touches net collider edge
        
        const netHalfWidth = CONFIG.NET_WIDTH / 2;
        // Use physics body width if available, otherwise estimate
        const p1HalfWidth = this.player1.body ? this.player1.body.width / 2 : 60;
        const p2HalfWidth = this.player2.body ? this.player2.body.width / 2 : 60;
        const safetyMargin = 5; // Extra pixel gap just to be sure
        // Calculate absolute X limit for Player 1 (Left Side)
        // Net Center X - Net Half Width - Player Half Width - Safety
        const p1Limit = this.net.x - netHalfWidth - p1HalfWidth - safetyMargin;
        // Calculate absolute X limit for Player 2 (Right Side)
        // Net Center X + Net Half Width + Player Half Width + Safety
        const p2Limit = this.net.x + netHalfWidth + p2HalfWidth + safetyMargin;
        
        // Player 1 Enforcement
        if (this.player1.x > p1Limit) {
            this.player1.setX(p1Limit);
            // Kill forward velocity immediately
            if (this.player1.body.velocity.x > 0) {
                this.player1.setVelocityX(0);
            }
        }
        
        // Player 2 Enforcement
        if (this.player2.x < p2Limit) {
            this.player2.setX(p2Limit);
            // Kill forward velocity immediately
            if (this.player2.body.velocity.x < 0) {
                this.player2.setVelocityX(0);
            }
        }
        // Anti-camping / Slide-off Logic
        // If player somehow gets above the net (e.g. high jump + dive), force them to slide off
        const netTopY = this.net.y - this.levelConfig.netHeight / 2;
        const dangerZoneY = netTopY + 80; // Area just above/on top of net
        const slideSpeed = 200;
        // Check if Player 1 is over the forbidden center zone
        if (this.player1.y < dangerZoneY && this.player1.x > p1Limit - 50) {
            // Force push left
            this.player1.setVelocityX(-slideSpeed);
            this.player1.x -= 5; // Direct position nudge
        }
        // Check if Player 2 is over the forbidden center zone
        if (this.player2.y < dangerZoneY && this.player2.x < p2Limit + 50) {
            // Force push right
            this.player2.setVelocityX(slideSpeed);
            this.player2.x += 5; // Direct position nudge
        }
        // Also prevent from going too far to sides
        if (this.player1.x < 80) {
            this.player1.setX(80);
            this.player1.setVelocityX(Math.max(0, this.player1.body.velocity.x));
        }
        
        if (this.player2.x > CONFIG.WIDTH - 80) {
            this.player2.setX(CONFIG.WIDTH - 80);
            this.player2.setVelocityX(Math.min(0, this.player2.body.velocity.x));
        }
        
        // Prevent players from falling below the ground level (at WASD text area)
        const maxPlayerY = CONFIG.GROUND_Y - 50; // Keep players above the ground with margin
        if (this.player1.body && this.player1.y > maxPlayerY) {
            this.player1.setY(maxPlayerY);
            if (this.player1.body.velocity.y > 0) {
                this.player1.setVelocityY(0);
            }
        }
        
        if (this.player2.body && this.player2.y > maxPlayerY) {
            this.player2.setY(maxPlayerY);
            if (this.player2.body.velocity.y > 0) {
                this.player2.setVelocityY(0);
            }
        }

        // Update power meter UI
        this.updatePowerMeterUI();
    }

    createPowerUpOverlays() {
        // Create visual overlays for power-up effects
        this.powerUpOverlays = {
            player1: this.add.circle(0, 0, 80, 0xffffff, 0).setBlendMode(Phaser.BlendModes.ADD),
            player2: this.add.circle(0, 0, 80, 0xffffff, 0).setBlendMode(Phaser.BlendModes.ADD)
        };
    }

    updatePowerMeterUI() {
        // Power meter UI for Player 1 - REMOVED
        if (!this.powerMeterBar) {
            // Power meter removed per user request
            this.powerMeterBar = { width: 0, x: 0, fillColor: 0x00ff00 }; // Dummy object to prevent recreation
            
            // Create power-up effect timers with retro arcade styling
            this.powerUpTimerBars = {
                player1: {
                    container: this.add.container(0, 0).setVisible(false),
                    // Outer glow
                    glow: this.add.rectangle(0, 0, 240, 100, 0x00ffff, 0.2),
                    // Main background with border
                    bg: this.add.rectangle(0, 0, 220, 80, 0x000000, 0.9),
                    border: this.add.rectangle(0, 0, 220, 80, 0x00ffff, 0).setStrokeStyle(3, 0x00ffff),
                    // Player name
                    playerName: this.add.text(0, -25, 'PLAYER 1', {
                        fontFamily: '"Press Start 2P"',
                        fontSize: '14px',
                        fill: '#00ffff',
                        stroke: '#000000',
                        strokeThickness: 4
                    }).setOrigin(0.5),
                    // Effect name
                    effectText: this.add.text(0, 0, '', {
                        fontFamily: '"Press Start 2P"',
                        fontSize: '16px',
                        fill: '#ffffff',
                        stroke: '#000000',
                        strokeThickness: 4
                    }).setOrigin(0.5),
                    // Timer bar background
                    barBg: this.add.rectangle(0, 20, 180, 16, 0x333333, 1),
                    // Timer bar fill
                    bar: this.add.rectangle(-90, 20, 0, 12, 0x00ffff, 1),
                    // Time remaining text
                    timeText: this.add.text(92, 20, '', {
                        fontFamily: '"Press Start 2P"',
                        fontSize: '12px',
                        fill: '#ffffff'
                    }).setOrigin(0, 0.5),
                    // Icon image
                    icon: this.add.image(-85, 0, 'icon-slow').setScale(0.06).setVisible(false)
                },
                player2: {
                    container: this.add.container(0, 0).setVisible(false),
                    // Outer glow
                    glow: this.add.rectangle(0, 0, 240, 100, 0xff00ff, 0.2),
                    // Main background with border
                    bg: this.add.rectangle(0, 0, 220, 80, 0x000000, 0.9),
                    border: this.add.rectangle(0, 0, 220, 80, 0xff00ff, 0).setStrokeStyle(3, 0xff00ff),
                    // Player name
                    playerName: this.add.text(0, -25, 'PLAYER 2', {
                        fontFamily: '"Press Start 2P"',
                        fontSize: '14px',
                        fill: '#ff00ff',
                        stroke: '#000000',
                        strokeThickness: 4
                    }).setOrigin(0.5),
                    // Effect name
                    effectText: this.add.text(0, 0, '', {
                        fontFamily: '"Press Start 2P"',
                        fontSize: '16px',
                        fill: '#ffffff',
                        stroke: '#000000',
                        strokeThickness: 4
                    }).setOrigin(0.5),
                    // Timer bar background
                    barBg: this.add.rectangle(0, 20, 180, 16, 0x333333, 1),
                    // Timer bar fill
                    bar: this.add.rectangle(-90, 20, 0, 12, 0xff00ff, 1),
                    // Time remaining text
                    timeText: this.add.text(92, 20, '', {
                        fontFamily: '"Press Start 2P"',
                        fontSize: '12px',
                        fill: '#ffffff'
                    }).setOrigin(0, 0.5),
                    // Icon image
                    icon: this.add.image(-85, 0, 'icon-slow').setScale(0.06).setVisible(false)
                }
            };
            
            // Add all elements to containers
            ['player1', 'player2'].forEach(key => {
                const timer = this.powerUpTimerBars[key];
                timer.container.add([
                    timer.glow,
                    timer.bg,
                    timer.border,
                    timer.playerName,
                    timer.icon,
                    timer.effectText,
                    timer.barBg,
                    timer.bar,
                    timer.timeText
                ]);
                timer.container.setDepth(100); // Keep on top
            });
        }
        
        // Power meter update removed
        
        // Update power-up effect timers and overlays
        ['player1', 'player2'].forEach(playerKey => {
            const effect = this.powerUpEffects[playerKey];
            const player = playerKey === 'player1' ? this.player1 : this.player2;
            const timer = this.powerUpTimerBars[playerKey];
            const overlay = this.powerUpOverlays[playerKey];
            
            // Safety check: make sure all objects exist and are active
            if (!timer || !timer.effectText || !timer.timeText || !player || !overlay) {
                return;
            }
            
            // Extra safety: check if objects are still valid/active in scene
            if (!timer.effectText.scene || !timer.timeText.scene) {
                return;
            }
            
            if (effect.type && effect.endTime > this.time.now) {
                // Show and update timer
                timer.container.setVisible(true);
                
                // Position in top corners
                const xPos = playerKey === 'player1' ? 150 : CONFIG.WIDTH - 150;
                const yPos = 180;
                timer.container.setPosition(xPos, yPos);
                
                // Calculate remaining time
                const timeRemaining = effect.endTime - this.time.now;
                const timePercent = timeRemaining / 10000; // 10 seconds total
                const secondsLeft = Math.ceil(timeRemaining / 1000);
                
                // Update bar width
                timer.bar.width = timePercent * 176; // 180 - 4 padding
                timer.bar.x = -90 + (timer.bar.width / 2);
                
                // Color based on effect type
                const color = effect.type === 'shrink' ? 0xff00ff : 0x00ffff;
                const playerColor = playerKey === 'player1' ? 0x00ffff : 0xff00ff;
                timer.bar.fillColor = color;
                timer.border.setStrokeStyle(3, playerColor);
                timer.glow.fillColor = playerColor;
                
                // Update text and icon
                const effectName = effect.type === 'shrink' ? 'SHRINK' : 'SLOW';
                const iconKey = effect.type === 'shrink' ? 'icon-shrink' : 'icon-slow';
                const hexColor = '#' + color.toString(16).padStart(6, '0');
                timer.effectText.setText(effectName);
                timer.effectText.setColor(hexColor);
                timer.timeText.setText(`${secondsLeft}s`);
                
                // Update icon
                timer.icon.setTexture(iconKey);
                timer.icon.setVisible(true);
                timer.icon.setTint(color);
                
                // Pulse effect when time is running out
                if (timeRemaining < 3000) {
                    const pulseScale = 1 + Math.sin(this.time.now / 100) * 0.05;
                    timer.container.setScale(pulseScale);
                    // Flash border
                    const flashAlpha = 0.5 + Math.sin(this.time.now / 100) * 0.5;
                    timer.border.setAlpha(flashAlpha);
                    timer.glow.setAlpha(0.3 + Math.sin(this.time.now / 100) * 0.2);
                } else {
                    timer.container.setScale(1);
                    timer.border.setAlpha(1);
                    timer.glow.setAlpha(0.2);
                }
                
                // Update overlay on player
                overlay.setPosition(player.x, player.y);
                overlay.setVisible(true);
                overlay.fillColor = color;
            } else {
                // Hide timer and overlay
                timer.container.setVisible(false);
                overlay.setVisible(false);
            }
        });
    }

    updateAI() {
        // ═══════════════════════════════════════════════════════════════════
        // AI SERVE FAILSAFES - GUARANTEED SERVE WITHIN 3 SECONDS
        // ═══════════════════════════════════════════════════════════════════
        // 1. 3-SECOND TIMEOUT: Auto-serve if CPU takes too long
        // 2. HARDENED RESET: Aggressive state clearing between rounds
        // 3. AUTO-UNSTUCK: Multi-level teleportation system
        //    - Level 1: Distance > 600px, frame > 20 → teleport
        //    - Level 2: Distance > 400px, frame > 50 → teleport
        //    - Level 3: Distance > 300px, frame > 90 → aggressive teleport
        // 4. BOUNDARY ENFORCEMENT: Keep AI on right side during serve
        // 5. CONTINUOUS MONITORING: Emergency reposition if distance > 800px
        // 6. VISUAL FEEDBACK: Countdown timer + flash warning
        // ═══════════════════════════════════════════════════════════════════
        
        // MULTIBALL: Track closest ball to AI
        let targetBall = this.ball;
        let minDistance = Infinity;
        
        if (this.multiballActive) {
            for (const ball of this.balls) {
                const dist = Phaser.Math.Distance.Between(this.player2.x, this.player2.y, ball.x, ball.y);
                if (dist < minDistance) {
                    minDistance = dist;
                    targetBall = ball;
                }
            }
        }
        
        const ballX = targetBall.x;
        const ballY = targetBall.y;
        const ballVelX = targetBall.body.velocity.x;
        const ballVelY = targetBall.body.velocity.y;
        
        // AI difficulty multiplier - Hell gets GOD-LIKE boost
        let aiSkillMultiplier = 1.125; // Beach
        if (this.selectedLevel === 'Lava') aiSkillMultiplier = 1.35; 
        if (this.selectedLevel === 'Hell') aiSkillMultiplier = 10.0; // GOD-LIKE REACTION TIME!
        
        // Initialize AI state tracker
        if (!this.aiState) {
            this.aiState = { 
                lastPosition: this.player2.x,
                stuckTimer: 0,
                lastJumpTime: 0,
                backwardsFacing: 0,
                serveAttemptTimer: 0,
                serveStartTime: 0
            };
        }

        // Detect if stuck in same position
        if (Math.abs(this.player2.x - this.aiState.lastPosition) < 2) {
            this.aiState.stuckTimer++;
        } else {
            this.aiState.stuckTimer = 0;
        }
        this.aiState.lastPosition = this.player2.x;

        // Always reset controls first
        this.p2Controls.left.isDown = false;
        this.p2Controls.right.isDown = false;
        this.p2Controls.up.isDown = false;
        this.p2Controls.down.isDown = false;

        const distanceToBall = Math.abs(this.player2.x - ballX);
        const isBallOnRightSide = ballX > CONFIG.WIDTH / 2;
        const isBallComingToSide = ballVelX > -300 || isBallOnRightSide;
        const isGrounded = this.player2.body.blocked.down;

        // SERVING - 200% GUARANTEED SUCCESS with ultra-aggressive logic + 3-SECOND FAILSAFE
        if (this.isServing && this.servingSide === 2) {
            // Track when serve started
            if (this.aiState.serveAttemptTimer === 0) {
                this.aiState.serveStartTime = this.time.now;
            }
            
            // Increment serve attempt timer
            this.aiState.serveAttemptTimer++;
            
            // Calculate distance to ball
            const distX = ballX - this.player2.x;
            const distY = ballY - this.player2.y;
            const totalDistance = Math.sqrt(distX * distX + distY * distY);
            
            // ⚠️ FAILSAFE #1: 3-SECOND TIMEOUT - Force serve if taking too long
            const timeElapsed = this.time.now - this.aiState.serveStartTime;
            if (timeElapsed > 3000) {
                console.log('🚨 SERVE TIMEOUT FAILSAFE: Forcing serve after 3 seconds');
                
                // Show "AUTO-SERVE" indicator
                const autoServeText = this.add.text(
                    CONFIG.WIDTH / 2, 
                    CONFIG.HEIGHT / 2 + 100, 
                    'AUTO-SERVE!', 
                    {
                        fontFamily: '"Press Start 2P"',
                        fontSize: '32px',
                        fill: '#ff0000',
                        stroke: '#000000',
                        strokeThickness: 6
                    }
                ).setOrigin(0.5).setDepth(200);
                
                this.tweens.add({
                    targets: autoServeText,
                    alpha: 0,
                    y: CONFIG.HEIGHT / 2 + 50,
                    duration: 800,
                    ease: 'Power2',
                    onComplete: () => autoServeText.destroy()
                });
                
                // Force the ball to be hit by setting it in motion
                this.isServing = false;
                this.serveText.setVisible(false);
                targetBall.body.setAllowGravity(true);
                
                // Give ball a basic serve trajectory
                const serveVelocityX = -400 - Math.random() * 200; // Towards player 1
                const serveVelocityY = -1200;
                targetBall.setVelocity(serveVelocityX, serveVelocityY);
                targetBall.setAngularVelocity(serveVelocityX * 2);
                
                // Screen flash to indicate forced serve
                this.cameras.main.flash(200, 255, 100, 0, false, null, 0.3);
                
                // Play sound
                this.playTone(150, 0.15, 'square', 0.2);
                
                // Reset AI state
                this.aiState.serveAttemptTimer = 0;
                this.aiState.serveStartTime = 0;
                return;
            }
            
            // ⚠️ FAILSAFE #3: AUTO-UNSTUCK - Teleport AI if too far from ball
            // Multiple thresholds for increasingly aggressive intervention
            if (totalDistance > 600 && this.aiState.serveAttemptTimer > 20) {
                console.log('🚨 AUTO-UNSTUCK LEVEL 1: AI very far, teleporting close');
                const targetX = ballX + 80; // Position under ball
                const targetY = CONFIG.GROUND_Y - 100; // On the ground
                this.player2.setPosition(targetX, targetY);
                this.player2.setVelocity(0, 0);
                this.player2.setAngularVelocity(0);
                this.aiState.serveAttemptTimer = 10; // Reset to phase 1
            } else if (totalDistance > 400 && this.aiState.serveAttemptTimer > 50) {
                console.log('🚨 AUTO-UNSTUCK LEVEL 2: AI moderately far for too long, teleporting');
                const targetX = ballX + 60;
                const targetY = CONFIG.GROUND_Y - 100;
                this.player2.setPosition(targetX, targetY);
                this.player2.setVelocity(0, 0);
                this.player2.setAngularVelocity(0);
                this.aiState.serveAttemptTimer = 20; // Skip to phase 2
            } else if (totalDistance > 300 && this.aiState.serveAttemptTimer > 90) {
                console.log('🚨 AUTO-UNSTUCK LEVEL 3: AI taking forever, aggressive teleport');
                // Teleport directly under the ball
                const targetX = ballX;
                const targetY = ballY + 50; // Position just below ball
                this.player2.setPosition(targetX, targetY);
                this.player2.setVelocity(0, 0);
                this.player2.setAngularVelocity(0);
                this.aiState.serveAttemptTimer = 40; // Skip to aggressive phase
            }
            
            // ⚠️ Enforce right side boundary during serve
            const rightSideMin = CONFIG.WIDTH / 2 + 100;
            if (this.player2.x < rightSideMin) {
                console.log('⚠️ AI crossed to left during serve, correcting position');
                this.player2.setX(rightSideMin);
                this.player2.setVelocityX(100); // Push right
            }
            
            // PHASE 1: First 10 frames - Always move directly towards ball
            if (this.aiState.serveAttemptTimer <= 10) {
                // Calculate safe target (ensure it's on right side)
                const safeTargetX = Math.max(ballX, rightSideMin);
                
                if (this.player2.x < safeTargetX - 10) {
                    this.p2Controls.right.isDown = true;
                } else if (this.player2.x > safeTargetX + 10) {
                    this.p2Controls.left.isDown = true;
                }
                // Start jumping immediately
                this.p2Controls.up.isDown = (this.aiState.serveAttemptTimer % 2) === 0;
                return;
            }
            
            // PHASE 2: Aggressive positioning + constant jumping
            // Move towards ball with tight tolerance
            if (this.player2.x < ballX - 15) {
                this.p2Controls.right.isDown = true;
                this.p2Controls.left.isDown = false;
            } else if (this.player2.x > ballX + 15) {
                this.p2Controls.left.isDown = true;
                this.p2Controls.right.isDown = false;
            } else {
                // Close enough - minimal adjustment
                if (this.player2.x < ballX - 5) {
                    this.p2Controls.right.isDown = true;
                } else if (this.player2.x > ballX + 5) {
                    this.p2Controls.left.isDown = true;
                }
            }
            
            // JUMP LOGIC: Multi-phase approach
            const verticalDist = Math.abs(distY);
            
            // Phase 1: First 20 frames - tap jump every 2 frames
            if (this.aiState.serveAttemptTimer <= 20) {
                this.p2Controls.up.isDown = (this.aiState.serveAttemptTimer % 2) === 0;
            }
            // Phase 2: 20-40 frames - faster tapping if close horizontally
            else if (this.aiState.serveAttemptTimer <= 40) {
                if (Math.abs(distX) < 100) {
                    // Very close - tap every frame
                    this.p2Controls.up.isDown = true;
                } else {
                    // Still approaching - tap every 2 frames
                    this.p2Controls.up.isDown = (this.aiState.serveAttemptTimer % 2) === 0;
                }
            }
            // Phase 3: 40-60 frames - ULTRA AGGRESSIVE
            else if (this.aiState.serveAttemptTimer <= 60) {
                // Spam jump every frame
                this.p2Controls.up.isDown = true;
                
                // Move aggressively towards ball
                if (this.player2.x < ballX) {
                    this.p2Controls.right.isDown = true;
                } else if (this.player2.x > ballX) {
                    this.p2Controls.left.isDown = true;
                }
            }
            // Phase 4: After 60 frames - NUCLEAR OPTION
            else {
                // Spam everything
                this.p2Controls.up.isDown = true;
                
                // If in air, try diving
                if (!isGrounded) {
                    const shouldDive = (this.aiState.serveAttemptTimer % 3) === 0;
                    this.p2Controls.down.isDown = shouldDive;
                }
                
                // Keep moving towards ball
                if (this.player2.x < ballX) {
                    this.p2Controls.right.isDown = true;
                } else if (this.player2.x > ballX) {
                    this.p2Controls.left.isDown = true;
                }
                
                // EMERGENCY: After 90 frames (1.5 seconds), force teleport near ball
                if (this.aiState.serveAttemptTimer > 90) {
                    // Move player closer to ball if they're stuck far away
                    if (Math.abs(distX) > 200) {
                        const targetX = ballX + (distX > 0 ? -100 : 100);
                        this.player2.x = Phaser.Math.Linear(this.player2.x, targetX, 0.1);
                    }
                }
            }
            
            return;
        } else {
            // ⚠️ FAILSAFE #2: Reset serve state when not serving
            if (this.aiState.serveAttemptTimer > 0 || this.aiState.serveStartTime > 0) {
                console.log('✅ AI SERVE COMPLETE: Resetting serve state');
                this.aiState.serveAttemptTimer = 0;
                this.aiState.serveStartTime = 0;
            }
        }

        // MOVEMENT - Hell level gets SUPERHUMAN prediction
        let predictionTime = 0.5 * aiSkillMultiplier;
        
        // Hell level: Advanced ball physics prediction with speed consideration
        if (this.selectedLevel === 'Hell') {
            // Predict ball trajectory with perfect gravity physics
            const gravity = this.levelConfig.gravity;
            
            // Quadratic equation for time to ground
            // y = y0 + v0*t + 0.5*g*t^2
            // 0.5*g*t^2 + v0*t + (y0 - groundY) = 0
            const a = 0.5 * gravity;
            const b = ballVelY;
            const c = ballY - (CONFIG.GROUND_Y - 100);
            
            const discriminant = b * b - 4 * a * c;
            if (discriminant >= 0) {
                const t = (-b + Math.sqrt(discriminant)) / (2 * a);
                predictionTime = t;
            } else {
                predictionTime = 1.0;
            }
        }
        
        let targetX = ballX + (ballVelX * predictionTime);
        
        // Better positioning logic based on ball state
        if (isBallOnRightSide && ballVelY > 0) {
            // Ball is falling on our side - be more aggressive
            predictionTime = 0.6 * aiSkillMultiplier;
            targetX = ballX + (ballVelX * predictionTime);
            
            // Hell level: Perfect positioning under falling ball
            if (this.selectedLevel === 'Hell') {
                targetX = ballX + (ballVelX * predictionTime * 1.2);
            }
        } else if (!isBallOnRightSide) {
            // Ball is on opponent's side - return to defensive position
            if (this.selectedLevel === 'Hell') {
                // Hell: Optimal defensive position (center-right)
                targetX = CONFIG.WIDTH * 0.7;
            } else {
                targetX = CONFIG.WIDTH * 0.75;
            }
        }
        
        // Keep on right side with better boundaries
        targetX = Math.max(CONFIG.WIDTH / 2 + 180, targetX);
        targetX = Math.min(CONFIG.WIDTH - 100, targetX);

        // If stuck, force movement
        if (this.aiState.stuckTimer > 40) {
            targetX = CONFIG.WIDTH * 0.7 + (Math.random() * 200);
            this.aiState.stuckTimer = 0; // Reset after forcing move
        }

        // Move towards target - Hell level gets PERFECT precision
        let moveThreshold = 50 / aiSkillMultiplier;
        
        // Hell level: Laser-precise movement
        if (this.selectedLevel === 'Hell') {
            moveThreshold = 5; // Nearly pixel-perfect positioning
        }
        
        if (this.player2.x < targetX - moveThreshold) {
            this.p2Controls.right.isDown = true;
        } else if (this.player2.x > targetX + moveThreshold) {
            this.p2Controls.left.isDown = true;
        }

        // Detect if AI is facing backwards (ball behind them)
        const isBallBehind = (ballX < this.player2.x - 100) && isBallOnRightSide;
        if (isBallBehind) {
            this.aiState.backwardsFacing++;
            // If backwards for too long, move aggressively towards ball
            if (this.aiState.backwardsFacing > 20) {
                this.p2Controls.left.isDown = true;
                this.aiState.backwardsFacing = 0;
            }
        } else {
            this.aiState.backwardsFacing = 0;
        }

        // JUMPING - Hell level gets SUPERHUMAN timing
        const verticalDist = this.player2.y - ballY;
        const isInFrontOfBall = ballX >= this.player2.x - 60; // Ball is in front or slightly behind
        const isGoodJumpPosition = isInFrontOfBall || distanceToBall < 120 * aiSkillMultiplier;
        
        // Hell level: Enhanced jump prediction
        let jumpDistanceThreshold = 200 * aiSkillMultiplier;
        let jumpVerticalMin = 50 / aiSkillMultiplier;
        let jumpVerticalMax = 600;
        
        if (this.selectedLevel === 'Hell') {
            // SUPERHUMAN: Jump from much farther, with perfect timing
            // Increased thresholds to account for 20% faster ball speed
            jumpDistanceThreshold = 600; // Can jump from even farther (was 500)
            jumpVerticalMin = 10; // Jump for even low balls
            jumpVerticalMax = 900; // Jump for higher balls too (was 800)
        }
        
        // Jump conditions adjusted for difficulty
        const timeToJump = isGrounded && 
                          isBallComingToSide &&
                          isGoodJumpPosition &&
                          distanceToBall < jumpDistanceThreshold && 
                          verticalDist > jumpVerticalMin && 
                          verticalDist < jumpVerticalMax && 
                          ballVelY > -400;

        // Extra condition: don't jump if ball is way behind (unless Hell level)
        const shouldJump = this.selectedLevel === 'Hell' ? 
            timeToJump : // Hell: ignore ball behind check
            timeToJump && !isBallBehind; // Other levels: check ball position

        if (shouldJump) {
            this.p2Controls.up.isDown = true;
            this.aiState.lastJumpTime = this.time.now;
        }

        // DIVING - Hell level gets SUPERHUMAN dive accuracy
        const timeSinceJump = this.time.now - this.aiState.lastJumpTime;
        const canDive = !isGrounded && timeSinceJump > 200 / aiSkillMultiplier;
        
        // Hell level: Enhanced diving parameters
        let diveMinDist = 100 / aiSkillMultiplier;
        let diveMaxDist = 350 * aiSkillMultiplier;
        let diveVerticalThreshold = 120 * aiSkillMultiplier;
        
        if (this.selectedLevel === 'Hell') {
            // SUPERHUMAN: Dive from anywhere, perfect accuracy
            // Increased ranges to account for 20% faster ball speed
            diveMinDist = 20; // Can dive for very close balls
            diveMaxDist = 720; // Can dive from very far (was 600, +20%)
            diveVerticalThreshold = 240; // Dive for balls at any reasonable height (was 200, +20%)
        }
        
        const shouldDive = canDive &&
                          isBallComingToSide &&
                          distanceToBall > diveMinDist &&
                          distanceToBall < diveMaxDist &&
                          ballY > this.player2.y - diveVerticalThreshold &&
                          isInFrontOfBall; // Don't dive backwards

        if (shouldDive) {
            this.p2Controls.down.isDown = true;
            // Keep moving towards ball during dive
            if (ballX > this.player2.x) {
                this.p2Controls.right.isDown = true;
            } else if (ballX < this.player2.x - 50) {
                this.p2Controls.left.isDown = true;
            }
        }
        
        // Hell level: EMERGENCY DIVE - Last resort for desperate saves
        if (this.selectedLevel === 'Hell' && !isGrounded && !shouldDive) {
            const ballWillLandOnRightSide = ballX > CONFIG.WIDTH / 2;
            const ballIsFalling = ballVelY > 300;
            const ballIsLow = ballY > CONFIG.HEIGHT * 0.6;
            
            // Increased emergency range for faster ball (was 700, now 840 = +20%)
            if (ballWillLandOnRightSide && ballIsFalling && ballIsLow && distanceToBall < 840) {
                // DESPERATE SAVE ATTEMPT
                this.p2Controls.down.isDown = true;
                if (ballX > this.player2.x) {
                    this.p2Controls.right.isDown = true;
                } else {
                    this.p2Controls.left.isDown = true;
                }
                
                // Track desperate save attempt
                if (!this.aiState.desperateSaveAttempt) {
                    this.aiState.desperateSaveAttempt = true;
                }
            } else {
                this.aiState.desperateSaveAttempt = false;
            }
        }
    }

    spawnPowerUp() {
        // Don't spawn if one already exists
        if (this.activePowerUp) {
            return;
        }
        
        // Choose power-up type: slow or multiball (shrink removed)
        const types = ['slow', 'multiball'];
        const type = Phaser.Utils.Array.GetRandom(types);
        
        // Random side (left or right)
        const side = Math.random() > 0.5 ? 'left' : 'right';
        let x, y;
        
        // Configurable spawn areas (Strictly in corners: 200-350px height)
        const margin = 100; // From edge
        const areaWidth = 250; // Width of spawn zone
        
        if (side === 'left') {
            // Left side (Player 1's side)
            x = Phaser.Math.Between(margin, margin + areaWidth);
        } else {
            // Right side (Player 2's side)
            x = Phaser.Math.Between(CONFIG.WIDTH - (margin + areaWidth), CONFIG.WIDTH - margin);
        }
        
        // Y-coordinate: 200-350px (Upper area)
        y = Phaser.Math.Between(200, 350);
        
        this.activePowerUp = new PowerUp(this, x, y, type);
        
        // Add physics overlap detection between ball and power-up
        const collider = this.physics.add.overlap(
            this.ball, 
            this.activePowerUp, 
            this.handlePowerUpCollection, 
            null, 
            this
        );
        this.powerUpColliders.push(collider);
        
        // If not collected, respawn after 15-25 seconds (simulated by checking periodically)
        // We'll just set a timer to check later, if it still exists, we could destroy and recreate
        // but for now let's just leave it until collected as standard arcade behavior.
        // The prompt says "Jos ei kerätä, seuraava power-up 15-25 sekunnin kuluttua".
        // This implies the OLD one should disappear? Let's implement that cycle.
        
        this.currentPowerUpTimer = this.time.delayedCall(Phaser.Math.Between(15000, 25000), () => {
            if (this.activePowerUp) {
                // Play expiration animation before removing
                this.activePowerUp.playExpireAnimation(() => {
                    // Clear colliders
                    this.powerUpColliders.forEach(c => this.physics.world.removeCollider(c));
                    this.powerUpColliders = [];
                    this.activePowerUp = null;
                    
                    // Spawn new one after short delay
                    this.time.delayedCall(2000, () => this.spawnPowerUp());
                });
            }
        });
    }
    
    handlePowerUpCollection(ball, powerUp) {
        if (!powerUp.isActive) return;
        
        // The player who last hit the ball is the collector
        const collector = this.lastBallHitter;
        
        // If no one has hit the ball yet (shouldn't happen), default to player1
        if (!collector) {
            console.log('⚠️ No last hitter tracked, defaulting to player1');
            this.lastBallHitter = 'player1';
        }
        
        // The victim is always the OPPONENT of the collector
        const victim = collector === 'player1' ? 'player2' : 'player1';
        
        console.log(`✅ POWER-UP COLLECTED! ${collector} collected it, ${victim} gets affected with ${powerUp.type}`);
        
        // Update power-up collection stats
        this.matchStats.powerUpsCollected[collector]++;
        
        // Play collection sound
        this.playCollectionSound();
        
        // Collect visual
        powerUp.collect();
        
        // Apply effect to VICTIM
        this.applyPowerUpEffect(victim, powerUp.type);
        
        // Cleanup physics
        this.powerUpColliders.forEach(c => this.physics.world.removeCollider(c));
        this.powerUpColliders = [];
        this.activePowerUp = null;
        
        // Cancel the "despawn" timer since we collected it
        if (this.currentPowerUpTimer) this.currentPowerUpTimer.remove();
        
        // Spawn NEW power-up after 8-15 seconds
        this.time.delayedCall(Phaser.Math.Between(8000, 15000), () => this.spawnPowerUp());
    }
    
    applyPowerUpEffect(playerKey, type) {
        // MULTIBALL - doesn't affect a player, affects the game state
        if (type === 'multiball') {
            this.activateMultiball();
            return;
        }
        
        const player = playerKey === 'player1' ? this.player1 : this.player2;
        const endTime = this.time.now + 10000; // 10 seconds
        const overlay = this.powerUpOverlays[playerKey];
        
        // Clear any existing tween
        if (this.powerUpEffects[playerKey].tween) {
            this.powerUpEffects[playerKey].tween.stop();
        }
        
        // Create pulsing overlay effect
        const color = type === 'shrink' ? 0xff00ff : 0x00ffff;
        overlay.setPosition(player.x, player.y);
        overlay.fillColor = color;
        
        const pulseTween = this.tweens.add({
            targets: overlay,
            alpha: { from: 0.6, to: 0.2 },
            scale: { from: 1, to: 1.3 },
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // Store effect info
        this.powerUpEffects[playerKey] = { type, endTime, tween: pulseTween, overlay };
        
        // Play activation sound
        this.playActivationSound(type);
        
        // Apply slow effect
        if (type === 'slow') {
            // Slow player to 50% speed (handled in Player.js)
            this.showPowerUpIndicator(playerKey, '⊗ SLOW', 0x00ffff);
            
            // Add slow motion visual effect to player
            this.tweens.add({
                targets: player,
                tint: 0x00ffff,
                duration: 300,
                yoyo: true,
                repeat: 2
            });
        }
        
        // Screen flash effect (cyan for slow)
        this.cameras.main.flash(300, 0, 255, 255, false, null, 0.3);
    }
    
    activateMultiball() {
        // Don't activate if already active
        if (this.multiballActive) return;
        
        this.multiballActive = true;
        
        // Screen flash effect - magenta
        this.cameras.main.flash(400, 255, 0, 255, false, null, 0.4);
        
        // Show "3 BALLS!" text at center
        const multiballText = this.add.text(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, '3 BALLS!', {
            fontFamily: '"Press Start 2P"',
            fontSize: '64px',
            fill: '#ff00ff',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5).setScale(0).setDepth(200);
        
        // Animate text
        this.tweens.add({
            targets: multiballText,
            scaleX: 1.3,
            scaleY: 1.3,
            duration: 300,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: multiballText,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 200,
                    ease: 'Sine.easeInOut',
                    onComplete: () => {
                        this.tweens.add({
                            targets: multiballText,
                            y: 150,
                            alpha: 0,
                            duration: 800,
                            delay: 600,
                            ease: 'Power2',
                            onComplete: () => multiballText.destroy()
                        });
                    }
                });
            }
        });
        
        // Play special multiball sound
        this.playMultiballSound();
        
        // Create 2 extra balls (total 3 balls)
        this.createExtraBalls(2);
        
        // Update balls left text
        this.updateBallsLeftText();
    }
    
    createExtraBalls(count) {
        const ballScale = this.ball.scaleX; // Use same scale as main ball
        
        for (let i = 0; i < count; i++) {
            // Create new ball at main ball's position
            const extraBall = new Ball(this, this.ball.x, this.ball.y, this.levelConfig.ballKey);
            extraBall.setScale(ballScale);
            extraBall.levelSpeedMultiplier = this.levelConfig.ballSpeed;
            
            // Copy velocity from main ball with slight variation
            const angle = (Math.PI * 2 * i) / count;
            const offsetX = Math.cos(angle) * 200;
            const offsetY = Math.sin(angle) * 200 - 300;
            
            extraBall.setVelocity(
                this.ball.body.velocity.x + offsetX,
                this.ball.body.velocity.y + offsetY
            );
            
            // Enable gravity immediately
            extraBall.body.setAllowGravity(true);
            
            // Add physics collisions for this ball
            this.physics.add.collider(extraBall, this.net, () => {
                this.playHitSound(0.5);
            });
            
            this.physics.add.collider(extraBall, this.ground, (ball) => {
                this.handleBallFloor(ball);
            });
            
            this.physics.add.collider(extraBall, this.player1, (ball, p1) => this.handleBallPlayerCollision(ball, p1));
            this.physics.add.collider(extraBall, this.player2, (ball, p2) => this.handleBallPlayerCollision(ball, p2));
            
            // Add to tracking arrays
            this.balls.push(extraBall);
            this.extraBalls.push(extraBall);
            
            // Magenta spawn particles
            this.createMultiballSpawnEffect(extraBall.x, extraBall.y);
        }
    }
    
    createMultiballSpawnEffect(x, y) {
        // Magenta particle burst
        for (let i = 0; i < 30; i++) {
            const angle = (Math.PI * 2 * i) / 30;
            const speed = 150 + Math.random() * 200;
            const particle = this.add.circle(x, y, 8, 0xff00ff, 1);
            particle.setBlendMode(Phaser.BlendModes.ADD);
            particle.setDepth(20);
            
            this.tweens.add({
                targets: particle,
                x: x + Math.cos(angle) * speed,
                y: y + Math.sin(angle) * speed,
                alpha: 0,
                scale: 0,
                duration: 600 + Math.random() * 400,
                ease: 'Power2',
                onComplete: () => particle.destroy()
            });
        }
        
        // Flash effect
        const flash = this.add.circle(x, y, 100, 0xff00ff, 0.8);
        flash.setBlendMode(Phaser.BlendModes.ADD);
        flash.setDepth(21);
        
        this.tweens.add({
            targets: flash,
            scale: 2.5,
            alpha: 0,
            duration: 400,
            ease: 'Quad.easeOut',
            onComplete: () => flash.destroy()
        });
    }
    
    removeExtraBall(ball) {
        // Remove from arrays
        const ballIndex = this.balls.indexOf(ball);
        if (ballIndex > -1) {
            this.balls.splice(ballIndex, 1);
        }
        
        const extraIndex = this.extraBalls.indexOf(ball);
        if (extraIndex > -1) {
            this.extraBalls.splice(extraIndex, 1);
        }
        
        // Destroy the ball
        ball.destroy();
        
        // Update balls left text
        this.updateBallsLeftText();
        
        // If no extra balls left, deactivate multiball
        if (this.extraBalls.length === 0) {
            this.multiballActive = false;
            if (this.ballsLeftText) {
                this.ballsLeftText.destroy();
                this.ballsLeftText = null;
            }
        }
    }
    
    updateBallsLeftText() {
        // Remove old text if exists
        if (this.ballsLeftText) {
            this.ballsLeftText.destroy();
        }
        
        if (this.multiballActive && this.balls.length > 1) {
            const ballsCount = this.balls.length;
            this.ballsLeftText = this.add.text(
                CONFIG.WIDTH / 2, 
                150, 
                `${ballsCount} BALLS LEFT`, 
                {
                    fontFamily: '"Press Start 2P"',
                    fontSize: '32px',
                    fill: '#ff00ff',
                    stroke: '#000000',
                    strokeThickness: 6
                }
            ).setOrigin(0.5).setDepth(100);
            
            // Pulse effect
            this.tweens.add({
                targets: this.ballsLeftText,
                scaleX: 1.1,
                scaleY: 1.1,
                duration: 500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }
    
    playMultiballSound() {
        // Triple ascending tone for multiball
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        
        for (let i = 0; i < 3; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            // Ascending frequencies
            const freq = 400 + (i * 200);
            osc.frequency.setValueAtTime(freq, now + i * 0.1);
            
            gain.gain.setValueAtTime(0.15, now + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);
            
            osc.type = 'square';
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.3);
        }
    }
    
    updatePowerUpEffects() {
        const currentTime = this.time.now;
        
        // Check player 1 effects
        if (this.powerUpEffects.player1.type && currentTime >= this.powerUpEffects.player1.endTime) {
            this.removePowerUpEffect('player1');
        }
        
        // Check player 2 effects
        if (this.powerUpEffects.player2.type && currentTime >= this.powerUpEffects.player2.endTime) {
            this.removePowerUpEffect('player2');
        }
    }
    
    removePowerUpEffect(playerKey) {
        const player = playerKey === 'player1' ? this.player1 : this.player2;
        const effect = this.powerUpEffects[playerKey];
        
        // Stop pulsing tween
        if (effect.tween) {
            effect.tween.stop();
            effect.overlay.setAlpha(0);
        }
        
        // Slow effect is automatically removed when effect ends (speed returns to normal in Player.js)
        
        // Play recovery sound
        this.playRecoverySound();
        
        // Show "RECOVERED" message
        const indicator = this.add.text(player.x, player.y - 100, 'RECOVERED!', {
            fontFamily: '"Press Start 2P"',
            fontSize: '16px',
            fill: '#00ff00',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        this.tweens.add({
            targets: indicator,
            y: player.y - 150,
            alpha: 0,
            duration: 1500,
            ease: 'Power2',
            onComplete: () => indicator.destroy()
        });
        
        // Clear effect
        this.powerUpEffects[playerKey] = { type: null, endTime: 0, tween: null, overlay: effect.overlay };
    }
    
    showPowerUpIndicator(playerKey, text, color) {
        const player = playerKey === 'player1' ? this.player1 : this.player2;
        
        // Create colorful text with glow effect
        const hexColor = '#' + color.toString(16).padStart(6, '0');
        
        // Extract just the effect name (remove emoji)
        const effectName = text.split(' ')[1]; // Gets "SHRINK" or "SLOW"
        
        const indicator = this.add.text(player.x, player.y - 100, effectName, {
            fontFamily: '"Press Start 2P"',
            fontSize: '24px',
            fill: hexColor,
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5).setScale(0);
        
        // Add icon image above text
        const iconKey = effectName === 'SHRINK' ? 'icon-shrink' : 'icon-slow';
        const iconImage = this.add.image(player.x, player.y - 130, iconKey);
        iconImage.setScale(0.12);
        iconImage.setAlpha(0);
        
        // Pop in animation for text
        this.tweens.add({
            targets: indicator,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 200,
            ease: 'Back.easeOut',
            yoyo: true,
            onComplete: () => {
                // Float up and fade
                this.tweens.add({
                    targets: indicator,
                    y: player.y - 180,
                    alpha: 0,
                    duration: 1500,
                    ease: 'Power2',
                    onComplete: () => indicator.destroy()
                });
            }
        });
        
        // Pop in animation for icon
        this.tweens.add({
            targets: iconImage,
            scaleX: 0.15,
            scaleY: 0.15,
            alpha: 1,
            duration: 200,
            ease: 'Back.easeOut',
            yoyo: true,
            onComplete: () => {
                // Float up and fade
                this.tweens.add({
                    targets: iconImage,
                    y: player.y - 210,
                    alpha: 0,
                    duration: 1500,
                    ease: 'Power2',
                    onComplete: () => iconImage.destroy()
                });
            }
        });
        
        // Create particle burst effect
        const particleColor = color === 0xff00ff ? 0xff00ff : 0x00ffff;
        
        // Create multiple particles manually
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12;
            const speed = 200 + Math.random() * 100;
            const particle = this.add.circle(player.x, player.y, 8, particleColor, 1);
            
            this.tweens.add({
                targets: particle,
                x: player.x + Math.cos(angle) * speed,
                y: player.y + Math.sin(angle) * speed,
                alpha: 0,
                scale: 0,
                duration: 800 + Math.random() * 400,
                ease: 'Power2',
                onComplete: () => particle.destroy()
            });
        }
    }
    
    createBeachAmbience() {
        // Add seagull shadows that occasionally pass by
        this.time.addEvent({
            delay: Phaser.Math.Between(8000, 15000),
            callback: this.createSeagullShadow,
            callbackScope: this,
            loop: true
        });

        // Add sun glare effect
        this.createSunGlare();

        // Add gentle cloud movement variation
        this.time.addEvent({
            delay: 100,
            callback: () => {
                if (this.selectedLevel !== 'Beach') return;
                
                this.clouds.forEach((cloud, index) => {
                    // Add gentle bobbing motion
                    const bobAmount = Math.sin(this.time.now / 1000 + index) * 2;
                    cloud.y += bobAmount * 0.05;
                    
                    // Occasional scale pulsing
                    const pulseAmount = Math.sin(this.time.now / 2000 + index * 0.5) * 0.02;
                    cloud.scaleX += pulseAmount;
                });
            },
            loop: true
        });

        // Create heat haze particles
        this.time.addEvent({
            delay: 500,
            callback: this.createHeatHazeParticle,
            callbackScope: this,
            loop: true
        });
    }

    createSeagullShadow() {
        if (this.selectedLevel !== 'Beach') return;

        // Create fast-moving shadow that crosses the screen
        const startX = Math.random() > 0.5 ? -100 : CONFIG.WIDTH + 100;
        const endX = startX < 0 ? CONFIG.WIDTH + 100 : -100;
        const y = Phaser.Math.Between(200, 400);

        const shadow = this.add.ellipse(startX, y, 40, 20, 0x000000, 0.2);
        shadow.setDepth(2);

        this.tweens.add({
            targets: shadow,
            x: endX,
            y: y + Phaser.Math.Between(-50, 50),
            alpha: { from: 0.2, to: 0.3, yoyo: true },
            duration: 3000,
            ease: 'Sine.easeInOut',
            onComplete: () => shadow.destroy()
        });

        // Schedule next seagull
        this.time.delayedCall(Phaser.Math.Between(8000, 15000), () => {
            this.createSeagullShadow();
        });
    }

    createSunGlare() {
        // Create subtle sun rays effect
        const rays = this.add.circle(
            CONFIG.WIDTH * 0.8, 
            CONFIG.HEIGHT * 0.2, 
            150, 
            0xffff88, 
            0
        );
        rays.setBlendMode(Phaser.BlendModes.ADD);
        rays.setDepth(1);

        this.tweens.add({
            targets: rays,
            alpha: { from: 0.05, to: 0.15 },
            scale: { from: 1, to: 1.2 },
            duration: 4000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Add lens flare spots
        for (let i = 0; i < 3; i++) {
            const flare = this.add.circle(
                CONFIG.WIDTH * 0.8 - i * 100,
                CONFIG.HEIGHT * 0.2 + i * 30,
                20 - i * 5,
                0xffffff,
                0
            );
            flare.setBlendMode(Phaser.BlendModes.ADD);
            flare.setDepth(1);

            this.tweens.add({
                targets: flare,
                alpha: { from: 0.1, to: 0.25 },
                duration: 3000 + i * 500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }

    createHeatHazeParticle() {
        if (this.selectedLevel !== 'Beach') return;

        // Create subtle distortion particles that rise up
        const x = Phaser.Math.Between(0, CONFIG.WIDTH);
        const y = CONFIG.HEIGHT * 0.85;

        const haze = this.add.circle(x, y, 20, 0xffffff, 0.05);
        haze.setBlendMode(Phaser.BlendModes.ADD);
        haze.setDepth(2);

        this.tweens.add({
            targets: haze,
            y: y - 300,
            x: x + Phaser.Math.Between(-30, 30),
            scaleX: { from: 1, to: 2 },
            scaleY: { from: 1, to: 0.5 },
            alpha: { from: 0.05, to: 0 },
            duration: 4000,
            ease: 'Sine.easeOut',
            onComplete: () => haze.destroy()
        });
    }

    createWaveFoam() {
        // Create foam texture
        if (!this.textures.exists('foam')) {
            const size = 32;
            const canvas = this.textures.createCanvas('foam', size, size);
            const ctx = canvas.context;
            
            // White foam with transparency
            const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
            gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.6)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);
            canvas.refresh();
        }

        // Create multiple foam lines at different depths
        this.foamLines = [];
        
        // Front foam line (closest to camera)
        const frontFoam = this.add.particles(0, CONFIG.HEIGHT * 0.85, 'foam', {
            x: { min: 0, max: CONFIG.WIDTH },
            y: { min: -5, max: 5 },
            speedX: { min: 30, max: 80 },
            speedY: { min: -10, max: 10 },
            scale: { start: 0.8, end: 0.3 },
            alpha: { start: 0.9, end: 0 },
            lifespan: 3000,
            frequency: 150,
            blendMode: 'NORMAL'
        });
        frontFoam.setDepth(15);
        this.foamLines.push(frontFoam);

        // Middle foam line
        const midFoam = this.add.particles(0, CONFIG.HEIGHT * 0.75, 'foam', {
            x: { min: 0, max: CONFIG.WIDTH },
            y: { min: -3, max: 3 },
            speedX: { min: 20, max: 50 },
            speedY: { min: -8, max: 8 },
            scale: { start: 0.6, end: 0.2 },
            alpha: { start: 0.7, end: 0 },
            lifespan: 3500,
            frequency: 200,
            blendMode: 'NORMAL'
        });
        midFoam.setDepth(8);
        this.foamLines.push(midFoam);

        // Back foam line (furthest)
        const backFoam = this.add.particles(0, CONFIG.HEIGHT * 0.65, 'foam', {
            x: { min: 0, max: CONFIG.WIDTH },
            y: { min: -2, max: 2 },
            speedX: { min: 10, max: 30 },
            speedY: { min: -5, max: 5 },
            scale: { start: 0.4, end: 0.1 },
            alpha: { start: 0.5, end: 0 },
            lifespan: 4000,
            frequency: 250,
            blendMode: 'NORMAL'
        });
        backFoam.setDepth(5);
        this.foamLines.push(backFoam);

        // Add occasional larger foam clusters
        this.time.addEvent({
            delay: 2000,
            callback: this.createFoamCluster,
            callbackScope: this,
            loop: true
        });
    }

    createFoamCluster() {
        if (this.selectedLevel !== 'Beach') return;

        // Random position along the wave lines
        const x = Phaser.Math.Between(0, CONFIG.WIDTH);
        const y = Phaser.Math.Between(CONFIG.HEIGHT * 0.7, CONFIG.HEIGHT * 0.85);
        
        // Create cluster of foam particles
        for (let i = 0; i < 5; i++) {
            const foam = this.add.circle(
                x + Phaser.Math.Between(-30, 30),
                y + Phaser.Math.Between(-15, 15),
                Phaser.Math.Between(8, 16),
                0xffffff,
                0.8
            );
            foam.setDepth(14);
            
            this.tweens.add({
                targets: foam,
                x: foam.x + Phaser.Math.Between(40, 100),
                y: foam.y + Phaser.Math.Between(-10, 10),
                scale: 0.2,
                alpha: 0,
                duration: 2000 + Math.random() * 1000,
                ease: 'Sine.easeOut',
                onComplete: () => foam.destroy()
            });
        }
    }

    createLavaBubbles() {
        if (this.selectedLevel !== 'Lava') return;
        
        // Create bubble texture programmatically
        if (!this.textures.exists('lava-bubble')) {
            const size = 64;
            const canvas = this.textures.createCanvas('lava-bubble', size, size);
            const ctx = canvas.context;
            
            // Draw glowing bubble
            const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
            gradient.addColorStop(0, '#ffff00'); // Hot center
            gradient.addColorStop(0.3, '#ff4400'); // Orange body
            gradient.addColorStop(0.8, '#880000'); // Dark red edge
            gradient.addColorStop(1, 'rgba(0,0,0,0)'); // Transparent
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);
            
            // Add shine highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.arc(size*0.35, size*0.35, size*0.1, 0, Math.PI*2);
            ctx.fill();
            
            canvas.refresh();
        }

        // Spawn bubbles continuously
        this.time.addEvent({
            delay: 400, // Spawn frequency
            callback: this.spawnLavaBubble,
            callbackScope: this,
            loop: true
        });
    }

    spawnLavaBubble() {
        // Spawn scattered across lower screen (lava pool area)
        const x = Phaser.Math.Between(50, CONFIG.WIDTH - 50);
        const y = Phaser.Math.Between(CONFIG.HEIGHT * 0.6, CONFIG.HEIGHT - 50);
        
        // Scale based on Y (perspective) - Lower on screen (higher Y) = bigger
        const depthScale = (y / CONFIG.HEIGHT);
        
        const bubble = this.add.image(x, y, 'lava-bubble');
        bubble.setDepth(5); // Behind players but above background
        bubble.setBlendMode(Phaser.BlendModes.ADD);
        
        // Randomize visual
        const baseScale = 0.2 + Math.random() * 0.4;
        bubble.setScale(0);
        bubble.setAlpha(0.6 + Math.random() * 0.4);
        
        // Animate: Swell -> Pop
        const duration = 1000 + Math.random() * 1500;
        
        this.tweens.add({
            targets: bubble,
            scale: baseScale * depthScale, // Grow to full size
            duration: duration,
            ease: 'Sine.easeIn',
            onComplete: () => {
                // Pop animation
                this.tweens.add({
                    targets: bubble,
                    scale: bubble.scale * 1.5,
                    alpha: 0,
                    duration: 150,
                    ease: 'Quad.easeOut',
                    onComplete: () => bubble.destroy()
                });
            }
        });
        
        // Slight wobble movement
        this.tweens.add({
            targets: bubble,
            x: x + (Math.random() * 30 - 15),
            duration: duration,
            ease: 'Sine.easeInOut'
        });
    }

    createLavaEmbers() {
        if (this.selectedLevel !== 'Lava') return;
        
        // Generate texture for particles if needed
        if (!this.textures.exists('ember')) {
            const graphics = this.make.graphics({x: 0, y: 0, add: false});
            graphics.fillStyle(0xffffff, 1);
            graphics.fillCircle(4, 4, 4);
            graphics.generateTexture('ember', 8, 8);
        }
        
        // Create glowing embers emitter
        const embers = this.add.particles(0, 0, 'ember', {
            x: { min: 0, max: CONFIG.WIDTH },
            y: -10, // Spawn just above screen
            lifespan: { min: 4000, max: 7000 },
            speedY: { min: 50, max: 150 }, // Falling down
            speedX: { min: -20, max: 20 }, // Slight drift
            scale: { start: 0.6, end: 0 },
            alpha: { start: 1, end: 0 },
            quantity: 1,
            frequency: 100, // Spawn every 100ms
            blendMode: 'ADD',
            tint: [ 0xff4400, 0xff8800, 0xffff00 ] // Lava colors (Red, Orange, Yellow)
        });
        
        embers.setDepth(20); // Overlay players for atmosphere
        
        // Create dark ash particles emitter
        const ash = this.add.particles(0, 0, 'ember', {
            x: { min: 0, max: CONFIG.WIDTH },
            y: -10,
            lifespan: { min: 5000, max: 8000 },
            speedY: { min: 30, max: 80 }, // Slower falling
            speedX: { min: -40, max: 40 }, // More drift
            rotate: { min: 0, max: 360 },
            scale: { start: 0.4, end: 0.2 },
            alpha: { start: 0.5, end: 0 },
            quantity: 1,
            frequency: 300,
            tint: 0x333333, // Dark Grey
            blendMode: 'NORMAL'
        });
        
        ash.setDepth(20);
    }

    createIceGroundImpact(x, y) {
        // Create ice shatter particles
        const particleCount = 40;
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI - Math.PI / 2; // Upward spray
            const speed = 150 + Math.random() * 250;
            const size = 4 + Math.random() * 8;
            
            const particle = this.add.rectangle(x, y, size, size, 0xaaddff, 1);
            particle.setDepth(20);
            particle.setRotation(Math.random() * Math.PI);
            
            // Add glow
            const glow = this.add.circle(x, y, size * 1.5, 0xccffff, 0.6);
            glow.setBlendMode(Phaser.BlendModes.ADD);
            glow.setDepth(19);
            
            this.tweens.add({
                targets: particle,
                x: x + Math.cos(angle) * speed * 0.8,
                y: y + Math.sin(angle) * speed - 80,
                alpha: 0,
                rotation: particle.rotation + Math.PI * 2,
                duration: 800 + Math.random() * 400,
                ease: 'Power2',
                onComplete: () => particle.destroy()
            });
            
            this.tweens.add({
                targets: glow,
                x: x + Math.cos(angle) * speed * 0.8,
                y: y + Math.sin(angle) * speed - 80,
                alpha: 0,
                scale: 0.1,
                duration: 800 + Math.random() * 400,
                ease: 'Power2',
                onComplete: () => glow.destroy()
            });
        }

        // Ice crack waves
        for (let i = 0; i < 3; i++) {
            const wave = this.add.circle(x, y, 20, 0x88ddff, 0);
            wave.setStrokeStyle(4 - i, 0xaaffff);
            wave.setBlendMode(Phaser.BlendModes.ADD);
            wave.setDepth(18);
            
            this.tweens.add({
                targets: wave,
                radius: 120 + i * 30,
                alpha: { from: 0.9, to: 0 },
                duration: 600 + i * 100,
                delay: i * 80,
                ease: 'Quad.easeOut',
                onComplete: () => wave.destroy()
            });
        }

        // Frost burst
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12;
            const frost = this.add.rectangle(x, y, 3, 20, 0xccffff, 0.8);
            frost.setRotation(angle);
            frost.setDepth(19);
            
            this.tweens.add({
                targets: frost,
                scaleY: 2,
                alpha: 0,
                duration: 400,
                ease: 'Quad.easeOut',
                onComplete: () => frost.destroy()
            });
        }

        // Rising cold mist
        for (let i = 0; i < 8; i++) {
            const mist = this.add.circle(
                x + (Math.random() - 0.5) * 80,
                y,
                15 + Math.random() * 15,
                0xaaffff,
                0.4
            );
            mist.setBlendMode(Phaser.BlendModes.NORMAL);
            mist.setDepth(19);
            
            this.tweens.add({
                targets: mist,
                y: y - 180 - Math.random() * 100,
                x: mist.x + (Math.random() - 0.5) * 50,
                scaleX: { from: 1, to: 2 },
                scaleY: { from: 1, to: 0.3 },
                alpha: 0,
                duration: 1200 + Math.random() * 500,
                ease: 'Sine.easeOut',
                onComplete: () => mist.destroy()
            });
        }

        // Icy flash
        const flash = this.add.circle(x, y, 80, 0xccffff, 0.9);
        flash.setBlendMode(Phaser.BlendModes.ADD);
        flash.setDepth(21);
        
        this.tweens.add({
            targets: flash,
            scale: 2.5,
            alpha: 0,
            duration: 300,
            ease: 'Quad.easeOut',
            onComplete: () => flash.destroy()
        });
    }

    createSnowfall() {
        if (this.selectedLevel !== 'Hell') return;
        
        // Create snowflake texture if it doesn't exist
        if (!this.textures.exists('snowflake')) {
            const graphics = this.make.graphics({x: 0, y: 0, add: false});
            graphics.fillStyle(0xffffff, 1);
            graphics.fillCircle(4, 4, 4);
            graphics.generateTexture('snowflake', 8, 8);
        }
        
        // Heavy snowfall - multiple layers for depth
        const heavySnow = this.add.particles(0, 0, 'snowflake', {
            x: { min: -100, max: CONFIG.WIDTH + 100 },
            y: -20,
            lifespan: { min: 6000, max: 10000 },
            speedY: { min: 80, max: 150 },
            speedX: { min: -30, max: 30 },
            scale: { start: 1.2, end: 0.8 },
            alpha: { start: 0.9, end: 0.3 },
            quantity: 2,
            frequency: 50, // Dense snowfall
            blendMode: 'NORMAL',
            tint: [ 0xffffff, 0xeeffff, 0xddffff ]
        });
        heavySnow.setDepth(25);
        
        // Light background snow
        const lightSnow = this.add.particles(0, 0, 'snowflake', {
            x: { min: 0, max: CONFIG.WIDTH },
            y: -10,
            lifespan: { min: 8000, max: 12000 },
            speedY: { min: 40, max: 80 },
            speedX: { min: -20, max: 20 },
            scale: { start: 0.6, end: 0.3 },
            alpha: { start: 0.5, end: 0 },
            quantity: 1,
            frequency: 100,
            blendMode: 'NORMAL'
        });
        lightSnow.setDepth(5);
    }

    createIceCrystals() {
        if (this.selectedLevel !== 'Hell') return;
        
        // Floating ice crystals that shimmer
        this.time.addEvent({
            delay: 800,
            callback: () => {
                if (this.selectedLevel !== 'Hell') return;
                
                const x = Phaser.Math.Between(100, CONFIG.WIDTH - 100);
                const y = Phaser.Math.Between(150, 400);
                
                // Create crystal shape
                const crystal = this.add.star(x, y, 6, 8, 16, 0xaaffff, 0.8);
                crystal.setDepth(15);
                crystal.setBlendMode(Phaser.BlendModes.ADD);
                
                // Shimmer and float
                this.tweens.add({
                    targets: crystal,
                    alpha: { from: 0.8, to: 0.2 },
                    angle: 360,
                    scaleX: { from: 1, to: 1.5 },
                    scaleY: { from: 1, to: 1.5 },
                    x: x + Phaser.Math.Between(-100, 100),
                    y: y + Phaser.Math.Between(-50, 50),
                    duration: 4000,
                    ease: 'Sine.easeInOut',
                    onComplete: () => crystal.destroy()
                });
            },
            loop: true
        });
    }

    createFrostBreath() {
        if (this.selectedLevel !== 'Hell') return;
        
        // Create frost breath clouds from players occasionally
        this.time.addEvent({
            delay: 1500,
            callback: () => {
                if (this.selectedLevel !== 'Hell') return;
                
                // Player 1 frost breath
                const breath1 = this.add.circle(
                    this.player1.x + 30,
                    this.player1.y - 20,
                    15,
                    0xccffff,
                    0.6
                );
                breath1.setDepth(12);
                
                this.tweens.add({
                    targets: breath1,
                    x: breath1.x + 60,
                    y: breath1.y - 30,
                    scaleX: 2,
                    scaleY: 0.5,
                    alpha: 0,
                    duration: 1200,
                    ease: 'Sine.easeOut',
                    onComplete: () => breath1.destroy()
                });
                
                // Player 2 frost breath
                const breath2 = this.add.circle(
                    this.player2.x - 30,
                    this.player2.y - 20,
                    15,
                    0xccffff,
                    0.6
                );
                breath2.setDepth(12);
                
                this.tweens.add({
                    targets: breath2,
                    x: breath2.x - 60,
                    y: breath2.y - 30,
                    scaleX: 2,
                    scaleY: 0.5,
                    alpha: 0,
                    duration: 1200,
                    ease: 'Sine.easeOut',
                    onComplete: () => breath2.destroy()
                });
            },
            loop: true
        });
        
        // Add ice shards that occasionally fall
        this.time.addEvent({
            delay: 2000,
            callback: () => {
                if (this.selectedLevel !== 'Hell') return;
                
                const x = Phaser.Math.Between(100, CONFIG.WIDTH - 100);
                const shard = this.add.rectangle(x, -50, 6, 30, 0xaaddff, 0.8);
                shard.setDepth(20);
                shard.setRotation(Math.random() * Math.PI);
                
                this.tweens.add({
                    targets: shard,
                    y: CONFIG.HEIGHT + 50,
                    rotation: shard.rotation + Math.PI * 4,
                    duration: 3000 + Math.random() * 2000,
                    ease: 'Linear',
                    onComplete: () => shard.destroy()
                });
            },
            loop: true
        });
    }

    showExitConfirmation() {
        this.isPaused = true;
        
        // Create semi-transparent overlay
        const overlay = this.add.rectangle(
            CONFIG.WIDTH / 2,
            CONFIG.HEIGHT / 2,
            CONFIG.WIDTH,
            CONFIG.HEIGHT,
            0x000000,
            0.7
        );
        overlay.setDepth(200);
        
        // Create dialog container
        const dialogWidth = 800;
        const dialogHeight = 400;
        
        // Dialog background with glow
        const dialogGlow = this.add.rectangle(
            CONFIG.WIDTH / 2,
            CONFIG.HEIGHT / 2,
            dialogWidth + 20,
            dialogHeight + 20,
            0xffff00,
            0.3
        );
        dialogGlow.setDepth(201);
        
        const dialogBg = this.add.rectangle(
            CONFIG.WIDTH / 2,
            CONFIG.HEIGHT / 2,
            dialogWidth,
            dialogHeight,
            0x000000,
            0.95
        );
        dialogBg.setDepth(202);
        dialogBg.setStrokeStyle(4, 0xffff00);
        
        // Title text
        const titleText = this.add.text(
            CONFIG.WIDTH / 2,
            CONFIG.HEIGHT / 2 - 120,
            'EXIT TO MENU?',
            {
                fontFamily: '"Press Start 2P"',
                fontSize: '48px',
                fill: '#ffff00',
                stroke: '#000000',
                strokeThickness: 6
            }
        ).setOrigin(0.5);
        titleText.setDepth(203);
        
        // Confirmation text
        const confirmText = this.add.text(
            CONFIG.WIDTH / 2,
            CONFIG.HEIGHT / 2 - 20,
            'Are you sure you want to\nreturn to the main menu?',
            {
                fontFamily: '"Press Start 2P"',
                fontSize: '24px',
                fill: '#ffffff',
                align: 'center'
            }
        ).setOrigin(0.5);
        confirmText.setDepth(203);
        
        // Yes button
        const yesButton = this.add.text(
            CONFIG.WIDTH / 2 - 150,
            CONFIG.HEIGHT / 2 + 100,
            'YES (Y)',
            {
                fontFamily: '"Press Start 2P"',
                fontSize: '32px',
                fill: '#00ff00',
                stroke: '#000000',
                strokeThickness: 4
            }
        ).setOrigin(0.5);
        yesButton.setDepth(203);
        
        // No button
        const noButton = this.add.text(
            CONFIG.WIDTH / 2 + 150,
            CONFIG.HEIGHT / 2 + 100,
            'NO (N)',
            {
                fontFamily: '"Press Start 2P"',
                fontSize: '32px',
                fill: '#ff0000',
                stroke: '#000000',
                strokeThickness: 4
            }
        ).setOrigin(0.5);
        noButton.setDepth(203);
        
        // Store dialog elements
        this.confirmDialog = {
            overlay,
            dialogGlow,
            dialogBg,
            titleText,
            confirmText,
            yesButton,
            noButton
        };
        
        // Pulse animations
        this.tweens.add({
            targets: yesButton,
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        this.tweens.add({
            targets: noButton,
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // Handle input
        const yKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Y);
        const nKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.N);
        
        const handleYes = () => {
            this.cleanupConfirmDialog();
            this.sound.stopAll();
            // Let Phaser handle scene transition automatically
            this.scene.start('SceneMenu');
        };
        
        const handleNo = () => {
            this.cleanupConfirmDialog();
            this.isPaused = false;
        };
        
        // Key listeners
        yKey.once('down', handleYes);
        nKey.once('down', handleNo);
        this.escKey.once('down', handleNo); // ESC also cancels
        
        // Store handlers for cleanup
        this.confirmDialog.yKey = yKey;
        this.confirmDialog.nKey = nKey;
        this.confirmDialog.handleYes = handleYes;
        this.confirmDialog.handleNo = handleNo;
    }
    
    cleanupConfirmDialog() {
        if (this.confirmDialog) {
            // Stop all tweens
            this.tweens.killTweensOf([
                this.confirmDialog.yesButton,
                this.confirmDialog.noButton
            ]);
            
            // Destroy all dialog elements
            this.confirmDialog.overlay.destroy();
            this.confirmDialog.dialogGlow.destroy();
            this.confirmDialog.dialogBg.destroy();
            this.confirmDialog.titleText.destroy();
            this.confirmDialog.confirmText.destroy();
            this.confirmDialog.yesButton.destroy();
            this.confirmDialog.noButton.destroy();
            
            this.confirmDialog = null;
        }
    }

    gameOver() {
        const winner = this.score1 > this.score2 ? "PLAYER 1" : "PLAYER 2";
        const winnerColor = this.score1 > this.score2 ? '#00ffff' : '#ff00ff';
        
        // Calculate match duration
        const matchDuration = Math.floor((Date.now() - this.matchStats.startTime) / 1000);
        const minutes = Math.floor(matchDuration / 60);
        const seconds = matchDuration % 60;
        const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Semi-transparent dark overlay
        const overlay = this.add.rectangle(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT, 0x000000, 0.85);
        overlay.setOrigin(0);
        overlay.setDepth(200);
        
        // Victory banner with glow
        const bannerGlow = this.add.rectangle(CONFIG.WIDTH / 2, 180, 1400, 160, Phaser.Display.Color.HexStringToColor(winnerColor).color, 0.3);
        bannerGlow.setDepth(201);
        
        const bannerBg = this.add.rectangle(CONFIG.WIDTH / 2, 180, 1350, 140, 0x000000, 0.95);
        bannerBg.setDepth(202);
        
        const bannerBorder = this.add.rectangle(CONFIG.WIDTH / 2, 180, 1350, 140, Phaser.Display.Color.HexStringToColor(winnerColor).color, 0);
        bannerBorder.setStrokeStyle(8, Phaser.Display.Color.HexStringToColor(winnerColor).color);
        bannerBorder.setDepth(203);
        
        // Winner text
        const winnerText = this.add.text(CONFIG.WIDTH / 2, 150, `${winner} WINS!`, {
            fontFamily: '"Press Start 2P"',
            fontSize: '72px',
            fill: winnerColor,
            stroke: '#000000',
            strokeThickness: 12
        }).setOrigin(0.5).setDepth(204);
        
        // Victory emoji
        const emoji = this.add.text(CONFIG.WIDTH / 2, 210, '🏆', {
            fontSize: '48px'
        }).setOrigin(0.5).setDepth(204);
        
        // Stats panel
        const statsY = 320;
        const statsPanel = this.add.rectangle(CONFIG.WIDTH / 2, statsY + 200, 1200, 400, 0x000000, 0.9);
        statsPanel.setDepth(201);
        
        const statsBorder = this.add.rectangle(CONFIG.WIDTH / 2, statsY + 200, 1200, 400, 0xffffff, 0);
        statsBorder.setStrokeStyle(4, 0xffffff);
        statsBorder.setDepth(202);
        
        // Title
        this.add.text(CONFIG.WIDTH / 2, statsY, 'MATCH STATISTICS', {
            fontFamily: '"Press Start 2P"',
            fontSize: '36px',
            fill: '#ffff00',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(203);
        
        // Stats columns
        const col1X = CONFIG.WIDTH / 2 - 450;
        const col2X = CONFIG.WIDTH / 2 - 150;
        const col3X = CONFIG.WIDTH / 2 + 150;
        const col4X = CONFIG.WIDTH / 2 + 450;
        
        const rowY = statsY + 70;
        const rowSpacing = 55;
        
        // Headers
        this.add.text(col2X, rowY, 'PLAYER 1', {
            fontFamily: '"Press Start 2P"',
            fontSize: '24px',
            fill: '#00ffff'
        }).setOrigin(0.5).setDepth(203);
        
        this.add.text(col3X, rowY, 'PLAYER 2', {
            fontFamily: '"Press Start 2P"',
            fontSize: '24px',
            fill: '#ff00ff'
        }).setOrigin(0.5).setDepth(203);
        
        // Final Score
        this.add.text(col1X, rowY + rowSpacing, 'SCORE', {
            fontFamily: '"Press Start 2P"',
            fontSize: '20px',
            fill: '#ffffff'
        }).setOrigin(0, 0.5).setDepth(203);
        
        this.add.text(col2X, rowY + rowSpacing, `${this.score1}`, {
            fontFamily: '"Press Start 2P"',
            fontSize: '28px',
            fill: '#00ffff'
        }).setOrigin(0.5).setDepth(203);
        
        this.add.text(col3X, rowY + rowSpacing, `${this.score2}`, {
            fontFamily: '"Press Start 2P"',
            fontSize: '28px',
            fill: '#ff00ff'
        }).setOrigin(0.5).setDepth(203);
        
        // Total Hits
        this.add.text(col1X, rowY + rowSpacing * 2, 'TOTAL HITS', {
            fontFamily: '"Press Start 2P"',
            fontSize: '20px',
            fill: '#ffffff'
        }).setOrigin(0, 0.5).setDepth(203);
        
        this.add.text(col2X, rowY + rowSpacing * 2, `${this.matchStats.player1Hits}`, {
            fontFamily: '"Press Start 2P"',
            fontSize: '24px',
            fill: '#aaaaaa'
        }).setOrigin(0.5).setDepth(203);
        
        this.add.text(col3X, rowY + rowSpacing * 2, `${this.matchStats.player2Hits}`, {
            fontFamily: '"Press Start 2P"',
            fontSize: '24px',
            fill: '#aaaaaa'
        }).setOrigin(0.5).setDepth(203);
        
        // Power-ups Collected
        this.add.text(col1X, rowY + rowSpacing * 3, 'POWER-UPS', {
            fontFamily: '"Press Start 2P"',
            fontSize: '20px',
            fill: '#ffffff'
        }).setOrigin(0, 0.5).setDepth(203);
        
        this.add.text(col2X, rowY + rowSpacing * 3, `${this.matchStats.powerUpsCollected.player1}`, {
            fontFamily: '"Press Start 2P"',
            fontSize: '24px',
            fill: '#aaaaaa'
        }).setOrigin(0.5).setDepth(203);
        
        this.add.text(col3X, rowY + rowSpacing * 3, `${this.matchStats.powerUpsCollected.player2}`, {
            fontFamily: '"Press Start 2P"',
            fontSize: '24px',
            fill: '#aaaaaa'
        }).setOrigin(0.5).setDepth(203);
        
        // Match duration and rallies
        this.add.text(col1X, rowY + rowSpacing * 4 + 20, 'MATCH TIME', {
            fontFamily: '"Press Start 2P"',
            fontSize: '20px',
            fill: '#ffffff'
        }).setOrigin(0, 0.5).setDepth(203);
        
        this.add.text(col2X + 150, rowY + rowSpacing * 4 + 20, timeString, {
            fontFamily: '"Press Start 2P"',
            fontSize: '24px',
            fill: '#ffff00'
        }).setOrigin(0.5).setDepth(203);
        
        this.add.text(col1X, rowY + rowSpacing * 5 + 20, 'LONGEST RALLY', {
            fontFamily: '"Press Start 2P"',
            fontSize: '20px',
            fill: '#ffffff'
        }).setOrigin(0, 0.5).setDepth(203);
        
        this.add.text(col2X + 150, rowY + rowSpacing * 5 + 20, `${this.matchStats.longestRally} hits`, {
            fontFamily: '"Press Start 2P"',
            fontSize: '24px',
            fill: '#ffff00'
        }).setOrigin(0.5).setDepth(203);
        
        // Buttons
        const buttonY = CONFIG.HEIGHT - 150;
        
        // Replay button
        const replayBtn = this.add.text(CONFIG.WIDTH / 2 - 250, buttonY, '🔄 REPLAY', {
            fontFamily: '"Press Start 2P"',
            fontSize: '32px',
            fill: '#00ff00',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(203);
        
        replayBtn.setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.scene.restart();
            })
            .on('pointerover', () => {
                replayBtn.setScale(1.1);
                replayBtn.setFill('#00ff88');
            })
            .on('pointerout', () => {
                replayBtn.setScale(1);
                replayBtn.setFill('#00ff00');
            });
        
        // Menu button
        const menuBtn = this.add.text(CONFIG.WIDTH / 2 + 250, buttonY, '🏠 MENU', {
            fontFamily: '"Press Start 2P"',
            fontSize: '32px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(203);
        
        menuBtn.setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.scene.start('SceneMenu');
            })
            .on('pointerover', () => {
                menuBtn.setScale(1.1);
                menuBtn.setFill('#ffff00');
            })
            .on('pointerout', () => {
                menuBtn.setScale(1);
                menuBtn.setFill('#ffffff');
            });
        
        // Keyboard shortcuts
        this.add.text(CONFIG.WIDTH / 2, CONFIG.HEIGHT - 60, 'R: REPLAY  |  ESC: MENU', {
            fontFamily: '"Press Start 2P"',
            fontSize: '20px',
            fill: '#888888'
        }).setOrigin(0.5).setDepth(203);
        
        // Listen for keyboard shortcuts
        this.input.keyboard.once('keydown-R', () => {
            this.scene.restart();
        });
        
        this.input.keyboard.once('keydown-ESC', () => {
            this.scene.start('SceneMenu');
        });
        
        // Animations
        this.tweens.add({
            targets: [winnerText, emoji],
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        this.tweens.add({
            targets: [replayBtn, menuBtn],
            alpha: 0.7,
            duration: 600,
            yoyo: true,
            repeat: -1
        });
        
        this.scene.pause();
    }
    shutdown() {
        // Clean up all timers
        if (this.currentPowerUpTimer) {
            this.currentPowerUpTimer.remove();
            this.currentPowerUpTimer = null;
        }
        
        // Clean up power-up colliders
        if (this.powerUpColliders) {
            this.powerUpColliders.forEach(c => {
                if (this.physics && this.physics.world) {
                    this.physics.world.removeCollider(c);
                }
            });
            this.powerUpColliders = [];
        }
        
        // Clean up active power-up
        if (this.activePowerUp) {
            this.activePowerUp.destroy();
            this.activePowerUp = null;
        }
        
        // Clean up power-up effects
        if (this.powerUpEffects) {
            ['player1', 'player2'].forEach(key => {
                if (this.powerUpEffects[key].tween) {
                    this.powerUpEffects[key].tween.stop();
                }
            });
        }
        
        // Clean up particle systems
        if (this.explosionParticles) {
            this.explosionParticles.destroy();
            this.explosionParticles = null;
        }
        
        if (this.foamLines) {
            this.foamLines.forEach(foam => foam.destroy());
            this.foamLines = [];
        }
        
        // Remove pipeline effects
        if (this.cameras.main) {
            this.cameras.main.resetPostPipeline();
        }
        
        // Clean up audio context
        if (this.audioContext) {
            // Audio context will be recreated on next scene
            this.audioContext = null;
        }
        
        // Stop all sounds
        this.sound.stopAll();
        
        // Clean up confirm dialog if it exists
        this.cleanupConfirmDialog();
        
        // Reset pause state
        this.isPaused = false;
        
        // Clean up all tweens
        this.tweens.killAll();
        
        // Clean up time events
        this.time.removeAllEvents();
    }

    createMobileControls() {
        // Ensure multi-touch is enabled
        this.input.addPointer(2);

        // Styling
        const buttonSize = 140; // Larger buttons for easier touch
        const buttonAlpha = 0.5;
        const buttonColor = 0xffffff;
        const activeColor = 0x00ffff;
        const margin = 80;
        const bottomY = CONFIG.HEIGHT - margin - buttonSize / 2;

        // --- RIGHT SIDE: ACTION BUTTONS (Jump & Dive) ---
        
        // Helper to create a touch button
        const createButton = (x, y, icon, key, color = buttonColor) => {
            const container = this.add.container(x, y);
            const glow = this.add.circle(0, 0, buttonSize / 2 + 10, color, 0.1);
            const bg = this.add.circle(0, 0, buttonSize / 2, 0x000000, 0.5);
            bg.setStrokeStyle(4, color, 0.8);
            const fill = this.add.circle(0, 0, buttonSize / 2 - 8, color, 0);
            
            const text = this.add.text(0, 0, icon, {
                fontFamily: '"Press Start 2P"',
                fontSize: '48px',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5);
            
            container.add([glow, bg, fill, text]);
            container.setDepth(1000).setScrollFactor(0);
            
            const hitArea = this.add.circle(0, 0, buttonSize * 0.8, 0xff0000, 0);
            container.add(hitArea);
            
            hitArea.setInteractive()
                .on('pointerdown', () => {
                    this.touchControls[key] = true;
                    bg.setStrokeStyle(4, activeColor, 1);
                    text.setColor('#00ffff');
                    fill.setFillStyle(activeColor, 0.3);
                    container.setScale(0.95);
                    if (window.navigator?.vibrate) window.navigator.vibrate(10);
                })
                .on('pointerup', () => {
                    this.touchControls[key] = false;
                    bg.setStrokeStyle(4, color, 0.8);
                    text.setColor('#ffffff');
                    fill.setFillStyle(color, 0);
                    container.setScale(1);
                })
                .on('pointerout', () => {
                    this.touchControls[key] = false;
                    bg.setStrokeStyle(4, color, 0.8);
                    text.setColor('#ffffff');
                    fill.setFillStyle(color, 0);
                    container.setScale(1);
                });
                
            return container;
        };

        const rightX = CONFIG.WIDTH - margin - buttonSize / 2;
        createButton(rightX, bottomY - 80, 'J', 'up', 0x00ff00); // Jump
        createButton(rightX - buttonSize - 15, bottomY + 40, 'D', 'down', 0xff00ff); // Dive


        // --- LEFT SIDE: VIRTUAL JOYSTICK ---
        
        const joyX = margin + 90;
        const joyY = CONFIG.HEIGHT - margin - 90;
        const joyRadius = 120;
        const knobRadius = 50;
        
        // Base
        const base = this.add.circle(joyX, joyY, joyRadius, 0x000000, 0.3);
        base.setStrokeStyle(4, 0xffffff, 0.5);
        base.setDepth(1000).setScrollFactor(0);
        
        // Stick (connection line)
        const stick = this.add.graphics();
        stick.setDepth(1000).setScrollFactor(0);
        
        // Knob Shadow
        const knobShadow = this.add.circle(joyX, joyY + 5, knobRadius, 0x000000, 0.5);
        knobShadow.setDepth(1000).setScrollFactor(0);

        // Knob
        const knob = this.add.circle(joyX, joyY, knobRadius, 0xffffff, 0.9);
        knob.setDepth(1001).setScrollFactor(0);
        
        // Interaction logic
        let isDragging = false;
        let pointerId = null;
        
        // Invisible hit area for joystick (larger than visual base)
        const joyHitArea = this.add.circle(joyX, joyY, joyRadius * 1.5, 0x000000, 0);
        joyHitArea.setDepth(999).setScrollFactor(0).setInteractive();
        
        const drawStick = () => {
            stick.clear();
            stick.lineStyle(24, 0xffffff, 0.3);
            stick.lineBetween(joyX, joyY, knob.x, knob.y);
        };

        const updateJoystick = (pointer) => {
            if (!isDragging) return;
            
            // Calculate vector
            let dx = pointer.x - joyX;
            let dy = pointer.y - joyY;
            
            // Limit to radius
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > joyRadius) {
                const ratio = joyRadius / dist;
                dx *= ratio;
                dy *= ratio;
            }
            
            // Update knob position
            knob.x = joyX + dx;
            knob.y = joyY + dy;
            
            // Update shadow
            knobShadow.x = knob.x;
            knobShadow.y = knob.y + 5;
            
            // Update stick graphic
            drawStick();
            
            // Map to controls
            // Thresholds for activation
            const threshold = 20;
            
            this.touchControls.left = dx < -threshold;
            this.touchControls.right = dx > threshold;
            
            // Optional: Map Up/Down to Joystick too
            // This allows jumping/diving with just the stick
            this.touchControls.up = dy < -threshold * 2; // Harder pull for jump to avoid accidental jumps
            this.touchControls.down = dy > threshold * 2;
        };
        
        const resetJoystick = () => {
            isDragging = false;
            pointerId = null;
            
            // Animate back to center
            this.tweens.add({
                targets: [knob, knobShadow],
                x: joyX,
                y: { value: joyY, offset: (target, key, value) => target === knobShadow ? joyY + 5 : joyY },
                duration: 200,
                ease: 'Back.easeOut',
                onUpdate: () => drawStick()
            });

            this.touchControls.left = false;
            this.touchControls.right = false;
            this.touchControls.up = false;
            this.touchControls.down = false;
        };
        
        joyHitArea.on('pointerdown', (pointer) => {
            if (isDragging) return;
            isDragging = true;
            pointerId = pointer.id;
            updateJoystick(pointer);
        });
        
        this.input.on('pointermove', (pointer) => {
            if (isDragging && pointer.id === pointerId) {
                updateJoystick(pointer);
            }
        });
        
        this.input.on('pointerup', (pointer) => {
            if (isDragging && pointer.id === pointerId) {
                resetJoystick();
            }
        });
        
        this.add.text(CONFIG.WIDTH / 2, 20, 'TOUCH CONTROLS', {
            fontFamily: '"Press Start 2P"',
            fontSize: '16px',
            fill: '#ffffff',
            alpha: 0.3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
    }
}
