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

    if (ringsCollected === 0) announce(`Sector ${level}, ${selectedDifficulty.toLowerCase()}. Collect ${targetRings} data.`);
    else if (ringsCollected === targetRings) announce('All data collected.');
}

// Users with "reduce motion" switched on get no camera shake, tilt or zoom kicks
// (js/effects.js, js/juice.js) and no looping CSS animations (css/style.css).
const reducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

// Screen readers: short polite messages through the hidden #sr-live region
function announce(text) {
    const live = document.getElementById('sr-live');
    if (!live) return;
    live.textContent = '';
    setTimeout(() => { live.textContent = text; }, 60);   // clearing first makes repeats read again
}

// Short message in the middle of the screen during play (e.g. the core changed form)
let hudToastTimer = 0;
function hudToast(title, sub, color) {
    const el = document.getElementById('hud-toast');
    if (!el) return;
    el.innerHTML = `<b>${title}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.style.setProperty('--toast-c', color || 'var(--neon)');
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(hudToastTimer);
    hudToastTimer = setTimeout(() => el.classList.remove('show'), 1600);
    announce(sub ? `${title}. ${sub}.` : `${title}.`);
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

// --- Dialogs (pause, results, sector map, shield offer) ---
// While one is open the game behind it can't be reached with Tab or a screen reader (inert),
// and focus moves to the dialog's title so it is read out first. Closing it drops focus back
// to the page, so Space/Enter go to the game again instead of a button that is now hidden.
function focusDialog(el) {
    document.getElementById('ui').inert = true;
    document.getElementById('mobile-controls').inert = true;
    const title = el && el.querySelector('h1[id], h2[id]');
    if (!title) return;
    title.setAttribute('tabindex', '-1');
    title.focus({ preventScroll: true });
}

function releaseDialog() {
    document.getElementById('ui').inert = false;
    document.getElementById('mobile-controls').inert = false;
    const a = document.activeElement;
    if (a && a !== document.body && a.id !== 'mute-btn') a.blur();
}

// Start / Next / Exit / Restart buttons are wired in features/run.js (run flow, lives, ads).
