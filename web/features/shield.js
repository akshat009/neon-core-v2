// =========================================================
// Neon Core features — shield
//
// • 2 free shields every day (FEATURES.dailyFreeShields). Ad shields add on top.
// • Hitting a red hurdle with a shield: the shield is used automatically, the hurdle breaks,
//   the run goes on (short grace time so a cluster of hurdles can't chain-hit you).
// • Hitting a hurdle with 0 shields: the game freezes and offers "watch ad → +1 shield".
//   Skip (or let the timer run out) and you lose a life instead.
// • HUD shield button: shows the count; at 0 it shows AD — tap any time to watch an ad
//   for +1 shield (the game freezes while the ad plays).
// • Shields only protect from hurdles. Falling off the track always costs a life.
// =========================================================

const Shield = {
    get count() { return SaveData.data.shields; },

    refreshDaily() {
        const today = todayKey();
        if (SaveData.data.shieldDay === today) return;
        SaveData.data.shieldDay = today;
        SaveData.data.shields = Math.max(SaveData.data.shields, FEATURES.dailyFreeShields);
        SaveData.save();
        renderShieldUI();
    },

    add(n = 1) {
        SaveData.data.shields += n;
        SaveData.save();
        renderShieldUI();
    },

    use() {
        if (SaveData.data.shields <= 0) return false;
        SaveData.data.shields--;
        SaveData.save();
        renderShieldUI();
        if (SaveData.data.shields === 0) Ads.prepareRewarded('shield');   // HUD button now offers an ad
        return true;
    }
};

function renderShieldUI() {
    const n = Shield.count;
    document.getElementById('shield-count').textContent = n;
    document.getElementById('shield-btn').classList.toggle('empty', n <= 0);
    document.getElementById('menu-shield-count').textContent = n;
}

// ---------- Hurdle hit (called from js/game.js) ----------

function onHurdleHit(mine) {
    if (Shield.use()) { absorbHit(mine); return; }
    offerShield(mine);
}

function absorbHit(mine) {
    mine.userData.dead = true;
    shatterMine(mine, { keepBall: true });
    shieldPop();
    invulnTime = Math.max(invulnTime, FEATURES.shieldGraceSeconds);
    playSynth(900, 'triangle', 0.15, 0.08); setTimeout(() => playSynth(450, 'triangle', 0.25, 0.06), 60);
}

// ---------- "No shields left" offer ----------

let shieldOffer = null;

function offerShield(mine) {
    pauseGame('shield-offer');
    Ads.prepareRewarded('shield');
    shieldOffer = { mine: mine, left: FEATURES.shieldOfferSeconds, timer: null };
    document.getElementById('shield-offer').classList.add('show');
    startOfferCountdown();
}

function startOfferCountdown() {
    const bar = document.getElementById('shield-offer-bar');
    clearInterval(shieldOffer.timer);
    shieldOffer.timer = setInterval(() => {
        shieldOffer.left -= 0.1;
        bar.style.width = `${Math.max(shieldOffer.left / FEATURES.shieldOfferSeconds, 0) * 100}%`;
        if (shieldOffer.left <= 0) skipShieldOffer();
    }, 100);
}

function closeShieldOffer() {
    clearInterval(shieldOffer.timer);
    document.getElementById('shield-offer').classList.remove('show');
    const mine = shieldOffer.mine;
    shieldOffer = null;
    return mine;
}

async function watchShieldOfferAd() {
    if (!shieldOffer || Ads.busy) return;
    clearInterval(shieldOffer.timer);
    document.getElementById('shield-offer').classList.remove('show');
    const earned = await Ads.showRewarded('shield');
    if (!shieldOffer) return;
    if (earned) {
        const mine = closeShieldOffer();
        Shield.add(1);
        Shield.use();
        absorbHit(mine);
        resumeGame('shield-offer');
    } else {
        // Ad closed early: back to the offer with a fresh timer
        shieldOffer.left = FEATURES.shieldOfferSeconds;
        document.getElementById('shield-offer').classList.add('show');
        startOfferCountdown();
    }
}

function skipShieldOffer() {
    if (!shieldOffer) return;
    const mine = closeShieldOffer();
    loseLife('LASER COLLISION!', { mine: mine });   // freezes again for the respawn
    resumeGame('shield-offer');
}

attachButtonAction('shield-offer-watch', watchShieldOfferAd);
attachButtonAction('shield-offer-skip', skipShieldOffer);

// ---------- HUD button and start-menu button: watch an ad any time for +1 ----------

async function watchAdForShield(fromMenu) {
    if (Ads.busy) return;
    if (!fromMenu) {
        if (!isPlaying || isGameOver || Pause.paused) return;
        if (Shield.count > 0) {             // shields are automatic; just remind the player
            const btn = document.getElementById('shield-btn');
            btn.classList.remove('ping'); void btn.offsetWidth; btn.classList.add('ping');
            return;
        }
        pauseGame('shield-ad');
    }
    const earned = await Ads.showRewarded('shield');
    if (earned) { Shield.add(1); playPowerup(); }
    if (!fromMenu) resumeGame('shield-ad');
}

attachButtonAction('shield-btn', () => watchAdForShield(false));
attachButtonAction('menu-shield-ad', () => watchAdForShield(true));

// ---------- Shield bubble flash ----------

const shieldBubble = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0x4aa8ff, wireframe: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
);
shieldBubble.visible = false;
scene.add(shieldBubble);

function shieldPop() {
    const start = performance.now();
    shieldBubble.visible = true;
    burst(ball.position, 0x4aa8ff, 26, 0.24, 0.14, 0.6, { shape: 1 });
    (function step() {
        const k = (performance.now() - start) / 450;
        if (k >= 1) { shieldBubble.visible = false; return; }
        shieldBubble.position.copy(ball.position);
        shieldBubble.scale.setScalar(ballRadius * (1.25 + k * 0.9));
        shieldBubble.rotation.y = k * 1.5;
        shieldBubble.material.opacity = 1 - k;
        requestAnimationFrame(step);
    })();
}

Shield.refreshDaily();
renderShieldUI();
