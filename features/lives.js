// =========================================================
// Neon Core features — lives
//
// • Every run starts with FEATURES.livesPerRun (3). Lives carry over between sectors.
// • Falling off the track, or hitting a hurdle without a shield, costs one life.
// • With lives left you respawn on the spot (falls: back on the last platform you stood on)
//   and can't be hit for a moment. With no lives left → out-of-lives screen (features/run.js).
// =========================================================

const Lives = { count: FEATURES.livesPerRun, adContinues: 0, lastWasFall: false };

let invulnTime = 0;                               // seconds; counted down in js/game.js
const lastSafe = { x: 0, z: -2, plat: null };     // updated in js/game.js when the ball lands on a platform

function setLives(n) {
    Lives.count = Math.max(n, 0);
    renderLives();
}

function renderLives() {
    const row = document.getElementById('lives-row');
    const slots = Math.max(FEATURES.livesPerRun, Lives.count);
    let html = '';
    for (let i = 0; i < slots; i++) html += `<span class="life${i < Lives.count ? ' on' : ''}"></span>`;
    row.innerHTML = html;
    row.setAttribute('aria-label', `${Lives.count} lives`);
}

// Fall off the track (called from js/game.js)
function onFall() {
    loseLife('GRID BREACH DETECTED!', {});
}

function loseLife(reason, opts) {
    Lives.lastWasFall = !opts.mine;
    if (opts.mine) { opts.mine.userData.dead = true; shatterMine(opts.mine); }
    playDie();
    setLives(Lives.count - 1);
    flashLives();

    if (Lives.count <= 0) { outOfLives(reason); return; }

    pauseGame('respawn');
    setTimeout(() => {
        respawnBall(Lives.lastWasFall ? 'safe' : 'here');
        resumeGame('respawn');
    }, FEATURES.respawnDelayMs);
}

function respawnBall(where) {
    if (where === 'here' && surfaceUnderBall() === null) where = 'safe';
    if (where === 'safe') {
        let x = Math.max(-5, Math.min(5, lastSafe.x)), z = lastSafe.z;
        const p = lastSafe.plat;
        if (p) {
            const half = p.geometry.parameters.depth / 2;
            const margin = Math.min(2, half - 0.5);
            z = Math.max(p.position.z - half + margin, Math.min(p.position.z + half - margin, z));
        }
        pos.set(x, 3, z);
    }
    vel.set(0, 0, 0);
    onGround = false; isOnMovingPlat = false;
    ball.position.copy(pos);
    ball.visible = true;
    resetTrail();
    invulnTime = FEATURES.respawnShieldSeconds;
}

function flashLives() {
    const row = document.getElementById('lives-row');
    row.classList.remove('hit'); void row.offsetWidth; row.classList.add('hit');
}
