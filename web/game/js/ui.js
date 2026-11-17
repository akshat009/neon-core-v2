// =========================================================
// Neon Core — HUD, menus, buttons, fullscreen
// =========================================================

// True while the title screen is up: the camera sways slowly around the core (js/game.js)
let menuAttract = true;

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
    document.getElementById('diff-ui-txt').innerText = selectedDifficulty;
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

// --- Menu buttons ---
// Buttons act on a real click (finger down AND up on the same button), not on touchstart,
// so a thumb that is still on the joystick / jump area, a scroll or a stray touch can't start
// an ad or skip a popup. Right after a screen or popup appears, input is ignored briefly.
let uiLockUntil = 0;
function lockInput(ms = 350) { uiLockUntil = Math.max(uiLockUntil, performance.now() + ms); }

function attachButtonAction(id, action) {
    const btn = document.getElementById(id);
    btn.addEventListener('click', (e) => {
        if (performance.now() < uiLockUntil) return;
        action(e);
    });
}

// Start / Next / Exit / Restart buttons are wired in features/run.js (run flow, lives, ads).
