// =========================================================
// Neon Core — main loop: physics, collisions, win / lose
// =========================================================

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

    // --- Camera follow ---
    camera.position.lerp(new THREE.Vector3(ball.position.x, ball.position.y + 7, ball.position.z + 10), 0.1 * (dt*60 || 1));
    camera.lookAt(ball.position.x, ball.position.y, ball.position.z - 5);
    applyCameraShake(dt);

    updateEffects(dt, timeScale);
    renderFrame();
}

function stepPhysics(timeScale) {
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
            scene.remove(rings[i]); rings.splice(i, 1); ringsCollected++; updateUI(); playCoin();
            if(ringsCollected >= targetRings) showLevelComplete();
        }
    }

    // --- Power-ups ---
    for(let i = powerups.length - 1; i >= 0; i--) {
        if(pos.distanceTo(powerups[i].position) < ballRadius + 1) {
            burstPowerup(powerups[i].position, powerups[i].userData.type);
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
        sp.rotation.y += 0.02 * timeScale; sp.rotation.x += 0.02 * timeScale;
        if(isPlaying && !sp.userData.dead && invulnTime <= 0 && pos.distanceTo(sp.position) < ballRadius + 0.8) {
            onHurdleHit(sp);                              // shield or life (features/shield.js)
            if(Pause.paused || !isPlaying) return;
        }
    }
}

function showLevelComplete() {
    isPlaying = false; playWin();
    keys.w = keys.a = keys.s = keys.d = keys.space = false;

    let timeTaken = parseFloat(currentTimeStr);
    let cfg = diffConfig[selectedDifficulty];

    // Star rating from par time
    let stars = 1, remark = "ACCEPTABLE", color = "#ffaa00";

    let parScale = IS_TOUCH ? TOUCH_PAR_SCALE : 1;          // joystick is slower than keys
    let parTime3Stars = targetRings * cfg.timePar * parScale;
    let parTime2Stars = targetRings * (cfg.timePar + 1.5) * parScale;

    if(timeTaken <= parTime3Stars) { stars = 3; remark = "OPTIMAL"; color = "#00ffcc"; }
    else if(timeTaken <= parTime2Stars) { stars = 2; remark = "EFFICIENT"; color = "#00aaff"; }

    let starHtml = "";
    for(let i=0; i<3; i++) starHtml += (i < stars) ? "⭐ " : "🌑 ";

    let difficultyMultiplier = selectedDifficulty === 'HARD' ? 3 : (selectedDifficulty === 'MEDIUM' ? 2 : 1);
    let levelScore = ((stars * 100) + (targetRings * 10)) * difficultyMultiplier;

    totalScore += levelScore;
    saveScore(totalScore);
    onSectorComplete();   // saves run progress (features/run.js)

    document.getElementById('lc-title').innerText = `SECTOR ${level} SECURED`;
    document.getElementById('stars-display').innerHTML = starHtml;
    document.getElementById('remark-txt').innerText = remark;
    document.getElementById('remark-txt').style.color = color;

    document.getElementById('lc-diff').innerText = selectedDifficulty;
    document.getElementById('lc-time').innerText = `${timeTaken}s`;
    document.getElementById('lc-score').innerText = `+${levelScore}`;
    document.getElementById('lc-total').innerText = totalScore;

    document.getElementById('level-menu').style.display = 'flex';
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
