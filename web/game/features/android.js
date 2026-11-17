// =========================================================
// Neon Core features — Android Back button / back gesture (@capacitor/app)
//
// Only inside the Android app. With a backButton listener registered, Capacitor no
// longer closes the app on its own, so every case is handled here:
//   • an ad is showing, or a popup asks for a choice → nothing (no accidental skips)
//   • How to play / Controls sheet open → close it
//   • playing → pause;  pause menu open → resume
//   • sector map → back to the title screen
//   • sector cleared / game over / run reset → nothing (pick a button on the screen)
//   • title screen → close the app
// =========================================================

(function setupAndroidBack() {
    if (!isNativeApp()) return;
    const register = (window.capacitorExports && window.capacitorExports.registerPlugin)
        || (window.Capacitor && window.Capacitor.registerPlugin);
    if (!register) return;
    const App = register('App');

    const shown = (id) => {
        const el = document.getElementById(id);
        return !!el && el.style.display !== 'none' && getComputedStyle(el).display !== 'none';
    };

    function onBack() {
        if (Ads.busy || document.getElementById('demo-ad').classList.contains('show')) return;
        if (document.getElementById('shield-offer').classList.contains('show')) return;
        if (document.querySelector('.t-sheet.open')) { closeSheets(); return; }
        if (shown('pause-modal')) { togglePauseMenu(); return; }
        if (isPlaying && !isGameOver) { togglePauseMenu(); return; }
        if (shown('map-menu')) { showOnly('start-menu'); refreshStartMenu(); return; }
        if (shown('level-menu') || shown('gameover-menu') || shown('restart-menu')) return;
        if (shown('start-menu')) App.exitApp();
    }

    App.addListener('backButton', onBack).catch(() => {});
})();
