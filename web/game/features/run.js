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

// A sector replayed from the sector map (features/sectors.js): { sector }.
// It never touches the saved run, and clearing or ending it goes back to the map.
let practice = null;

function showOnly(id) {
    lockInput();
    ['start-menu', 'map-menu', 'level-menu', 'gameover-menu', 'restart-menu', 'pause-modal'].forEach(m => {
        const el = document.getElementById(m);
        if (el) el.style.display = (m === id) ? 'flex' : 'none';
    });
    menuAttract = (id === 'start-menu' || id === 'map-menu');   // slow camera sway behind menus (js/game.js)
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
        pauseBtn.style.display = (id === null || id === 'pause-modal') ? 'grid' : 'none';
    }
    if (id !== 'restart-menu' && id !== 'pause-modal') {
        Ads.hideBanner();
    }
    if (id && id !== 'start-menu') focusDialog(document.getElementById(id));
    else releaseDialog();
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
    startBtn.textContent = r ? 'CONTINUE' : 'PLAY';
    document.getElementById('new-run-btn').style.display = r ? 'block' : 'none';
    document.getElementById('continue-info').textContent = r ? `SECTOR ${pad2(r.sector)} · ${r.difficulty} · ${r.lives} ${r.lives === 1 ? 'LIFE' : 'LIVES'} LEFT` : '';
    document.getElementById('title-best').textContent = pad2(SaveData.data.bestSector);
    document.getElementById('title-total').textContent = totalScore.toLocaleString('en-US');
    renderShieldUI();
    Ads.prepareRewarded('shield');          // for the "+1" shield ad button
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
    if (!practice) SaveData.setRun({ sector: level, difficulty: selectedDifficulty, lives: Lives.count });
}

function startNewRun() {
    practice = null;
    level = 1;
    Lives.adContinues = 0;
    setLives(FEATURES.livesPerRun);
    beginSector();
}

function continueRun() {
    const r = savedRun();
    if (!r) { startNewRun(); return; }
    practice = null;
    setDifficulty(r.difficulty);   // resets level to 1, so set the sector after it
    level = r.sector;
    Lives.adContinues = 0;
    setLives(r.lives || FEATURES.livesPerRun);
    beginSector();
}

// Called from showLevelComplete() in js/game.js
function onSectorComplete() {
    invulnTime = 0;
    if (practice) return;
    SaveData.setRun({ sector: level + 1, difficulty: selectedDifficulty, lives: Lives.count });
}

// ---------- Out of lives ----------

// How the last life was lost decides the game-over title, emblem and tip
const GAME_OVER_CAUSES = {
    fall: {
        title: 'LOST IN THE VOID',
        reason: 'You fell off the track on your last life.',
        tip: 'Tip: watch for gaps and jump a little early. The heavy core jumps further.'
    },
    gate: {
        title: 'CORE SHATTERED',
        reason: 'You crashed into a hazard gate on your last life.',
        tip: 'Tip: jump over gates, or keep a shield ready. Shields break gates for you.'
    }
};

function outOfLives(reason) {
    isGameOver = true;
    isPlaying = false;
    pauseGame('gameover');
    Ads.prepareRewarded('continue');
    keys.w = keys.a = keys.s = keys.d = keys.space = false;

    const cause = Lives.lastWasFall ? 'fall' : 'gate';
    const info = GAME_OVER_CAUSES[cause];
    document.getElementById('gameover-menu').dataset.cause = cause;
    document.getElementById('go-title').innerText = info.title;
    document.getElementById('death-reason').innerText = info.reason || reason;
    document.getElementById('go-tip').innerText = info.tip;
    document.getElementById('go-sector').innerText = pad2(level);
    document.getElementById('go-sector-top').innerText = pad2(level);
    document.getElementById('go-sector-revive').innerText = pad2(level);
    document.getElementById('go-best').innerText = `best ${pad2(Math.max(SaveData.data.bestSector, level))}`;
    document.getElementById('go-data').innerText = `${pad2(ringsCollected)}/${pad2(targetRings)}`;
    document.getElementById('go-bar').style.width = `${targetRings ? Math.round(ringsCollected / targetRings * 100) : 0}%`;
    document.getElementById('go-total').innerText = totalScore.toLocaleString('en-US');
    const canContinue = Lives.adContinues < FEATURES.maxAdContinuesPerRun;
    document.getElementById('go-revive').style.display = canContinue ? 'block' : 'none';
    const dataBtn = document.getElementById('continue-data-btn');
    dataBtn.style.display = totalScore >= FEATURES.reviveDataCost ? 'block' : 'none';
    dataBtn.innerHTML = `USE ◈ ${FEATURES.reviveDataCost} DATA`;
    document.getElementById('skip-continue-btn').textContent = practice ? 'SECTOR MAP' : (canContinue ? 'END RUN' : 'CONTINUE');

    setTimeout(() => { if (isGameOver) showOnly('gameover-menu'); }, FEATURES.respawnDelayMs);
}

