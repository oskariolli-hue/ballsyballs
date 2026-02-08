import Phaser from 'phaser';
import { CONFIG } from '../config.js';

export default class PowerUp extends Phaser.GameObjects.Container {
    constructor(scene, x, y, type) {
        super(scene, x, y);
        
        this.scene = scene;
        this.type = type; // 'shrink', 'slow', or 'multiball'
        this.isActive = true;
        
        // Create visual representation
        this.createVisual();
        
        // Add to scene
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Make it static (doesn't fall)
        this.body.setAllowGravity(false);
        this.body.setImmovable(true);
        
        // Collision circle
        this.body.setCircle(30);
        
        // Float animation
        this.floatOffset = Math.random() * Math.PI * 2;
        this.startY = y;
        
        // Particles
        this.createParticles();
        
        // Spawn animation
        this.playSpawnAnimation();
    }
    
    createVisual() {
        // Determine color based on type
        let glowColor, mainColor;
        if (this.type === 'shrink') {
            glowColor = mainColor = 0xff00ff; // Magenta
        } else if (this.type === 'slow') {
            glowColor = mainColor = 0x00ffff; // Cyan
        } else if (this.type === 'multiball') {
            glowColor = mainColor = 0xff00ff; // Magenta (like shrink)
        }
        
        // Background glow
        const glow = this.scene.add.circle(0, 0, 40, glowColor, 0.3);
        this.add(glow);
        
        // Main circle
        const main = this.scene.add.circle(0, 0, 30, mainColor, 1);
        this.add(main);
        
        // Inner circle
        const inner = this.scene.add.circle(0, 0, 20, 0xffffff, 0.5);
        this.add(inner);
        
        // Icon/Symbol - Use actual image assets
        let iconKey;
        if (this.type === 'shrink') iconKey = 'icon-shrink';
        else if (this.type === 'slow') iconKey = 'icon-slow';
        else if (this.type === 'multiball') iconKey = 'icon-multiball';
        
        const icon = this.scene.add.image(0, 0, iconKey);
        icon.setOrigin(0.5);
        icon.setScale(0.08); // Scale down to fit in the circle
        this.add(icon);
        
        // Store references
        this.glow = glow;
        this.mainCircle = main;
        this.icon = icon;
    }
    
    createParticles() {
        // Create particle emitter for sparkle effect
        let color;
        if (this.type === 'shrink') color = 0xff00ff;
        else if (this.type === 'slow') color = 0x00ffff;
        else if (this.type === 'multiball') color = 0xff00ff;
        
        // Create simple circle graphics for particle texture
        const graphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0xffffff);
        graphics.fillCircle(4, 4, 4);
        graphics.generateTexture('particle', 8, 8);
        graphics.destroy();
        
        this.particles = this.scene.add.particles(0, 0, 'particle', {
            speed: { min: 20, max: 40 },
            scale: { start: 0.3, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 1000,
            frequency: 100,
            blendMode: 'ADD',
            tint: color
        });
        
        this.particles.startFollow(this);
    }
    
    update() {
        if (!this.isActive) return;
        
        // Floating animation
        this.floatOffset += 0.05;
        this.y = this.startY + Math.sin(this.floatOffset) * 15;
        
        // Rotation
        this.rotation += 0.02;
        
        // Pulse effect
        const scale = 1 + Math.sin(this.floatOffset * 2) * 0.1;
        this.glow.setScale(scale);
    }
    
    playSpawnAnimation() {
        // Start invisible and small
        this.setAlpha(0);
        this.setScale(0);
        
        // Create spawn particle burst
        let color;
        if (this.type === 'shrink') color = 0xff00ff;
        else if (this.type === 'slow') color = 0x00ffff;
        else if (this.type === 'multiball') color = 0xff00ff;
        
        // Radial particle burst
        for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 * i) / 20;
            const speed = 150 + Math.random() * 100;
            const particle = this.scene.add.circle(this.x, this.y, 6, color, 1);
            particle.setBlendMode(Phaser.BlendModes.ADD);
            
            this.scene.tweens.add({
                targets: particle,
                x: this.x + Math.cos(angle) * speed,
                y: this.y + Math.sin(angle) * speed - 100,
                alpha: 0,
                scale: 0.3,
                duration: 800 + Math.random() * 400,
                ease: 'Power2',
                onComplete: () => particle.destroy()
            });
        }
        
