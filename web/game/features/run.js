// =========================================================
// Neon Core features — run flow and saved progress
//
// • Start menu: "CONTINUE · SECTOR N" when a run is saved, plus "NEW RUN".
//   Also shows your shields with a "watch ad → +1 shield" button.
// • The run (sector, difficulty, lives) is saved at the start of every sector and after
//   clearing one, so closing the app doesn't lose progress.
// • Out of lives → "watch ad → +1 life, continue right here".
//   Skip → "you skipped the ad, back to Sector 1" screen with a banner ad.
// =========================================================

document.body.classList.toggle('touch', IS_TOUCH);

function showOnly(id) {
    ['start-menu', 'level-menu', 'gameover-menu', 'restart-menu', 'pause-modal'].forEach(m => {
        const el = document.getElementById(m);
        if (el) el.style.display = (m === id) ? 'flex' : 'none';
    });
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
        pauseBtn.style.display = (id === null || id === 'pause-modal') ? 'grid' : 'none';
    }
    if (id !== 'restart-menu' && id !== 'pause-modal') {
        Ads.hideBanner();
    }
}

function savedRun() {
    const r = SaveData.data.run;
    if (!r || !diffConfig[r.difficulty]) return null;
    // A run still on Sector 1 with full lives isn't worth a "continue" button
    if (r.sector <= 1 && r.lives >= FEATURES.livesPerRun) return null;
    return r;
}

function refreshStartMenu() {
    const r = savedRun();
    const startBtn = document.getElementById('start-btn');
    startBtn.textContent = r ? `CONTINUE · SECTOR ${pad2(r.sector)}` : 'START RUN';
    document.getElementById('new-run-btn').style.display = r ? 'block' : 'none';
    document.getElementById('continue-info').textContent = r ? `${r.difficulty} · ${r.lives} ${r.lives === 1 ? 'LIFE' : 'LIVES'} LEFT` : '';
    renderShieldUI();
    Ads.prepareRewarded('shield');          // for the "▶ AD · +1" button
}

// ---------- Starting sectors ----------

function beginSector() {
    enterFullscreen();
    initAudio();
    showOnly(null);
    document.getElementById('ui').style.display = 'block';
    if (IS_TOUCH) document.getElementById('mobile-controls').style.display = 'flex';

    ['gameover', 'respawn', 'shield-offer', 'shield-ad'].forEach(r => Pause.reasons.delete(r));
    Shield.refreshDaily();
    invulnTime = 0;
    generateLevel();
    lastSafe.x = 0; lastSafe.z = -2; lastSafe.plat = platforms[0] || null;
    renderLives();
    SaveData.setRun({ sector: level, difficulty: selectedDifficulty, lives: Lives.count });
}

function startNewRun() {
    level = 1;
    Lives.adContinues = 0;
    setLives(FEATURES.livesPerRun);
    beginSector();
}

function continueRun() {
    const r = savedRun();
    if (!r) { startNewRun(); return; }
    setDifficulty(r.difficulty);   // resets level to 1, so set the sector after it
    level = r.sector;
    Lives.adContinues = 0;
    setLives(r.lives || FEATURES.livesPerRun);
    beginSector();
}

// Called from showLevelComplete() in js/game.js
function onSectorComplete() {
    invulnTime = 0;
    SaveData.setRun({ sector: level + 1, difficulty: selectedDifficulty, lives: Lives.count });
}

// ---------- Out of lives ----------

function outOfLives(reason) {
    isGameOver = true;
    isPlaying = false;
    pauseGame('gameover');
    Ads.prepareRewarded('continue');
    keys.w = keys.a = keys.s = keys.d = keys.space = false;

    document.getElementById('death-reason').innerText = reason;
    document.getElementById('go-sector').innerText = pad2(level);
    document.getElementById('go-data').innerText = `${pad2(ringsCollected)}/${pad2(targetRings)}`;
    document.getElementById('go-total').innerText = totalScore;
    const canContinue = Lives.adContinues < FEATURES.maxAdContinuesPerRun;
    document.getElementById('continue-ad-btn').style.display = canContinue ? 'block' : 'none';
    document.getElementById('skip-continue-btn').textContent = canContinue ? 'SKIP' : 'CONTINUE';

    setTimeout(() => { if (isGameOver) showOnly('gameover-menu'); }, FEATURES.respawnDelayMs);
}

async function continueWithAd() {
    if (Ads.busy) return;
    const earned = await Ads.showRewarded('continue');
    if (!earned) return;                         // closed early: stay on this screen
    Lives.adContinues++;
    setLives(1);
    showOnly(null);
    isGameOver = false;
    isPlaying = true;
    respawnBall(Lives.lastWasFall ? 'safe' : 'here');
    SaveData.setRun({ sector: level, difficulty: selectedDifficulty, lives: Lives.count });
    resumeGame('gameover');
}

function skipContinue() {
    SaveData.clearRun();
    document.getElementById('rs-sector').innerText = pad2(level);
    document.getElementById('rs-best').innerText = pad2(SaveData.data.bestSector);
    document.getElementById('rs-total').innerText = totalScore;
    showOnly('restart-menu');
    Ads.showBanner('restart');
}

function restartFromSectorOne() {
    Ads.hideBanner();
    resumeGame('gameover');
    isGameOver = false;
    startNewRun();
}

// ---------- Buttons ----------

attachButtonAction('start-btn', () => (savedRun() ? continueRun() : startNewRun()));
attachButtonAction('new-run-btn', startNewRun);

attachButtonAction('next-level-btn', () => {
    level++;
    beginSector();
});

attachButtonAction('exit-btn', () => {
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
    document.getElementById('ui').style.display = 'none';
    document.getElementById('mobile-controls').style.display = 'none';
    showOnly('start-menu');
    isPlaying = false;
    keys.w = keys.a = keys.s = keys.d = keys.space = false;
    level = 1;
    refreshStartMenu();
});

function togglePauseMenu() {
    if (!isPlaying || isGameOver) return;
    const modal = document.getElementById('pause-modal');
    if (!modal) return;
    if (Pause.reasons.has('esc-pause')) {
        resumeGame('esc-pause');
        modal.style.display = 'none';
        Ads.hideBanner();
    } else {
        pauseGame('esc-pause');
        modal.style.display = 'flex';
        Ads.showBanner('pause');
    }
}

attachButtonAction('pause-btn', togglePauseMenu);
attachButtonAction('resume-btn', () => {
    const modal = document.getElementById('pause-modal');
    if (modal) modal.style.display = 'none';
    Ads.hideBanner();
    resumeGame('esc-pause');
});

attachButtonAction('pause-exit-btn', async () => {
    const modal = document.getElementById('pause-modal');
    if (modal) modal.style.display = 'none';
    Ads.hideBanner();
    resumeGame('esc-pause');

    // Show Demo Ad when exiting to menu
    try {
        await Ads.showRewarded('exit');
    } catch (e) {}

    if (document.fullscreenElement && document.exitFullscreen) {
        try { document.exitFullscreen().catch(() => {}); } catch(e) {}
    }
    document.getElementById('ui').style.display = 'none';
    document.getElementById('mobile-controls').style.display = 'none';
    showOnly('start-menu');
    isPlaying = false;
    timerRunning = false;
    keys.w = keys.a = keys.s = keys.d = keys.space = false;
    level = 1;
    refreshStartMenu();
});

attachButtonAction('continue-ad-btn', continueWithAd);
attachButtonAction('skip-continue-btn', skipContinue);
attachButtonAction('restart-btn', restartFromSectorOne);

refreshStartMenu();
renderLives();