async function continueWithAd() {
    if (Ads.busy) return;
    const earned = await Ads.showRewarded('continue');
    if (!earned) return;                         // closed early: stay on this screen
    revive();
}

// Game over: pay Data instead of watching an ad
function continueWithData() {
    if (Ads.busy || totalScore < FEATURES.reviveDataCost) return;
    totalScore -= FEATURES.reviveDataCost;
    saveScore(totalScore);
    playPowerup();
    revive();
}

function revive() {
    Lives.adContinues++;
    setLives(1);
    showOnly(null);
    isGameOver = false;
    isPlaying = true;
    respawnBall(Lives.lastWasFall ? 'safe' : 'here');
    if (!practice) SaveData.setRun({ sector: level, difficulty: selectedDifficulty, lives: Lives.count });
    resumeGame('gameover');
}

function skipContinue() {
    if (practice) {                       // a replay just ends: back to the map, the saved run is untouched
        resumeGame('gameover');
        isGameOver = false;
        openSectorMap(selectedDifficulty, practice.sector);
        return;
    }
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

attachButtonAction('next-level-btn', async () => {
    if (Ads.busy) return;
    await Ads.maybeInterstitial('next-sector');      // every few clears; never after a fail
    if (practice) { openSectorMap(selectedDifficulty, level + 1); return; }
    level++;
    beginSector();
});

// Back to the title screen from anywhere in a run (Main menu buttons, Android Back).
// The run is saved at the start of every sector, so nothing is lost; a replay just ends.
function goToTitle() {
    Ads.hideBanner();
    ['esc-pause', 'gameover', 'respawn'].forEach(r => resumeGame(r));
    isGameOver = false;
    if (document.fullscreenElement && document.exitFullscreen) {
        try { document.exitFullscreen().catch(() => {}); } catch (e) {}
    }
    document.getElementById('ui').style.display = 'none';
    document.getElementById('mobile-controls').style.display = 'none';
    practice = null;
    showOnly('start-menu');
    isPlaying = false;
    timerRunning = false;
    keys.w = keys.a = keys.s = keys.d = keys.space = false;
    level = 1;
    refreshStartMenu();
}

attachButtonAction('exit-btn', goToTitle);

function togglePauseMenu() {
    if (!isPlaying || isGameOver) return;
    const modal = document.getElementById('pause-modal');
    if (!modal) return;
    if (Pause.reasons.has('esc-pause')) {
        resumeGame('esc-pause');
        modal.style.display = 'none';
        Ads.hideBanner();
        releaseDialog();
    } else {
        pauseGame('esc-pause');
        lockInput();
        modal.style.display = 'flex';
        Ads.showBanner('pause');
        focusDialog(modal);
    }
}

attachButtonAction('pause-btn', togglePauseMenu);
attachButtonAction('resume-btn', () => {
    const modal = document.getElementById('pause-modal');
    if (modal) modal.style.display = 'none';
    Ads.hideBanner();
    releaseDialog();
    resumeGame('esc-pause');
});

attachButtonAction('pause-exit-btn', goToTitle);   // no ad here: rewarded ads are only ever the player's choice
attachButtonAction('restart-menu-btn', goToTitle);

attachButtonAction('continue-ad-btn', continueWithAd);
attachButtonAction('continue-data-btn', continueWithData);
attachButtonAction('skip-continue-btn', skipContinue);
attachButtonAction('restart-btn', restartFromSectorOne);

refreshStartMenu();
renderLives();
