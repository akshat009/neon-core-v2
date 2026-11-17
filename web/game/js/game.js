// =========================================================
// Neon Core — main loop: physics, collisions, win / lose
// =========================================================

let attractTime = 0;

function animate() {
    requestAnimationFrame(animate);

    let dt = clock.getDelta();
    if (dt > 0.1) dt = 0.1;
    let timeScale = dt * 60;

    if(isPlaying && !isGameOver && !Pause.paused) {
        // The timer starts when the player first moves or jumps (not while the ball drops in)
        if(!timerRunning && (keys.w || keys.a || keys.s || keys.d || keys.space || (joystick.active && (joystick.x || joystick.y)))) {
            timerRunning = true;
            levelStartTime = Date.now();
        }
        if(timerRunning) {
            let timeElapsed = (Date.now() - levelStartTime) / 1000;
            currentTimeStr = timeElapsed.toFixed(1);
            document.getElementById('timer-txt').innerText = `TIME: ${currentTimeStr}s`;
        }

        // Physics runs in steps of at most one 60fps frame, so a slow frame on a weak phone
        // can't move the ball far enough to pass straight through a platform.
        const steps = Math.max(1, Math.ceil(timeScale - 0.001));
        for(let s = 0; s < steps && isPlaying && !isGameOver && !Pause.paused; s++) stepPhysics(timeScale / steps);
    }

    // --- Camera: slow cinematic sway on the title screen, follow cam in play ---
    if(menuAttract) {
        attractTime += dt;
        const a = Math.sin(attractTime * 0.18) * 0.55;
        const b = ball.position;
        camera.position.lerp(new THREE.Vector3(b.x + Math.sin(a) * 9, b.y + 3.2, b.z + Math.cos(a) * 9), 0.04 * (dt*60 || 1));
        camera.lookAt(b.x + ATTRACT_LOOK_X, b.y + ATTRACT_LOOK_Y, b.z - 6);
        ball.rotation.x -= dt * 0.9;
    } else {
        camera.position.lerp(new THREE.Vector3(ball.position.x, ball.position.y + 7, ball.position.z + 10), 0.1 * (dt*60 || 1));
        camera.lookAt(ball.position.x, ball.position.y, ball.position.z - 5);
    }
    applyCameraJuice(dt);   // strafe tilt + jump FOV (js/juice.js)
    applyCameraShake(dt);

    updateEffects(dt, timeScale);
    renderFrame();
}

