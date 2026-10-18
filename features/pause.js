// =========================================================
// Neon Core features — time freeze
//
// Anything can freeze the game by name (an ad, a popup, a respawn, the app going to the
// background). The game runs again only when every reason is released. While frozen:
// no physics, no collisions, and the sector timer does not count.
// =========================================================

const Pause = {
    reasons: new Set(),
    since: 0,
    get paused() { return this.reasons.size > 0; }
};

function pauseGame(reason) {
    if (Pause.reasons.has(reason)) return;
    if (!Pause.paused) {
        Pause.since = Date.now();
        keys.w = keys.a = keys.s = keys.d = keys.space = false;
        releaseJoystick();
    }
    Pause.reasons.add(reason);
}

function resumeGame(reason) {
    if (!Pause.reasons.delete(reason)) return;
    if (!Pause.paused) {
        levelStartTime += Date.now() - Pause.since;   // the frozen time never reaches the timer
        clock.getDelta();                              // drop the long frame
    }
}

// Freeze when the app/tab goes to the background (phone call, home button, tab switch)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseGame('background');
    else resumeGame('background');
});
