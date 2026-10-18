// =========================================================
// Neon Core — particles, bloom glow, camera shake, per-frame visuals
// =========================================================

// ---------- Particle pool (one draw call for every spark, shard and trail dot) ----------

const PARTICLE_MAX = 900;
const particles = {
    pos: new Float32Array(PARTICLE_MAX * 3),
    vel: new Float32Array(PARTICLE_MAX * 3),
    color: new Float32Array(PARTICLE_MAX * 3),
    size: new Float32Array(PARTICLE_MAX),
    baseSize: new Float32Array(PARTICLE_MAX),
    alpha: new Float32Array(PARTICLE_MAX),
    shape: new Float32Array(PARTICLE_MAX),      // 0 = soft dot, 1 = square shard
    life: new Float32Array(PARTICLE_MAX),
    maxLife: new Float32Array(PARTICLE_MAX),
    gravity: new Float32Array(PARTICLE_MAX),
    drag: new Float32Array(PARTICLE_MAX),
    cursor: 0
};

const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute('position', new THREE.BufferAttribute(particles.pos, 3));
particleGeo.setAttribute('aColor', new THREE.BufferAttribute(particles.color, 3));
particleGeo.setAttribute('aSize', new THREE.BufferAttribute(particles.size, 1));
particleGeo.setAttribute('aAlpha', new THREE.BufferAttribute(particles.alpha, 1));
particleGeo.setAttribute('aShape', new THREE.BufferAttribute(particles.shape, 1));

