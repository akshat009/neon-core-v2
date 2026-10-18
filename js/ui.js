// =========================================================
// Neon Core — HUD, menus, buttons, fullscreen
// =========================================================

// --- Difficulty picker ---
function setDifficulty(diff) {
    selectedDifficulty = diff;
    document.querySelectorAll('.diff-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`diff-${diff.toLowerCase()}`).classList.add('active');
    level = 1;
}

document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => setDifficulty(btn.dataset.diff));
});

// --- HUD ---
function updateUI() {
    document.getElementById('score-txt').innerText = `DATA: ${ringsCollected} / ${targetRings}`;
    document.getElementById('level-num').innerText = level;
    document.getElementById('diff-ui-txt').innerText = `[${selectedDifficulty.substring(0,3)}]`;
}

// --- Fullscreen (without locking orientation) ---
function enterFullscreen() {
    let docElm = document.documentElement;
    try {
        if (docElm.requestFullscreen) {
            docElm.requestFullscreen().catch(err => {});
        } else if (docElm.webkitRequestFullscreen) {
            docElm.webkitRequestFullscreen();
        }
    } catch(e) {}
}

// --- Menu buttons (click + touch) ---
function attachButtonAction(id, action) {
    const btn = document.getElementById(id);
    btn.addEventListener('click', action);
    btn.addEventListener('touchstart', (e) => { e.stopPropagation(); e.preventDefault(); action(); }, {passive: false});
}

attachButtonAction('start-btn', () => {
    enterFullscreen();
    initAudio();
    document.getElementById('start-menu').style.display = 'none';
    document.getElementById('ui').style.display = 'block';
    if ('ontouchstart' in window) {
        document.getElementById('mobile-controls').style.display = 'flex';
    }
    generateLevel();
});

attachButtonAction('next-level-btn', () => {
    enterFullscreen();
    document.getElementById('level-menu').style.display = 'none';
    level++;
    generateLevel();
});

attachButtonAction('exit-btn', () => {
    if(document.exitFullscreen) document.exitFullscreen();
    document.getElementById('level-menu').style.display = 'none';
    document.getElementById('ui').style.display = 'none';
    document.getElementById('mobile-controls').style.display = 'none';
    document.getElementById('start-menu').style.display = 'flex';
    isPlaying = false; level = 1;
    keys.w = keys.a = keys.s = keys.d = keys.space = false;
});

attachButtonAction('restart-btn', () => {
    enterFullscreen();
    document.getElementById('gameover-menu').style.display = 'none';
    generateLevel();
});
