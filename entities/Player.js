import Phaser from 'phaser';
import { CONFIG } from '../config.js';

export default class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, texture, controls) {
        super(scene, x, y, texture);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setCollideWorldBounds(true);
        this.setGravityY(CONFIG.GRAVITY);
        this.setDragX(4000); // Snappier stopping
        this.setBounce(0);
        
        // Use a rectangular body for the base to prevent sinking
        // Blob characters are wider
        this.body.setSize(this.width * 0.6, this.height * 0.8);
        this.body.setOffset(this.width * 0.2, this.height * 0.1);
        
        this.controls = controls;
        this.isDiving = false;
        this.diveTimer = 0;

        // Custom properties
        this.playerSpeed = CONFIG.PLAYER_SPEED;
        this.jumpForce = CONFIG.PLAYER_JUMP;
        
        // Power meter
        this.powerMeter = 0;
        this.maxPower = 100;
        this.powerChargeRate = 0.5;
        this.powerDecayRate = 0.2;

        // Double jump
        this.canDoubleJump = false;
        this.hasDoubleJumped = false;
        this.jumpKeyWasPressed = false;

        // Shadow - Using soft gradient texture for better look
        // Lifted Y position (-25) to fix floating appearance
        this.shadow = scene.add.image(x, CONFIG.GROUND_Y - 25, 'soft-shadow');
        this.shadow.setOrigin(0.5);
        this.shadow.setDepth(10); // Ensure shadow is above background
        this.setDepth(11); // Player above shadow

        // Cleanup shadow when player is destroyed
        this.on('destroy', () => {
            if (this.shadow) this.shadow.destroy();
        });
    }

    update() {
        // Update shadow position to follow player horizontally
        this.shadow.x = this.x;
        this.shadow.y = CONFIG.GROUND_Y - 25; // Keep fixed relative to ground
        
        // Calculate distance from ground
        const groundY = CONFIG.GROUND_Y;
        
        // Ensure we have a valid body before accessing properties
        if (!this.body) return;
        
        const bodyBottom = this.body.bottom;
        // Calculate distance from feet to ground
        const dist = Math.max(0, groundY - bodyBottom);

        // Scale and fade based on distance
        // As player goes higher, shadow gets smaller and fainter
        const heightFactor = Math.max(0, 1 - (dist / 600)); // Fade out over 600px height
        
        // Adjust shadow scale based on player scale and height factor
        // We use Math.abs because scaleX is negative when facing left
        const playerScale = Math.abs(this.scaleX);
        
        // Calculate dynamic shadow size
        // Use player width as base reference
        // Scale with heightFactor (0.8 minimum scale so it doesn't vanish completely)
        const shadowScale = playerScale * (0.9 + 0.1 * heightFactor);
        
        // Target dimensions: 
        // Width: ~80% of player width
        // Height: ~25% of player width (oval shape)
        const targetWidth = this.width * 0.8 * shadowScale;
        const targetHeight = this.width * 0.25 * shadowScale;
        
        this.shadow.setDisplaySize(targetWidth, targetHeight);
        
        // Alpha scaling
        // Adjust intensity based on level
        let baseAlpha = 0.65; // Standard (was roughly 0.64 before)
        if (this.scene.selectedLevel === 'Lava') {
            baseAlpha = 0.95; // Much stronger for Lava
        }
        
        this.shadow.setAlpha(baseAlpha * heightFactor);

        if (this.isDiving) {
            if (this.body.blocked.down || this.body.touching.down) {
                this.isDiving = false;
            }
            return; 
        }

        // Check for slow power-up effect
        let speedMultiplier = 1.0;
        if (this.scene && this.scene.powerUpEffects) {
            const playerKey = this.texture.key === 'player1' ? 'player1' : 'player2';
            if (this.scene.powerUpEffects[playerKey].type === 'slow') {
                speedMultiplier = 0.5; // 50% speed
            }
        }

        // Horizontal movement
        const effectiveSpeed = this.playerSpeed * speedMultiplier;
        if (this.controls.left.isDown) {
            this.setVelocityX(-effectiveSpeed);
            this.setFlipX(true); // Flip character to face left
        } else if (this.controls.right.isDown) {
            this.setVelocityX(effectiveSpeed);
            this.setFlipX(false); // Flip character to face right
        } else {
            this.setVelocityX(0);
        }

        // Reset double jump when grounded
        if (this.body.blocked.down) {
            this.canDoubleJump = false;
            this.hasDoubleJumped = false;
        }

        // Jumping with double jump
        const jumpPressed = this.controls.up.isDown;
        
        if (jumpPressed && !this.jumpKeyWasPressed) {
            // First jump from ground
            if (this.body.blocked.down) {
                this.setVelocityY(this.jumpForce);
                this.canDoubleJump = true;
            }
            // Double jump in air
            else if (this.canDoubleJump && !this.hasDoubleJumped) {
                this.setVelocityY(this.jumpForce * 1.15); // 15% higher double jump
                this.hasDoubleJumped = true;
                this.canDoubleJump = false;
            }
        }
        
        this.jumpKeyWasPressed = jumpPressed;

        // Diving
        if (this.controls.down.isDown && !this.body.blocked.down && !this.isDiving) {
            this.isDiving = true;
            const dir = this.controls.right.isDown ? 1 : (this.controls.left.isDown ? -1 : (this.flipX ? -1 : 1));
            this.setVelocityX(dir * CONFIG.PLAYER_DIVE_SPEED);
            this.setVelocityY(CONFIG.PLAYER_DIVE_SPEED / 2);
        }

        // Power meter charging (when grounded and not moving)
        if (this.body.blocked.down && this.body.velocity.x === 0) {
            this.powerMeter = Math.min(this.maxPower, this.powerMeter + this.powerChargeRate);
        } else if (this.powerMeter > 0) {
            // Slow decay when moving
            this.powerMeter = Math.max(0, this.powerMeter - this.powerDecayRate);
        }
    }

    usePower() {
        if (this.powerMeter >= 50) {
            const power = this.powerMeter;
            this.powerMeter = 0;
            return power;
        }
        return 0;
    }

    getPowerPercentage() {
        return this.powerMeter / this.maxPower;
    }
}
