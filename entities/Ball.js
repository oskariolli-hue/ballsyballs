import Phaser from 'phaser';
import { CONFIG } from '../config.js';

export default class Ball extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, texture) {
        super(scene, x, y, texture);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setCircle(this.width / 2);
        this.setBounce(CONFIG.BALL_BOUNCE);
        this.setCollideWorldBounds(true);
        this.setGravityY(CONFIG.GRAVITY / 2);
        this.body.onWorldBounds = true;
        
        this.levelSpeedMultiplier = 1.0; // Will be set by scene
        
        // Trail system
        this.trail = [];
        this.maxTrailLength = 15;
        this.trailParticles = [];
        
        // Create particle pool for trail
        for (let i = 0; i < this.maxTrailLength; i++) {
            const particle = scene.add.circle(x, y, 20, 0xffffff, 0);
            particle.setBlendMode(Phaser.BlendModes.ADD);
            particle.setDepth(this.depth - 1);
            this.trailParticles.push(particle);
        }
        
        // Shadow - using soft gradient texture (created in SceneMain)
        // Similar to player shadow but smaller and rounder
        this.shadow = scene.add.image(x, CONFIG.GROUND_Y - 15, 'soft-shadow');
        this.shadow.setOrigin(0.5);
        this.shadow.setDepth(10); // Ensure shadow is above background
        this.setDepth(11); // Ball above shadow

        // Cleanup shadow when ball is destroyed
        this.on('destroy', () => {
            if (this.shadow) this.shadow.destroy();
        });
        
        // Initial serve state
        this.reset(x, y);
    }

    reset(x, y) {
        this.setPosition(x, y);
        this.setVelocity(0, 0);
        this.setAngularVelocity(0);
        this.body.setAllowGravity(false);
        
        // Clear trail
        this.trail = [];
        this.trailParticles.forEach(p => p.setAlpha(0));
    }

    serve(direction) {
        this.body.setAllowGravity(true);
        // Serve by "pukkaamalla" (high and forward)
        this.setVelocity(direction * 600, -1100);
        this.setAngularVelocity(direction * 360);
    }

    update() {
        // Update shadow position to follow ball horizontally
        if (this.shadow) {
            this.shadow.x = this.x;
            this.shadow.y = CONFIG.GROUND_Y - 15; // Fixed on ground
            
            // Calculate distance from ground for shadow scaling
            const groundY = CONFIG.GROUND_Y;
            
            // Get ball's physical bottom (or approximate it)
            // Ball origin is 0.5, 0.5. Radius is width/2.
            const ballRadius = (this.width * this.scaleX) / 2;
            const ballBottom = this.y + ballRadius;
            
            const dist = Math.max(0, groundY - ballBottom);
            
            // Scale shadow based on height
            // Fade out quicker than player shadow (300px)
            const heightFactor = Math.max(0, 1 - (dist / 600)); 
            
            // Ball shadow is round (width ~= height)
            const shadowSize = this.width * 0.8 * this.scaleX * (0.6 + 0.4 * heightFactor);
            
            this.shadow.setDisplaySize(shadowSize, shadowSize * 0.3); // Flattened oval
            
            // Alpha scaling
            let baseAlpha = 0.5;
            if (this.scene.selectedLevel === 'Lava') {
                baseAlpha = 0.85; // Stronger for Lava
            }
            this.shadow.setAlpha(baseAlpha * heightFactor);
        }

        // Limit max velocity
        const maxVelocity = 1500;
        const v = this.body.velocity;
        if (v.length() > maxVelocity) {
            v.normalize().scale(maxVelocity);
        }
        
        // Rotation based on movement
        this.rotation += this.body.velocity.x * 0.0005;
        
        // Update trail system
        const speed = v.length();
        const minSpeedForTrail = 200;
        
        if (speed > minSpeedForTrail) {
            // Add current position to trail
            this.trail.push({
                x: this.x,
                y: this.y,
                speed: speed
            });
            
            // Limit trail length
            if (this.trail.length > this.maxTrailLength) {
                this.trail.shift();
            }
        } else {
            // Fade out trail when ball is slow
            if (this.trail.length > 0) {
                this.trail.shift();
            }
        }
        
        // Update trail particles
        for (let i = 0; i < this.trailParticles.length; i++) {
            const particle = this.trailParticles[i];
            
            if (i < this.trail.length) {
                const trailPoint = this.trail[i];
                const age = i / this.trail.length;
                
                // Position
                particle.setPosition(trailPoint.x, trailPoint.y);
                
                // Calculate size based on speed and position in trail
                const speedFactor = Math.min(trailPoint.speed / 1000, 1.5);
                const sizeFactor = (1 - age) * speedFactor;
                const baseSize = this.width * 0.4;
                particle.radius = baseSize * sizeFactor;
                
                // Calculate alpha (fade out along trail)
                const alpha = (1 - age) * 0.6 * speedFactor;
                particle.setAlpha(alpha);
                
                // Color based on speed - white for fast, yellow for medium, orange for slow
                if (trailPoint.speed > 1000) {
                    particle.fillColor = 0xffffff; // White for very fast (spikes)
                } else if (trailPoint.speed > 700) {
                    particle.fillColor = 0xffff88; // Light yellow
                } else {
                    particle.fillColor = 0xffaa44; // Orange
                }
            } else {
                particle.setAlpha(0);
            }
        }
    }
}
