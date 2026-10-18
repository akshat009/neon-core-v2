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
    demoAdSeconds: 5                 // length of the demo rewarded video
};
