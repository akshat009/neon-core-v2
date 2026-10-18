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
    burst(p, 0x6ff8ff, 22, 0.2, 0.14, 0.55, { shape: 1 });
    burst(p, 0xffffff, 6, 0.1, 0.22, 0.25, { shape: 1 });
}

function burstPowerup(p, type) {
    const c = POWERUP_COLORS[type];
    burst(p, c, 36, 0.26, 0.16, 0.7, { shape: 1, gravity: 0.004 });
    burst(p, c, 16, 0.16, 0.1, 0.6, { shape: 1, gravity: 0.006 });
    burst(p, 0xffffff, 6, 0.12, 0.22, 0.25, { shape: 1 });
}

function shatterMine(mine) {
    const p = mine.position;
    mine.visible = false;
    ball.visible = false;
    resetTrail();
    burst(p, 0xff1a35, 70, 0.36, 0.26, 1.1, { shape: 1, gravity: 0.008, lift: 0.08 });
    burst(p, 0xff6040, 24, 0.26, 0.16, 0.7, { shape: 1 });
    burst(ball.position, BALL_LOOKS[ballState].glow, 30, 0.3, 0.16, 0.8, { shape: 1 });
    burst(p, 0xffffff, 8, 0.15, 0.35, 0.2);
    addShake(0.7);
}

// ---------- Tron light trail: a thin wall of light left behind the ball ----------

const TRAIL_POINTS = 56;
const TRAIL_SPACING = 0.16;
const trailPts = [];
const trailPos = new Float32Array(TRAIL_POINTS * 2 * 3);
const trailUV = new Float32Array(TRAIL_POINTS * 2 * 2);
const trailIndex = [];
for (let i = 0; i < TRAIL_POINTS - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    trailIndex.push(a, b, c, b, d, c);
}
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
trailGeo.setAttribute('aUV', new THREE.BufferAttribute(trailUV, 2));
trailGeo.setIndex(trailIndex);
trailGeo.setDrawRange(0, 0);

const trailMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(BALL_LOOKS.normal.glow) } },
    vertexShader: `
        attribute vec2 aUV; varying vec2 vUV;
        void main() { vUV = aUV; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
        uniform vec3 uColor; varying vec2 vUV;
        void main() {
            float fade = pow(1.0 - vUV.x, 1.6);                  // 0 = at the ball, 1 = tail end
            float edge = smoothstep(0.78, 1.0, vUV.y) + 0.6 * smoothstep(0.25, 0.0, vUV.y);
            float a = (0.28 + edge) * fade;
            gl_FragColor = vec4(uColor + edge * 0.35, a);
        }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
});
const trailMesh = new THREE.Mesh(trailGeo, trailMat);
trailMesh.frustumCulled = false;
scene.add(trailMesh);

let trailIdle = 0;

function resetTrail() {
    trailPts.length = 0;
    trailGeo.setDrawRange(0, 0);
}

// trailPts[0] is the live point at the ball; the rest are fixed samples TRAIL_SPACING apart,
// so the trail keeps the same shape at any frame rate. Max length = TRAIL_POINTS * TRAIL_SPACING.
function updateTrail(dt) {
    const running = isPlaying && !isGameOver && ball.visible;
    if (running) {
        const cur = { x: pos.x, y: pos.y - ballRadius + 0.03, z: pos.z, h: ballRadius * 0.7 };
        if (trailPts.length === 0) {
            trailPts.push(cur, { ...cur });
        } else {
            const last = trailPts[1] || trailPts[0];
            let dx = cur.x - last.x, dy = cur.y - last.y, dz = cur.z - last.z;
            let d = Math.hypot(dx, dy, dz);
            if (Math.hypot(dx, dz) > 6) {                // teleport / respawn: start fresh
                trailPts.length = 0; trailPts.push(cur, { ...cur }); d = 0;
            }
            let base = last;
            while (d > TRAIL_SPACING) {                    // drop fixed samples along the path
                const k = TRAIL_SPACING / d;
                const sample = { x: base.x + dx * k, y: base.y + dy * k, z: base.z + dz * k, h: cur.h };
                trailPts.splice(1, 0, sample);
                base = sample;
                dx = cur.x - base.x; dy = cur.y - base.y; dz = cur.z - base.z;
                d = Math.hypot(dx, dy, dz);
            }
            trailPts[0] = cur;
            if (trailPts.length > TRAIL_POINTS) trailPts.length = TRAIL_POINTS;
        }
        const moving = Math.hypot(vel.x, vel.z) > 0.03 || Math.abs(vel.y) > 0.03;
        trailIdle = moving ? 0 : trailIdle + dt;
    } else {
        trailIdle += dt;
    }
    // When the ball stops (or dies), the tail retracts over ~1.5s
    if (trailIdle > 0.15) {
        const remove = Math.ceil(dt * 45);
        for (let r = 0; r < remove && trailPts.length > 1; r++) trailPts.pop();
    }

    const n = trailPts.length;
    for (let i = 0; i < n; i++) {
        const q = trailPts[i], u = n > 1 ? i / (TRAIL_POINTS - 1) : 0, k = i * 6, t = i * 4;
        trailPos[k] = q.x; trailPos[k + 1] = q.y; trailPos[k + 2] = q.z;
        trailPos[k + 3] = q.x; trailPos[k + 4] = q.y + q.h; trailPos[k + 5] = q.z;
        trailUV[t] = u; trailUV[t + 1] = 0; trailUV[t + 2] = u; trailUV[t + 3] = 1;
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.aUV.needsUpdate = true;
    trailGeo.setDrawRange(0, n > 1 ? (n - 1) * 6 : 0);
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
// The scene is rendered into a multisampled target (WebGL2) so edges stay anti-aliased with bloom on.

const qualityParam = new URLSearchParams(window.location.search).get('quality');
let composer = null, bloomPass = null, useBloom = false;

(function setupBloom() {
    if (qualityParam === 'low') return;
    if (!THREE.EffectComposer || !THREE.RenderPass || !THREE.UnrealBloomPass) return; // add-ons failed to load
    try {
        let target;
        if (renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget) {
            target = new THREE.WebGLMultisampleRenderTarget(1, 1, { format: THREE.RGBAFormat });
            target.samples = 4;
        }
        composer = new THREE.EffectComposer(renderer, target);
        composer.setPixelRatio(renderer.getPixelRatio());
        composer.setSize(window.innerWidth, window.innerHeight);
        composer.addPass(new THREE.RenderPass(scene, camera));
        bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.8, 0.25, 0.28);
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
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.setSize(window.innerWidth, window.innerHeight);
        updateParticleScale();
    }
}

function renderFrame() {
    if (useBloom && composer) composer.render();
    else renderer.render(scene, camera);
}

function resizeEffects() {
    if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(window.innerWidth, window.innerHeight); }
    updateParticleScale();
}

// ---------- Per-frame visuals ----------

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

    // Ball circuit pulse + faint halo
    ballMat.uniforms.uTime.value = t;
    ballGlow.material.opacity = 0.18 + Math.sin(t * 6) * 0.04;

    // Light trail + tiny ground sparks
    updateTrail(dt);
    if (isPlaying && !isGameOver && ball.visible) {
        const speed = Math.hypot(vel.x, vel.z);
        if (onGround && speed > 0.1 && Math.random() < 0.4 * timeScale) {
            emitParticle(pos.x, pos.y - ballRadius * 0.9, pos.z,
                -vel.x * 1.2 + (Math.random() - 0.5) * 0.16, 0.04 + Math.random() * 0.07, -vel.z * 1.2 + (Math.random() - 0.5) * 0.16,
                0xd8fdff, 0.07, 0.3, { shape: 1, gravity: 0.01, drag: 0.95 });
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
        p.userData.core.rotation.y -= 0.09 * timeScale;    // inner cube spins the other way
    }
    mineMat.emissiveIntensity = 0.3 + Math.sin(t * 4) * 0.12;

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
        groundRing.material.opacity = 0.75 * fade;
        groundGlow.material.opacity = 0.12 * fade;
    }

    // Keep the endless floor grid under the camera
    gridFloor.position.x = Math.round(camera.position.x / 4) * 4;
    gridFloor.position.z = Math.round(camera.position.z / 4) * 4;

    trackPerformance(dt);
}
