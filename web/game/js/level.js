// =========================================================
// Neon Core — game state, level generation, ball power-ups
// =========================================================

// --- Ball state ---
let ballRadius = 1;
let ballState = 'normal';

// --- Level objects ---
let platforms = [], edges = [], rings = [], spikes = [], movPlatforms = [], powerups = [];

// --- Run state ---
let level = 1, ringsCollected = 0, targetRings = 5;
let isGameOver = false, isPlaying = false;
let pos = new THREE.Vector3(0, 5, -2), vel = new THREE.Vector3(0, 0, 0);
let onGround = true, isOnMovingPlat = false, currentPlatVel = new THREE.Vector3(0,0,0);
let gravity = 0.02, jumpStrength = 0.45, maxSpeed = 0.3;

let levelStartTime = 0;
let currentTimeStr = "0.0";
let timerRunning = false;   // the sector timer starts on the first move, not at spawn
const clock = new THREE.Clock();

// ---------- Seeded layouts: the same difficulty + sector always builds the same track ----------
// so replays from the sector map are fair and best times can be compared.
let rand = Math.random;
function seedSector(diff, sector) {
    let h = 2166136261;                                   // FNV-1a hash of "DIFF-sector"
    for (const ch of `${diff}-${sector}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    let a = h >>> 0;
    rand = function () {                                  // mulberry32
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ---------- Track plan: gaps and platform lengths ----------
// Every gap must need a jump, and every gap must be clearable with one:
//   • Rolling off an edge, the ball (centre at y 1.5) still lands if it reaches the next platform
//     before dropping below y 0.2: 1.3 = 0.5 · 0.02 · t² → t ≈ 11.4 frames. At the fastest speed
//     (micro core, ×1.4) that distance plus a margin is the shortest gap.
//   • A normal jump (0.48 up, gravity 0.02) stays up 48 frames; the heavy core (0.55, ×0.85 speed)
//     covers about the same. The longest gap is 65% of that reach, so a jump started a little
//     late still makes it.
const GRAVITY = 0.02;
function gapLimits(speed) {
    const fastest = speed * 1.4;
    const minGap = fastest * 11.4 * 1.25 + 0.6;
    const reach = (2 * 0.48 / GRAVITY) * speed;
    const maxGap = Math.max(minGap + 1.5, reach * 0.65);
    return { minGap, maxGap };
}

function trackPlan(cfg, segments) {
    const { minGap, maxGap } = gapLimits(maxSpeed);
    const bias = Math.min(cfg.gapBias + level * 0.05, 0.9);
    const shrink = Math.min(level * 0.4, 4);                 // platforms get a bit shorter each sector
    const lenMin = Math.max(cfg.lenMin - shrink, 5);
    const lenMax = Math.max(cfg.lenMax - shrink, lenMin + 6);
    const plan = [];
    let lastGap = -1;
    for (let i = 0; i < segments; i++) {
        let length;
        if (i === 0) length = lenMax + 4;                                        // runway to land on
        else if (rand() < cfg.stoneChance) length = 4.5 + rand() * 2.5;   // stepping stone
        else length = lenMin + rand() * (lenMax - lenMin);

        let gap = 0;
        if (i > 0) {
            // Lean towards the long end with the bias, with plenty of spread either way,
            // and never repeat almost the same gap twice in a row
            let t = Math.min(Math.max(bias + (rand() - 0.5) * 0.9, 0), 1);
            gap = minGap + (maxGap - minGap) * t;
            if (lastGap >= 0 && Math.abs(gap - lastGap) < 1) gap = gap > (minGap + maxGap) / 2 ? gap - 1.6 : gap + 1.6;
            gap = Math.min(Math.max(gap, minGap), maxGap);
            lastGap = gap;
        }
        plan.push({ length, gap });
    }
    return plan;
}

function generateLevel() {
    [platforms, edges, rings, spikes, movPlatforms, powerups].forEach(arr => arr.forEach(obj => scene.remove(obj)));
    platforms = []; edges = []; rings = []; spikes = []; movPlatforms = []; powerups = [];

    let cfg = diffConfig[selectedDifficulty];
    seedSector(selectedDifficulty, level);
    maxSpeed = cfg.speed + (level * 0.015);
    targetRings = (selectedDifficulty === 'EASY' ? 2 : 3) + level * 2;
    ringsCollected = 0;

    pos.set(0, 5, -2); vel.set(0,0,0);
    ball.position.copy(pos);
    ball.visible = true;
    resetTrail();
    transformBall('normal');

    let currentZ = 0;
    const plan = trackPlan(cfg, targetRings + 2);
    let ringsPlaced = 0;
    for(let i=0; i < plan.length; i++) {
        const length = plan[i].length;
        const gap = plan[i].gap;
        currentZ -= gap;

        // Some gaps carry a data ring in the air: only a jump through it collects it
        const airRing = i > 1 && gap > 0 && ringsPlaced < targetRings && rand() < cfg.airRingChance;
        if (airRing) {
            const r = createData(i * 0.7);
            r.position.set(rand() * 6 - 3, 3.4, currentZ + gap / 2);
            scene.add(r); rings.push(r); ringsPlaced++;
        }

        // Moving platform inside a wide gap
        if(gap > 6 && rand() < cfg.movPlatChance + (level*0.02)) {
            let mPlat = createMovingPlatform();
            mPlat.position.set(0, 0, currentZ + gap/2);
            mPlat.userData = { startX: -4, endX: 4, speed: 0.05 + (maxSpeed*0.1), dir: 1 };
            scene.add(mPlat); movPlatforms.push(mPlat);
        }

        // Main platform (grid surface + neon rails) + edge outline
        let plat = createPlatform(length);
        plat.position.set(0, 0, currentZ - length/2);
        scene.add(plat); platforms.push(plat);

        let dynEdgeGeo = new THREE.EdgesGeometry(plat.geometry);
        let pEdge = new THREE.LineSegments(dynEdgeGeo, edgeMat);
        pEdge.position.copy(plat.position);
        scene.add(pEdge); edges.push(pEdge);

        if(i > 0) {
            // Data pickup on the platform (until the sector has all of its rings)
            if (ringsPlaced < targetRings) {
                let r = createData(i * 1.3);
                r.position.set(rand()*8 - 4, 1.5, currentZ - length/2);
                scene.add(r); rings.push(r); ringsPlaced++;
            }

            // Hazard gates: only on platforms long enough to land, react and dodge,
            // and never right at either end (where you take off or land)
            if (length >= 9 && rand() < cfg.spikeChance + (level*0.05)) {
                let numSpikes = Math.floor(rand() * (level + (selectedDifficulty==='HARD'?2:0)));
                numSpikes = Math.min(numSpikes, 6);
                for(let s=0; s<numSpikes; s++) {
                    let sp = createMine();
                    sp.position.set(rand()*10 - 5, 1.2, currentZ - 3 - rand() * (length - 6));

                    if(selectedDifficulty === 'HARD' || level > 5) {
                        if(rand() > 0.5) {
                            sp.userData = { moving: true, speed: 0.02 + (level*0.005), dir: 1, startX: sp.position.x - 2, endX: sp.position.x + 2 };
                        }
                    }
                    scene.add(sp); spikes.push(sp);
                }
            }

            // Power-up box
            if(rand() > 0.6) {
                let type = rand() > 0.5 ? 'big' : 'small';
                let p = createPowerup(type, i * 0.9);
                p.position.set(rand()*6-3, 1.5, currentZ - length/2 + 2);
                scene.add(p); powerups.push(p);
            }
        }
        currentZ -= length;
    }

    // Never fewer rings than the sector asks for (air rings can leave the last platforms short)
    for (let k = platforms.length - 1; ringsPlaced < targetRings && k > 0; k--) {
        const p = platforms[k];
        const r = createData(k * 1.9);
        r.position.set(rand()*8 - 4, 1.5, p.position.z + 2);
        scene.add(r); rings.push(r); ringsPlaced++;
    }
    targetRings = rings.length;

    updateUI();
    levelStartTime = Date.now();
    timerRunning = false;
    currentTimeStr = "0.0";
    document.getElementById('timer-txt').innerText = 'TIME: 0.0s';
    isGameOver = false;
    isPlaying = true;
    keys.w = keys.a = keys.s = keys.d = keys.space = false;
    clock.start();
}

function transformBall(type) {
    ballState = type;
    setBallLook(type);
    if(type === 'big') {
        ballRadius = 1.4; jumpStrength = 0.55;
        ball.scale.set(1.4, 1.4, 1.4);
        document.getElementById('status-txt').innerText = "CORE: HEAVY · HIGH JUMP";
        document.getElementById('status-txt').style.color = "#ffaa00";
        hudToast('HEAVY CORE', 'HIGH JUMP', '#ffaa00');
        playPowerup();
    } else if(type === 'small') {
        ballRadius = 0.6; jumpStrength = 0.4;
        ball.scale.set(0.6, 0.6, 0.6);
        document.getElementById('status-txt').innerText = "CORE: MICRO · FAST SPEED";
        document.getElementById('status-txt').style.color = "#00ff00";
        hudToast('MICRO CORE', 'FAST SPEED', '#4dff88');
        playPowerup();
    } else {
        ballRadius = 1; jumpStrength = 0.48;
        ball.scale.set(1, 1, 1);
        document.getElementById('status-txt').innerText = "CORE: STANDARD";
        document.getElementById('status-txt').style.color = "#00ffff";
    }
}