function stepPhysics(timeScale) {
    const wasGrounded = onGround;
    if(invulnTime > 0) invulnTime -= timeScale / 60;   // respawn / shield grace time

    // --- Movement (keyboard gives -1/0/1, touch joystick gives analog values) ---
    let currentMaxSpeed = maxSpeed;
    if(ballState === 'small') currentMaxSpeed *= 1.4;
    if(ballState === 'big') currentMaxSpeed *= 0.85;

    let axisX = 0, axisZ = 0;
    if(keys.w) axisZ = -1; if(keys.s) axisZ = 1;
    if(keys.a) axisX = -1; if(keys.d) axisX = 1;
    if(joystick.active) { axisX = joystick.x; axisZ = joystick.y; }

    let targetVx = axisX * currentMaxSpeed, targetVz = axisZ * currentMaxSpeed;

    vel.x += (targetVx - vel.x) * 0.15 * timeScale;
    vel.z += (targetVz - vel.z) * 0.15 * timeScale;

    if(isOnMovingPlat) { pos.x += currentPlatVel.x * timeScale; pos.z += currentPlatVel.z * timeScale; }

    if(keys.space && onGround) { vel.y = jumpStrength; onGround = false; isOnMovingPlat = false; playJump(); }

    vel.y -= gravity * timeScale;

    pos.x += vel.x * timeScale;
    pos.y += vel.y * timeScale;
    pos.z += vel.z * timeScale;

    const fallSpeed = -vel.y;              // before the floor zeroes it (landing effects)
    onGround = false; isOnMovingPlat = false;

    // --- Platform collisions ---
    for(let p of platforms) {
        if(p.geometry.parameters.height === 1) {
            let d = p.geometry.parameters.depth, w = p.geometry.parameters.width;
            if(pos.x > p.position.x - w/2 && pos.x < p.position.x + w/2 && pos.z < p.position.z + d/2 && pos.z > p.position.z - d/2) {
                if(pos.y - ballRadius <= 0.5 && pos.y > 0.2 && vel.y <= 0) {
                    pos.y = 0.5 + ballRadius; vel.y = 0; onGround = true;
                lastSafe.x = pos.x; lastSafe.z = pos.z; lastSafe.plat = p;   // respawn point after a fall
                }
            }
        }
    }

    for(let m of movPlatforms) {
        m.position.x += m.userData.speed * m.userData.dir * timeScale;
        if(m.position.x > m.userData.endX || m.position.x < m.userData.startX) m.userData.dir *= -1;

        if(Math.abs(pos.x - m.position.x) < 3.5 && Math.abs(pos.z - m.position.z) < 2.5) {
            if(pos.y - ballRadius <= m.position.y + 0.25 && pos.y > m.position.y && vel.y <= 0) {
                pos.y = m.position.y + 0.25 + ballRadius; vel.y = 0; onGround = true;
                isOnMovingPlat = true; currentPlatVel.x = m.userData.speed * m.userData.dir;
            }
        }
    }

    if(onGround && !wasGrounded && fallSpeed > 0.12) onLanding(fallSpeed);   // squash + shockwave (js/juice.js)

    if(pos.y < -3) { onFall(); return; }   // costs a life (features/lives.js)
    if(pos.x > 6) { pos.x = 6; vel.x = 0; }
    if(pos.x < -6) { pos.x = -6; vel.x = 0; }

    // --- Ball visuals ---
    ball.position.copy(pos);
    if(onGround) {
        ball.rotation.x += (vel.z/ballRadius) * timeScale;
        ball.rotation.z -= (vel.x/ballRadius) * timeScale;
    } else {
        ball.rotation.x += (vel.z/ballRadius) * 0.5 * timeScale;
        ball.rotation.z -= (vel.x/ballRadius) * 0.5 * timeScale;
    }

    // --- Data pickups (spin/bob animation lives in effects.js) ---
    for(let i = rings.length - 1; i >= 0; i--) {
        if(pos.distanceTo(rings[i].position) < ballRadius + 1.2) {
            burstData(rings[i].position);
            flashRing(rings[i].position, 0x6ff8ff);
            scene.remove(rings[i]); rings.splice(i, 1); ringsCollected++; updateUI(); playCoin();
            if(ringsCollected >= targetRings) showLevelComplete();
        }
    }

    // --- Power-ups ---
    for(let i = powerups.length - 1; i >= 0; i--) {
        if(pos.distanceTo(powerups[i].position) < ballRadius + 1) {
            burstPowerup(powerups[i].position, powerups[i].userData.type);
            flashRing(powerups[i].position, POWERUP_COLORS[powerups[i].userData.type], 1.4);
            addShake(0.25);
            transformBall(powerups[i].userData.type);
            scene.remove(powerups[i]); powerups.splice(i, 1);
        }
    }

    // --- Mines (red hurdles) ---
    for(let sp of spikes) {
        if(sp.userData.moving) {
            sp.position.x += sp.userData.speed * sp.userData.dir * timeScale;
            if(sp.position.x > sp.userData.endX || sp.position.x < sp.userData.startX) sp.userData.dir *= -1;
        }
        if(isPlaying && !sp.userData.dead && invulnTime <= 0 && hitsGate(sp)) {
            onHurdleHit(sp);                              // shield or life (features/shield.js)
            if(Pause.paused || !isPlaying) return;
        }
    }
}

// ---------- 2X Data claim on the victory screen ----------
let lastSectorReward = 0;

async function claimDoubleData() {
    const btn = document.getElementById('lc-double');
    if (btn.disabled || Ads.busy || !lastSectorReward) return;
    const earned = await Ads.showRewarded('double');
    if (!earned) return;                          // closed early: the offer stays
    const bonus = lastSectorReward;
    lastSectorReward = 0;
    totalScore += bonus;
    saveScore(totalScore);
    const fmt = (v) => Math.round(v).toLocaleString('en-US');
    countUp('lc-score', bonus * 2, (v) => `+${fmt(v)}`, bonus);
    countUp('lc-total', totalScore, fmt, totalScore - bonus);
    btn.disabled = true;
    btn.innerHTML = `✓ 2X CLAIMED · +${fmt(bonus)} DATA`;
    playPowerup();
}
attachButtonAction('lc-double', claimDoubleData);

