import Phaser from 'phaser';

const fragShader = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform float uTime;

varying vec2 outTexCoord;

void main(void) {
    vec2 uv = outTexCoord;
    
    // Time scaled for wave speed
    float t = uTime * 0.002;
    
    // Calculate heat wave distortion
    // Combine two sine waves for more irregular look
    float distortion = sin(uv.y * 20.0 - t * 2.0) * 0.002 
                     + sin(uv.y * 50.0 - t * 4.0) * 0.001;
    
    // Apply distortion mostly to X axis, slightly to Y
    // Heat rises, so waves move up (or rather phase moves up)
    
    vec2 distortedUV = uv;
    distortedUV.x += distortion;
    
    // Optional: stronger distortion at the bottom?
    // float strength = 1.0 - uv.y; // 1.0 at top, 0.0 at bottom (Phaser UVs: 0,0 top-left)
    // Actually Phaser UVs: (0,0) is top-left.
    // Heat source is usually bottom, but haze rises.
    // Uniform distortion is fine for a stage effect.
    
    gl_FragColor = texture2D(uMainSampler, distortedUV);
}
`;

export default class HeatHaze extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
    constructor(game) {
        super({
            game: game,
            renderTarget: true,
            fragShader: fragShader
        });
    }

    onPreRender() {
        this.set1f('uTime', this.game.loop.time);
    }
}