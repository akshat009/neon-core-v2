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

// ---------- Cores: the ball forms the player can switch between during a run ----------
// Every core has one strength and one weakness, so none is best everywhere. Bought in the
// SHOP with Data (features/shop.js), switched with the core button (features/cores.js).
//   speed / steer  top speed and how fast the ball reacts to the stick (× Standard)
//   jump           take-off speed (Standard 0.48: about 48 frames in the air)
//   radius         ball size: bigger catches rings from further but hits gates sooner
//   magnet         extra distance at which data rings fly to the ball
//   phase          seconds of passing through hazard gates right after switching to it
//   cooldown       seconds before the player can switch again after picking this core
//   short          label under the orb in the in-run picker (narrow)
// Gaps are built so Standard clears them all (js/level.js gapLimits); the slower cores
// still reach well past the longest gap (checked with tools/cores-gaps simulation).
const CORES = {
    normal:  { name: 'STANDARD', short: 'STD', price: 0,     glow: 0x29f3ff, light: 0x00ffff, speed: 1.0, steer: 1.0, jump: 0.48, radius: 1.0, magnet: 2.6, phase: 0,   cooldown: 5,
               perk: 'Balanced all-rounder',                  flaw: 'No special power' },
    magnet:  { name: 'MAGNET',   short: 'MAGNET',   price: 2500,  glow: 0xff4fd8, light: 0xff40d0, speed: 0.9, steer: 1.0, jump: 0.48, radius: 1.0, magnet: 9,   phase: 0,   cooldown: 5,
               perk: 'Pulls data rings from far away',        flaw: '10% slower' },
    jet:     { name: 'JET',      short: 'JET',      price: 4000,  glow: 0x45ff6a, light: 0x00ff40, speed: 1.3, steer: 0.6, jump: 0.44, radius: 0.6, magnet: 2.6, phase: 0,   cooldown: 5,
               perk: '30% faster, longest jumps',             flaw: 'Loose steering, lower jump' },
    titan:   { name: 'TITAN',    short: 'TITAN',    price: 4000,  glow: 0xffa12e, light: 0xffaa00, speed: 0.9, steer: 0.85, jump: 0.56, radius: 1.4, magnet: 3.2, phase: 0,  cooldown: 5,
               perk: 'Highest jump, big body grabs rings',    flaw: 'Slower, hits gates sooner' },
    phantom: { name: 'PHANTOM',  short: 'PHANTOM',  price: 8000,  glow: 0xb98cff, light: 0x9a6bff, speed: 1.0, steer: 1.0, jump: 0.48, radius: 1.0, magnet: 2.6, phase: 1.5, cooldown: 12,
               perk: 'Passes through gates for 1.5s',         flaw: '12s before you can switch again' }
};
const CORE_ORDER = ['normal', 'magnet', 'jet', 'titan', 'phantom'];
