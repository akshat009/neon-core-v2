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
const pad2 = (n) => String(n).padStart(2, '0');

function updateUI() {
    document.getElementById('score-txt').innerText = `DATA: ${pad2(ringsCollected)}/${pad2(targetRings)}`;
    document.getElementById('data-fill').style.width = `${targetRings ? Math.min(ringsCollected / targetRings, 1) * 100 : 0}%`;
    document.getElementById('level-num').innerText = pad2(level);
    document.getElementById('diff-ui-txt').innerText = selectedDifficulty.substring(0,3);
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
    btn.addEventListener('touchstart', (e) => { e.stopPropagation(); if (e.cancelable) e.preventDefault(); action(); }, {passive: false});
}

// Start / Next / Exit / Restart buttons are wired in features/run.js (run flow, lives, ads).
