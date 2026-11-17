// =========================================================
// Neon Core — difficulty settings and saved score
// =========================================================

// Total score is kept in localStorage between sessions.
let totalScore = 0;
try { totalScore = parseInt(localStorage.getItem('neonCoreScore')) || 0; } catch(e) {}
function saveScore(score) { try { localStorage.setItem('neonCoreScore', score); } catch(e) {} }

let selectedDifficulty = 'MEDIUM';

// Track layout per difficulty (js/level.js → trackPlan):
//   gapBias   0..1, how far towards the longest safe gap the gaps lean (grows a little per sector)
//   lenMin/Max  platform length range; short ones are stepping stones, long ones runways
//   stoneChance chance that a platform is a short stepping stone
//   airRingChance chance that a gap gets a data ring floating in the air over it
const diffConfig = {
    'EASY':   { speed: 0.20, jump: 0.45, gapBias: 0.10, lenMin: 11, lenMax: 22, stoneChance: 0.10, airRingChance: 0.25, spikeChance: 0.2, movPlatChance: 0.2, timePar: 3.5 },
    'MEDIUM': { speed: 0.28, jump: 0.45, gapBias: 0.30, lenMin: 8,  lenMax: 20, stoneChance: 0.22, airRingChance: 0.35, spikeChance: 0.5, movPlatChance: 0.4, timePar: 2.5 },
    'HARD':   { speed: 0.35, jump: 0.45, gapBias: 0.50, lenMin: 6,  lenMax: 18, stoneChance: 0.35, airRingChance: 0.45, spikeChance: 0.8, movPlatChance: 0.7, timePar: 1.8 }
};

// Star rating: on touch screens (joystick) the par times are this much longer,
// because steering with a joystick is slower than with a keyboard.
const TOUCH_PAR_SCALE = 1.35;
