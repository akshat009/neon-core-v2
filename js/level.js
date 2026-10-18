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
const clock = new THREE.Clock();
let gameOverTimer = null;

function generateLevel() {
    [platforms, edges, rings, spikes, movPlatforms, powerups].forEach(arr => arr.forEach(obj => scene.remove(obj)));
    platforms = []; edges = []; rings = []; spikes = []; movPlatforms = []; powerups = [];

    let cfg = diffConfig[selectedDifficulty];
    maxSpeed = cfg.speed + (level * 0.015);
    targetRings = (selectedDifficulty === 'EASY' ? 2 : 3) + level * 2;
    ringsCollected = 0;

    clearTimeout(gameOverTimer);
    pos.set(0, 5, -2); vel.set(0,0,0);
    ball.position.copy(pos);
    ball.visible = true;
    resetTrail();
    transformBall('normal');

    let currentZ = 0;
    for(let i=0; i < targetRings + 2; i++) {
        let length = Math.max(cfg.lengthBase - (level * 0.5), 8);
        let gap = (i===0) ? 0 : cfg.gapBase + Math.min(level * cfg.gapScale, 15);
        currentZ -= gap;

        // Moving platform inside a wide gap
        if(gap > 6 && Math.random() < cfg.movPlatChance + (level*0.02)) {
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

        if(i > 0 && i <= targetRings) {
            // Data pickup
            let r = createData(i * 1.3);
            r.position.set(Math.random()*8 - 4, 1.5, currentZ - length/2);
            scene.add(r); rings.push(r);

            // Mines
            if (Math.random() < cfg.spikeChance + (level*0.05)) {
                let numSpikes = Math.floor(Math.random() * (level + (selectedDifficulty==='HARD'?2:0)));
                numSpikes = Math.min(numSpikes, 6);
                for(let s=0; s<numSpikes; s++) {
                    let sp = createMine();
                    sp.position.set(Math.random()*10 - 5, 1.2, currentZ - Math.random()*length);

                    if(selectedDifficulty === 'HARD' || level > 5) {
                        if(Math.random() > 0.5) {
                            sp.userData = { moving: true, speed: 0.02 + (level*0.005), dir: 1, startX: sp.position.x - 2, endX: sp.position.x + 2 };
                        }
                    }
                    scene.add(sp); spikes.push(sp);
                }
            }

            // Power-up box
            if(Math.random() > 0.6) {
                let type = Math.random() > 0.5 ? 'big' : 'small';
                let p = createPowerup(type, i * 0.9);
                p.position.set(Math.random()*6-3, 1.5, currentZ - length/2 + 2);
                scene.add(p); powerups.push(p);
            }
        }
        currentZ -= length;
    }

    updateUI();
    levelStartTime = Date.now();
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
        document.getElementById('status-txt').innerText = "CHASSIS: HEAVY (HIGH JUMP)";
        document.getElementById('status-txt').style.color = "#ffaa00";
        playPowerup();
    } else if(type === 'small') {
        ballRadius = 0.6; jumpStrength = 0.4;
        ball.scale.set(0.6, 0.6, 0.6);
        document.getElementById('status-txt').innerText = "CHASSIS: MICRO (FAST SPEED)";
        document.getElementById('status-txt').style.color = "#00ff00";
        playPowerup();
    } else {
        ballRadius = 1; jumpStrength = 0.48;
        ball.scale.set(1, 1, 1);
        document.getElementById('status-txt').innerText = "CHASSIS: STANDARD";
        document.getElementById('status-txt').style.color = "#00ffff";
    }
}
