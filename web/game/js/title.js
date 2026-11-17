// =========================================================
// Neon Core — title screen
//
// • Builds a preview sector behind the title screen, so the menu sits on top of
//   the live 3D track (the camera sway lives in js/game.js, see menuAttract).
// • Opens / closes the "How to play" and "Controls" sheets.
// =========================================================

// Where the camera aims on the title screen. Portrait screens aim a little lower,
// which lifts the core above the menu panel at the bottom.
// Wide screens aim left of the core, so it sits to the right of the menu.
let ATTRACT_LOOK_Y = 0, ATTRACT_LOOK_X = 0;
function updateAttractFraming() {
    const w = window.innerWidth, h = window.innerHeight;
    ATTRACT_LOOK_Y = w < h ? -2.2 : 0.6;
    ATTRACT_LOOK_X = (w >= 900 && h >= 560) ? -3.2 : (w > h ? 1.6 : 0);
}
updateAttractFraming();
window.addEventListener('resize', updateAttractFraming);

// A sector for the title screen to show. Nothing moves or scores while isPlaying is false.
function buildMenuPreview() {
    generateLevel();
    isPlaying = false;
    timerRunning = false;
    pos.set(0, 1.5, -6);
    vel.set(0, 0, 0);
    ball.position.copy(pos);
}

// Rebuild the preview whenever the player comes back to the title screen,
// and hide the HUD and touch controls behind the end-of-sector screens.
const RESULT_MENUS = ['level-menu', 'gameover-menu', 'restart-menu'];
const _showOnlyForTitle = showOnly;
showOnly = function (id) {
    const wasOnTitle = menuAttract;
    _showOnlyForTitle(id);
    document.body.classList.toggle('menu-open', RESULT_MENUS.includes(id));
    if (id === 'start-menu' && !wasOnTitle) buildMenuPreview();
};

// ---------- Sheets (How to play, Controls) ----------

function openSheet(id) {
    const sheet = document.getElementById(id);
    sheet.classList.add('open');
    const closeBtn = sheet.querySelector('[data-close]');
    if (closeBtn) closeBtn.focus({ preventScroll: true });
}

function closeSheets() {
    document.querySelectorAll('.t-sheet.open').forEach(s => s.classList.remove('open'));
}

attachButtonAction('howto-btn', () => openSheet('howto-sheet'));
attachButtonAction('settings-btn', () => openSheet('settings-sheet'));

document.querySelectorAll('.t-sheet').forEach(sheet => {
    sheet.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', closeSheets));
    // Tap outside the card closes it
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheets(); });
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.querySelector('.t-sheet.open')) {
        e.stopPropagation();
        closeSheets();
    }
}, true);

buildMenuPreview();