const particleMat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 1 } },
    vertexShader: `
        attribute vec3 aColor; attribute float aSize; attribute float aAlpha; attribute float aShape;
        uniform float uScale;
        varying vec3 vColor; varying float vAlpha; varying float vShape;
        void main() {
            vColor = aColor; vAlpha = aAlpha; vShape = aShape;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aAlpha > 0.0 ? aSize * uScale / max(-mv.z, 0.1) : 0.0;
            gl_Position = projectionMatrix * mv;
        }`,
    fragmentShader: `
        varying vec3 vColor; varying float vAlpha; varying float vShape;
        void main() {
            if (vAlpha <= 0.0) discard;
            vec2 c = gl_PointCoord - 0.5;
            float a = vShape > 0.5 ? step(max(abs(c.x), abs(c.y)), 0.42) : pow(smoothstep(0.5, 0.0, length(c)), 1.6);
            gl_FragColor = vec4(vColor, a * vAlpha);
        }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
});

const particlePoints = new THREE.Points(particleGeo, particleMat);
particlePoints.frustumCulled = false;
scene.add(particlePoints);

function updateParticleScale() {
    // world size -> pixels at distance 1
    particleMat.uniforms.uScale.value = (window.innerHeight * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
}
updateParticleScale();

const tmpColor = new THREE.Color();

function emitParticle(x, y, z, vx, vy, vz, color, size, life, opts) {
    const i = particles.cursor;
    particles.cursor = (i + 1) % PARTICLE_MAX;
    const i3 = i * 3;
    tmpColor.set(color);
    particles.pos[i3] = x; particles.pos[i3 + 1] = y; particles.pos[i3 + 2] = z;
    particles.vel[i3] = vx; particles.vel[i3 + 1] = vy; particles.vel[i3 + 2] = vz;
    particles.color[i3] = tmpColor.r; particles.color[i3 + 1] = tmpColor.g; particles.color[i3 + 2] = tmpColor.b;
    particles.baseSize[i] = size; particles.size[i] = size;
    particles.life[i] = life; particles.maxLife[i] = life; particles.alpha[i] = 1;
    particles.shape[i] = (opts && opts.shape) || 0;
    particles.gravity[i] = (opts && opts.gravity) || 0;
    particles.drag[i] = (opts && opts.drag) || 0.93;
}

// Spray of particles in all directions from a point
function burst(p, color, count, speed, size, life, opts) {
    for (let n = 0; n < count; n++) {
        const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
        const s = speed * (0.35 + Math.random() * 0.65);
        emitParticle(p.x, p.y, p.z, r * Math.cos(th) * s, u * s + (opts && opts.lift || 0), r * Math.sin(th) * s,
            color, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.4), opts);
    }
}

function updateParticles(dt, timeScale) {
    for (let i = 0; i < PARTICLE_MAX; i++) {
        if (particles.life[i] <= 0) { particles.alpha[i] = 0; continue; }
        particles.life[i] -= dt;
        const i3 = i * 3;
        const drag = Math.pow(particles.drag[i], timeScale);
        particles.vel[i3] *= drag; particles.vel[i3 + 1] = particles.vel[i3 + 1] * drag - particles.gravity[i] * timeScale; particles.vel[i3 + 2] *= drag;
        particles.pos[i3] += particles.vel[i3] * timeScale;
        particles.pos[i3 + 1] += particles.vel[i3 + 1] * timeScale;
        particles.pos[i3 + 2] += particles.vel[i3 + 2] * timeScale;
        const k = Math.max(particles.life[i] / particles.maxLife[i], 0);
        particles.alpha[i] = k;
        particles.size[i] = particles.baseSize[i] * (0.4 + 0.6 * k);
    }
    particleGeo.attributes.position.needsUpdate = true;
    particleGeo.attributes.aColor.needsUpdate = true;
    particleGeo.attributes.aSize.needsUpdate = true;
    particleGeo.attributes.aAlpha.needsUpdate = true;
    particleGeo.attributes.aShape.needsUpdate = true;
}

// ---------- Effects fired by gameplay ----------

function burstData(p) {
    burst(p, 0x5ff7ff, 26, 0.2, 0.35, 0.6);
    burst(p, 0xffffff, 8, 0.1, 0.55, 0.3);
}

function burstPowerup(p, type) {
    const c = POWERUP_COLORS[type];
    burst(p, c, 45, 0.28, 0.4, 0.8, { gravity: 0.004 });
    burst(p, c, 22, 0.18, 0.24, 0.7, { shape: 1, gravity: 0.006 });
    burst(p, 0xffffff, 10, 0.12, 0.6, 0.25);
}

function shatterMine(mine) {
    const p = mine.position;
    mine.visible = false;
    ball.visible = false;
    burst(p, 0xff1a35, 75, 0.36, 0.46, 1.2, { shape: 1, gravity: 0.008, lift: 0.08 });
    burst(p, 0xff6040, 30, 0.26, 0.34, 0.7);
    burst(ball.position, BALL_LOOKS[ballState].glow, 40, 0.3, 0.35, 0.8);
    burst(p, 0xffffff, 12, 0.15, 0.9, 0.25);
    addShake(0.7);
}

// ---------- Camera shake ----------

let shakeAmount = 0;
function addShake(a) { shakeAmount = Math.max(shakeAmount, a); }
function applyCameraShake(dt) {
    if (shakeAmount < 0.001) return;
    camera.position.x += (Math.random() - 0.5) * shakeAmount;
    camera.position.y += (Math.random() - 0.5) * shakeAmount;
    shakeAmount *= Math.pow(0.015, dt);
}

// ---------- Bloom (glow) with automatic fallback ----------
// ?quality=high forces bloom on, ?quality=low forces it off. Otherwise bloom turns itself
// off if the first seconds of play run below ~32 fps.

const qualityParam = new URLSearchParams(window.location.search).get('quality');
let composer = null, bloomPass = null, useBloom = false;

(function setupBloom() {
    if (qualityParam === 'low') return;
    if (!THREE.EffectComposer || !THREE.RenderPass || !THREE.UnrealBloomPass) return; // add-ons failed to load
    try {
        composer = new THREE.EffectComposer(renderer);
        composer.addPass(new THREE.RenderPass(scene, camera));
        bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.05, 0.55, 0.18);
        composer.addPass(bloomPass);
        useBloom = true;
    } catch (e) { composer = null; useBloom = false; }
})();

let perfFrames = 0, perfTime = 0, perfChecked = qualityParam === 'high';
function trackPerformance(dt) {
    if (perfChecked || !isPlaying) return;
    perfFrames++; perfTime += dt;
    if (perfFrames < 120) return;
    perfChecked = true;
    if (perfTime / perfFrames > 1 / 32) {
        useBloom = false;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
        renderer.setSize(window.innerWidth, window.innerHeight);
        updateParticleScale();
    }
}

function renderFrame() {
    if (useBloom && composer) composer.render();
    else renderer.render(scene, camera);
}

function resizeEffects() {
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
    updateParticleScale();
}

// ---------- Per-frame visuals ----------

let trailCarry = 0;

function surfaceUnderBall() {
    for (const p of platforms) {
        const d = p.geometry.parameters.depth, w = p.geometry.parameters.width;
        if (pos.x > p.position.x - w / 2 && pos.x < p.position.x + w / 2 && pos.z < p.position.z + d / 2 && pos.z > p.position.z - d / 2) return 0.5;
    }
    for (const m of movPlatforms) {
        if (Math.abs(pos.x - m.position.x) < 3 && Math.abs(pos.z - m.position.z) < 2) return m.position.y + 0.25;
    }
    return null;
}

function updateEffects(dt, timeScale) {
    const t = performance.now() / 1000;
    const look = BALL_LOOKS[ballState] || BALL_LOOKS.normal;

    // Ball shimmer
    ballMat.uniforms.uTime.value = t;
    ballGlow.material.opacity = 0.55 + Math.sin(t * 6) * 0.08;

    // Trail + sparks while running
    if (isPlaying && !isGameOver && ball.visible) {
        const speed = Math.hypot(vel.x, vel.z);
        trailCarry += timeScale * (0.6 + speed * 6);
        while (trailCarry >= 1) {
            trailCarry -= 1;
            const j = ballRadius * 0.35;
            emitParticle(pos.x + (Math.random() - 0.5) * j, pos.y + (Math.random() - 0.5) * j, pos.z + (Math.random() - 0.5) * j,
                -vel.x * 0.25 + (Math.random() - 0.5) * 0.01, (Math.random() - 0.5) * 0.01, -vel.z * 0.25 + (Math.random() - 0.5) * 0.01,
                look.glow, ballRadius * 0.95, 0.45);
        }
        if (onGround && speed > 0.08 && Math.random() < 0.7 * timeScale) {
            emitParticle(pos.x, pos.y - ballRadius * 0.85, pos.z,
                -vel.x * 1.4 + (Math.random() - 0.5) * 0.2, 0.05 + Math.random() * 0.09, -vel.z * 1.4 + (Math.random() - 0.5) * 0.2,
                0xcffcff, 0.16, 0.35, { gravity: 0.01, drag: 0.95 });
        }
    }
    updateParticles(dt, timeScale);

    // Pickups bob and spin (inner part only, so collision positions stay exact)
    for (const r of rings) {
        const inner = r.userData.inner;
        inner.position.y = Math.sin(t * 2.2 + r.userData.phase) * 0.15;
        inner.rotation.x += 0.02 * timeScale; inner.rotation.y += 0.05 * timeScale;
    }
    for (const p of powerups) {
        const inner = p.userData.inner;
        inner.position.y = Math.sin(t * 1.8 + p.userData.phase) * 0.18;
        inner.rotation.x += 0.02 * timeScale; inner.rotation.y += 0.05 * timeScale;
    }
    mineMat.emissiveIntensity = 0.5 + Math.sin(t * 4) * 0.2;

    // Landing ring under the ball
    const surf = ball.visible ? surfaceUnderBall() : null;
    if (surf === null) {
        groundRing.visible = groundGlow.visible = false;
    } else {
        const h = Math.max(pos.y - ballRadius - surf, 0);
        const fade = Math.max(1 - h / 7, 0.15);
        groundRing.visible = groundGlow.visible = true;
        groundRing.position.set(pos.x, surf + 0.03, pos.z);
        groundGlow.position.set(pos.x, surf + 0.02, pos.z);
        groundRing.scale.setScalar(ballRadius * (1 + h * 0.08));
        groundGlow.scale.setScalar(ballRadius);
        groundRing.material.color.setHex(look.glow);
        groundGlow.material.color.setHex(look.glow);
        groundRing.material.opacity = 0.55 * fade;
        groundGlow.material.opacity = 0.25 * fade;
    }

    // Keep the endless floor grid under the camera
    gridFloor.position.x = Math.round(camera.position.x / 4) * 4;
    gridFloor.position.z = Math.round(camera.position.z / 4) * 4;

    trackPerformance(dt);
}
