// =========================================================
// Neon Core features — every tunable number in one place
// =========================================================

const FEATURES = {
    dailyFreeShields: 2,             // free shields every day (resets at local midnight)
    livesPerRun: 3,                  // lives at the start of a run (Start Run → game over)
    respawnShieldSeconds: 2,         // can't be hit for this long after a respawn / continue
    shieldGraceSeconds: 1,           // can't be hit for this long after a shield blocks a hurdle
    respawnDelayMs: 700,             // show the crash for this long before respawning
    shieldOfferSeconds: 6,           // "watch ad for a shield" popup auto-skips after this
    maxAdContinuesPerRun: Infinity,  // "watch ad, +1 life" per run (Infinity = no limit)
    demoAdSeconds: 5,                // length of the demo rewarded video
    interstitialEverySectors: 3,     // a skippable interstitial after every 3rd cleared sector (never after a fail)
    interstitialMinGapSeconds: 120,  // and never sooner than this after any other ad
    reviveDataCost: 500,             // game over: spend this much Data instead of watching an ad
    shopShieldPrice: 1000,           // SHOP: +1 shield (core prices are in CORES, js/config.js)
    shopLifePrice: 1500,             // SHOP: start the next new run with one extra life (one at a time)
    coreTrayCloseMs: 3500,           // the core picker closes by itself after this long
    maxCoreCharges: 5                // track boxes store up to this many charges of each core
};
