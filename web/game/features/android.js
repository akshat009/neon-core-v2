// =========================================================
// Neon Core features — Android Back button / back gesture (@capacitor/app)
//
// Only inside the Android app. With a backButton listener registered, Capacitor no
// longer closes the app on its own, so every case is handled here. Pressing Back
// again and again always ends up on the title screen, and from there closes the app:
//   • an ad loading or on screen → nothing (it closes on its own; every ad step has a
//     time limit in features/ads/*, so this can't lock Back for long)
//   • How to play / Controls sheet open → close it
//   • "No shields left" popup → skip it (same as SKIP)
//   • playing → pause;  pause menu → main menu
//   • sector cleared / run reset / sector map → main menu
//   • game over → END RUN (same as the button: shows Run Reset, or the map in a replay)
//   • title screen → "Press Back again to exit", a second Back within 2s closes the app
//
// A real AdMob ad is its own Android screen and takes the Back press itself. While an ad is
// still loading ("Loading ad…") Back does nothing, so it can't open the pause menu under a
// pending ad (e.g. the shield offer, which hides itself before the ad starts).
// =========================================================

// Outside links (Privacy Policy): in the app a plain link is opened in the phone's browser by
// Capacitor; target="_blank" would try to open a window inside the WebView instead.
if (isNativeApp()) document.querySelectorAll('a[data-external]').forEach(a => a.removeAttribute('target'));

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

    let exitArmedUntil = 0;

    function exitApp() {
        App.exitApp().catch(() => {});
        // exitApp should close the app; if it doesn't, let Android move it to the background
        setTimeout(() => { App.minimizeApp && App.minimizeApp().catch(() => {}); }, 400);
    }

    function onBack() {
        if (document.getElementById('demo-ad').classList.contains('show')) return;
        if (Ads.busy) return;

        if (document.querySelector('.t-sheet.open')) { closeSheets(); return; }
        if (document.getElementById('shield-offer').classList.contains('show')) { skipShieldOffer(); return; }
        if (shown('pause-modal')) { goToTitle(); return; }
        if (shown('gameover-menu')) { skipContinue(); return; }
        if (shown('level-menu') || shown('restart-menu')) { goToTitle(); return; }
        if (shown('map-menu')) { showOnly('start-menu'); refreshStartMenu(); return; }
        if (isPlaying && !isGameOver) { togglePauseMenu(); return; }

        // Title screen (or anything else): two presses to close the app
        if (performance.now() < exitArmedUntil) { exitApp(); return; }
        exitArmedUntil = performance.now() + 2000;
        showAdToast('Press Back again to exit', 2000);
    }

    App.addListener('backButton', onBack).catch(() => {});
})();