// Numbers on the level-complete card tick up instead of appearing at once
function countUp(id, to, format, from = 0, ms = 700) {
    const el = document.getElementById(id);
    const start = performance.now();
    const step = (now) => {
        const k = Math.min((now - start) / ms, 1);
        el.innerText = format(from + (to - from) * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(step);
    };
    el.innerText = format(from);
    requestAnimationFrame(step);
}

// Hazard gate hit box: the frame's width and depth, up to the top bar, a little forgiving
// at the edges so a graze doesn't count. Jumping over the top bar clears it.
function hitsGate(sp) {
    const dx = Math.abs(pos.x - sp.position.x);
    const dz = Math.abs(pos.z - sp.position.z);
    return dx < GATE_W / 2 + ballRadius * 0.55
        && dz < GATE_D / 2 + ballRadius * 0.7
        && pos.y - ballRadius < GATE_TOP_Y - 0.2;
}

function showLevelComplete() {
    isPlaying = false; playWin();
    keys.w = keys.a = keys.s = keys.d = keys.space = false;

    let timeTaken = parseFloat(currentTimeStr);
    let cfg = diffConfig[selectedDifficulty];

    // Star rating from par time
    let stars = 1, remark = "ACCEPTABLE";

    let parScale = IS_TOUCH ? TOUCH_PAR_SCALE : 1;          // joystick is slower than keys
    let parTime3Stars = targetRings * cfg.timePar * parScale;
    let parTime2Stars = targetRings * (cfg.timePar + 1.5) * parScale;

    if(timeTaken <= parTime3Stars) { stars = 3; remark = "OPTIMAL"; }
    else if(timeTaken <= parTime2Stars) { stars = 2; remark = "EFFICIENT"; }

    // Rating emblems: the same diamond shape as the data shards
    const STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5 21 12 12 22.5 3 12z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 6.2 16.6 12 12 17.8 7.4 12z" fill="currentColor"/></svg>';
    let starHtml = "";
    for(let i=0; i<3; i++) starHtml += `<span class="r-star ${i < stars ? 'on' : 'off'}">${STAR_SVG}</span>`;

    let difficultyMultiplier = selectedDifficulty === 'HARD' ? 3 : (selectedDifficulty === 'MEDIUM' ? 2 : 1);
    let levelScore = ((stars * 100) + (targetRings * 10)) * difficultyMultiplier;

    totalScore += levelScore;
    saveScore(totalScore);
    onSectorComplete();   // saves run progress (features/run.js)

    document.getElementById('lc-sector').innerText = `SECTOR ${pad2(level)}`;
    document.getElementById('stars-display').innerHTML = starHtml;
    document.getElementById('stars-display').setAttribute('aria-label', `${stars} of 3 stars`);
    document.getElementById('remark-txt').innerText = remark;
    document.getElementById('remark-txt').dataset.tier = stars;

    document.getElementById('lc-diff').innerText = selectedDifficulty;
    countUp('lc-time', timeTaken, (v) => `${v.toFixed(1)}s`);
    countUp('lc-score', levelScore, (v) => `+${Math.round(v).toLocaleString('en-US')}`);
    countUp('lc-total', totalScore, (v) => Math.round(v).toLocaleString('en-US'), totalScore - levelScore);

    // 2X Data: an opt-in rewarded ad that doubles this sector's reward, once
    lastSectorReward = levelScore;
    const dbl = document.getElementById('lc-double');
    dbl.disabled = false;
    dbl.innerHTML = `<span class="play">▶</span> WATCH AD · 2X DATA <b>+${levelScore.toLocaleString('en-US')}</b>`;
    Ads.prepareRewarded('double');

    // Debrief stats (all real numbers from this sector)
    const record = SectorProgress.record(selectedDifficulty, level, stars, timeTaken);
    document.getElementById('lc-record').classList.toggle('show', record.isNew);
    document.getElementById('lc-best').innerText = record.isNew ? (record.prev ? `was ${record.prev.toFixed(1)}s` : 'first clear') : `best ${record.best.toFixed(1)}s`;
    document.getElementById('lc-rings').innerText = `${pad2(ringsCollected)}/${pad2(targetRings)}`;
    document.getElementById('lc-rings-pct').innerText = `${targetRings ? Math.round(ringsCollected / targetRings * 100) : 100}%`;
    const gatesTotal = spikes.length;
    const gatesHit = spikes.filter(s => s.userData.dead).length;
    countUp('lc-gates', gatesTotal - gatesHit, (v) => String(Math.round(v)));
    document.getElementById('lc-gates-of').innerText = gatesTotal ? `of ${gatesTotal}` : 'none here';
    document.getElementById('lc-lives').innerText = Lives.count;
    document.getElementById('lc-shields').innerText = `${Shield.count} ${Shield.count === 1 ? 'shield' : 'shields'}`;

    document.getElementById('next-level-btn').innerText = practice ? 'SECTOR MAP' : 'NEXT SECTOR';
    showOnly('level-menu');
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    resizeEffects();
});

// --- Boot ---
clock.start();
animate();
