// =========================================================
// Neon Core — game feel ("juice")
//
// • Landing: the ball squashes and a shockwave ring spreads over the floor
// • Falling: the ball stretches a little
// • Pickups: data shards get pulled into the ball, every pickup flashes a ring
// • Hazard gates: scrolling stripes, a sweeping scan light, pulsing red glow on the floor
// • Camera: slight roll when steering, wider view while airborne / in micro form
// • Mouse cursor hides while a sector is being played
// Everything here is visual only: no physics or scoring changes.
// =========================================================

// ---------- Ring pool: landing shockwaves and pickup flashes ----------

const RING_POOL = [];
const ringGeo = new THREE.RingGeometry(0.86, 1, 48);
for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide
    }));
    m.visible = false;
    m.userData = { life: 0, maxLife: 1, from: 1, to: 2, face: 'up', alpha: 1 };
    scene.add(m);
    RING_POOL.push(m);
}

function spawnRing(x, y, z, color, opts) {
    const r = RING_POOL.find(m => !m.visible) || RING_POOL[0];
    const o = opts || {};
    r.position.set(x, y, z);
    r.material.color.setHex(color);
    r.userData.life = 0;
    r.userData.maxLife = o.life || 0.45;
    r.userData.from = o.from || 1;
    r.userData.to = o.to || 3;
    r.userData.face = o.face || 'up';
    r.userData.alpha = o.alpha === undefined ? 0.9 : o.alpha;
    r.rotation.set(o.face === 'camera' ? 0 : -Math.PI / 2, 0, 0);
    r.scale.setScalar(r.userData.from);
    r.visible = true;
}

// Expanding ring that faces the camera (pickups)
function flashRing(p, color, size) {
    const s = size || 1;
    spawnRing(p.x, p.y, p.z, color, { face: 'camera', from: 0.5 * s, to: 2.2 * s, life: 0.35, alpha: 0.85 });
}

function updateRings(dt) {
    for (const r of RING_POOL) {
        if (!r.visible) continue;
        r.userData.life += dt;
        const k = r.userData.life / r.userData.maxLife;
        if (k >= 1) { r.visible = false; continue; }
        const ease = 1 - Math.pow(1 - k, 3);                     // fast out, slow settle
        r.scale.setScalar(r.userData.from + (r.userData.to - r.userData.from) * ease);
        r.material.opacity = r.userData.alpha * (1 - k);
        if (r.userData.face === 'camera') r.quaternion.copy(camera.quaternion);
    }
}

// ---------- Landing squash / falling stretch ----------

let squash = 0, squashVel = 0;

// Called from stepPhysics() in js/game.js the frame the ball touches down
function onLanding(fallSpeed) {
    const hit = Math.min(fallSpeed, 0.8);
    playLand(hit);
    if (hit > 0.45) haptic(12);
    squash = Math.max(squash, Math.min(hit * 0.55, 0.3));
    squashVel = 0;
    const look = BALL_LOOKS[ballState] || BALL_LOOKS.normal;
    const y = pos.y - ballRadius + 0.04;
    spawnRing(pos.x, y, pos.z, look.glow, { from: ballRadius * 0.8, to: ballRadius * (1.8 + hit * 3), life: 0.5, alpha: Math.min(0.4 + hit, 0.95) });
    if (hit > 0.45) {
        addShake(0.12 + (hit - 0.45) * 0.5);
        burst({ x: pos.x, y: y + 0.1, z: pos.z }, look.glow, Math.round(10 + hit * 16), 0.16 + hit * 0.1, 0.08, 0.4, { shape: 1, gravity: 0.01 });
    }
}

function updateSquash(dt) {
    // Spring back to the target; stretch slightly while falling fast
    const falling = isPlaying && !onGround && vel.y < -0.2;
    const target = falling ? -Math.min((-vel.y - 0.2) * 0.25, 0.1) : 0;
    // Damped spring in small fixed steps, so a slow frame can't make it blow up
    const k = 260, c = 16;
    for (let left = Math.min(dt, 0.1); left > 0; left -= 1 / 120) {
        const h = Math.min(left, 1 / 120);
        squashVel += (-(squash - target) * k - squashVel * c) * h;
        squash += squashVel * h;
    }
    squash = THREE.MathUtils.clamp(squash, -0.15, 0.35);
    if (!ball.visible) { squash = 0; squashVel = 0; }
    ballMat.uniforms.uSquash.value = squash;
    ballMat.uniforms.uRadius.value = ballRadius;
}

// ---------- Pickups, hazard gates, nucleus ----------

// Extra distance (beyond touching) at which shards start flying in: CORES[…].magnet (js/config.js)

function updatePickupsAndMines(dt, t) {
    if (isPlaying && !isGameOver && !Pause.paused && ball.visible) {
        const pull = 1 - Math.pow(0.0005, dt);
        const reach = ballRadius + 1.2 + (CORES[ballState] || CORES.normal).magnet;
        for (const r of rings) {
            if (r.position.distanceTo(pos) < reach) r.position.lerp(pos, pull);
        }
    }

    // Hazard gates: stripes scroll, a scan light sweeps up and down, everything pulses
    hazardTex.offset.x = (hazardTex.offset.x - dt * 0.8) % 1;
    for (const sp of spikes) {
        const gate = sp.children[0];
        if (!gate || !gate.userData.scan) continue;
        const ph = sp.userData.phase || 0;
        gate.userData.scan.position.y = Math.sin(t * 2.4 + ph) * (GATE_H / 2 - 0.12);
    }
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    gateFrameMat.opacity = 0.8 + pulse * 0.2;
    gateStripeMat.opacity = 0.62 + pulse * 0.25;
    mineFloorMat.opacity = 0.3 + pulse * 0.3;

    nucleus.rotation.x -= dt * 2.2;
    nucleus.rotation.y += dt * 1.6;
}

// ---------- Camera: strafe tilt + airborne FOV ----------

let camTilt = 0, camFovBoost = 0;

// Called from animate() in js/game.js right after camera.lookAt()
function applyCameraJuice(dt) {
    const live = isPlaying && !isGameOver && !menuAttract && !reducedMotion.matches;
    const steer = live ? THREE.MathUtils.clamp(vel.x / (maxSpeed || 0.3), -1, 1) : 0;
    camTilt += (-steer * 0.038 - camTilt) * (1 - Math.pow(0.004, dt));      // up to ~2.2°
    camera.rotateZ(camTilt);

    const target = live ? (onGround ? 0 : 4) + (ballState === 'jet' ? 3 : 0) : 0;
    camFovBoost += (target - camFovBoost) * (1 - Math.pow(0.03, dt));
    const fov = initialFov + camFovBoost;
    if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
    }
}

// ---------- Per frame (called from updateEffects in js/effects.js) ----------

function updateJuice(dt, timeScale) {
    const t = performance.now() / 1000;
    updateRings(dt);
    updateSquash(dt);
    updatePickupsAndMines(dt, t);
    document.body.classList.toggle('cursor-hidden', isPlaying && !isGameOver && !Pause.paused);
}
