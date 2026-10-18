// =========================================================
// Neon Core — difficulty settings and saved score
// =========================================================

// Total score is kept in localStorage between sessions.
let totalScore = 0;
try { totalScore = parseInt(localStorage.getItem('neonCoreScore')) || 0; } catch(e) {}
function saveScore(score) { try { localStorage.setItem('neonCoreScore', score); } catch(e) {} }

let selectedDifficulty = 'MEDIUM';

const diffConfig = {
    'EASY':   { speed: 0.20, jump: 0.45, gapBase: 0, gapScale: 0.5, spikeChance: 0.2, movPlatChance: 0.2, timePar: 3.5, lengthBase: 18 },
    'MEDIUM': { speed: 0.28, jump: 0.45, gapBase: 3, gapScale: 1.0, spikeChance: 0.5, movPlatChance: 0.4, timePar: 2.5, lengthBase: 15 },
    'HARD':   { speed: 0.35, jump: 0.45, gapBase: 6, gapScale: 1.5, spikeChance: 0.8, movPlatChance: 0.7, timePar: 1.8, lengthBase: 12 }
};

// Star rating: on touch screens (joystick) the par times are this much longer,
// because steering with a joystick is slower than with a keyboard.
const TOUCH_PAR_SCALE = 1.35;