        // Flash effect at spawn location
        const flash = this.scene.add.circle(this.x, this.y, 100, color, 0.8);
        flash.setBlendMode(Phaser.BlendModes.ADD);
        this.scene.tweens.add({
            targets: flash,
            scale: 2,
            alpha: 0,
            duration: 500,
            ease: 'Power2',
            onComplete: () => flash.destroy()
        });
        
        // Capture scene reference for callbacks
        const scene = this.scene;
        
        // Pop in animation with elastic bounce
        scene.tweens.add({
            targets: this,
            alpha: 1,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 400,
            ease: 'Back.easeOut',
            onComplete: () => {
                // Settle to normal size
                scene.tweens.add({
                    targets: this,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 200,
                    ease: 'Sine.easeInOut'
                });
            }
        });
        
        // Add ring expansion effect
        const ring = this.scene.add.circle(this.x, this.y, 30, color, 0);
        ring.setStrokeStyle(4, color, 1);
        this.scene.tweens.add({
            targets: ring,
            scale: 3,
            alpha: 0,
            duration: 600,
            ease: 'Power2',
            onComplete: () => ring.destroy()
        });
    }
    
    playExpireAnimation(callback) {
        if (!this.isActive) return;
        
        this.isActive = false;
        
        let color;
        if (this.type === 'shrink') color = 0xff00ff;
        else if (this.type === 'slow') color = 0x00ffff;
        else if (this.type === 'multiball') color = 0xff00ff;
        
        // Shrink and fade out
        this.scene.tweens.add({
            targets: this,
            scaleX: 0,
            scaleY: 0,
            alpha: 0,
            duration: 400,
            ease: 'Back.easeIn'
        });
        
        // Implosion particle effect
        for (let i = 0; i < 16; i++) {
            const angle = (Math.PI * 2 * i) / 16;
            const startDist = 80;
            const particle = this.scene.add.circle(
                this.x + Math.cos(angle) * startDist,
                this.y + Math.sin(angle) * startDist,
                4,
                color,
                1
            );
            particle.setBlendMode(Phaser.BlendModes.ADD);
            
            this.scene.tweens.add({
                targets: particle,
                x: this.x,
                y: this.y,
                alpha: 0,
                scale: 0,
                duration: 400,
                ease: 'Power2',
                onComplete: () => particle.destroy()
            });
        }
        
        // Collapsing rings
        for (let i = 0; i < 3; i++) {
            const ring = this.scene.add.circle(this.x, this.y, 60 + i * 20, color, 0);
            ring.setStrokeStyle(3, color, 0.8 - i * 0.2);
            ring.setScale(1 + i * 0.3);
            
            this.scene.tweens.add({
                targets: ring,
                scale: 0,
                alpha: 0,
                duration: 400,
                delay: i * 100,
                ease: 'Power2',
                onComplete: () => ring.destroy()
            });
        }
        
        // Stop particles
        if (this.particles) {
            this.particles.stop();
        }
        
        // Cleanup after animation
        this.scene.time.delayedCall(500, () => {
            if (callback) callback();
            this.destroy();
        });
    }
    
    collect(player) {
        if (!this.isActive) return false;
        
        this.isActive = false;
        
        // Collection animation
        this.scene.tweens.add({
            targets: this,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
                this.destroy();
            }
        });
        
        // Stop particles
        if (this.particles) {
            this.particles.stop();
            this.scene.time.delayedCall(2000, () => {
                if (this.particles) this.particles.destroy();
            });
        }
        
        // Flash effect
        this.scene.cameras.main.flash(200, 
            this.type === 'shrink' ? 255 : 0, 
            this.type === 'shrink' ? 0 : 255, 
            255
        );
        
        return true;
    }
    
    destroy() {
        if (this.particles) {
            this.particles.destroy();
        }
        super.destroy();
    }
}
