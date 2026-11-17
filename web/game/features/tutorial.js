// =========================================================
// Neon Core features — first-run tutorial: one tip at a time, taught while playing
//
//   move   roll forward (stick up / W)                 done after a few metres
//   jump   the first gap: slow motion + "TAP JUMP"     done on landing across it
//   data   grab the rings                              done on the first ring
//   gate   the first red gate ahead                    done once it's behind you
//   core   switch cores (once you own 2+)              done on the first switch
//
// Each tip shows once ever (SaveData.data.tips). Until the jump is learned, falling
// doesn't cost a life. Settings → "Show the tutorial tips again" resets them.
// =========================================================

const TIP_TEXT = {
    move: IS_TOUCH ? ['PUSH THE STICK UP', 'to roll forward · left and right to steer']
                   : ['HOLD  W  OR  ↑', 'to roll forward · A / D to steer'],
    jump: IS_TOUCH ? ['TAP JUMP!', 'clear the gap before the edge']
                   : ['PRESS SPACE!', 'jump the gap before the edge'],
    data: ['GRAB THE DATA RINGS', 'collect them all to clear the sector'],
    gate: IS_TOUCH ? ['RED GATE AHEAD', 'tap JUMP to hop over it'] : ['RED GATE AHEAD', 'press SPACE to hop over it'],
    core: IS_TOUCH ? ['SWITCH CORES', 'tap the core button, pick one that fits the track']
                   : ['SWITCH CORES', 'press 1–5 or click the core button']
};
const TIP_TARGET = { move: 'joystick', jump: 'btn-jump', gate: 'btn-jump', core: 'core-btn' };

const Tutorial = {
    tip: null,             // tip on screen
    jumpFrom: null,        // platform the jump tip started on
    shownAt: 0,

    seen(id) { return !!SaveData.data.tips[id]; },

    show(id) {
        if (this.tip === id) return;
        this.hide();
        this.tip = id;
        this.shownAt = performance.now();
        const [title, sub] = TIP_TEXT[id];
        const el = document.getElementById('tut-tip');
        el.innerHTML = `<b>${title}</b><span>${sub}</span>`;
        el.classList.add('show');
        const target = IS_TOUCH || id === 'core' ? document.getElementById(TIP_TARGET[id] || '') : null;
        if (target) target.classList.add('tut-focus');
        announce(`${title}. ${sub}.`);
    },

    hide() {
        document.getElementById('tut-tip').classList.remove('show');
        document.querySelectorAll('.tut-focus').forEach(e => e.classList.remove('tut-focus'));
        this.tip = null;
        timeWarp = 1;
    },

    done(id, cheer) {
        SaveData.data.tips[id] = 1;
        SaveData.save();
        if (this.tip === id) this.hide();
        if (cheer) hudToast(cheer, '', '#4dff88');
    }
};

// Players who already got past Sector 1 before tips existed don't need the basics
if (SaveData.data.bestSector > 1 && !Object.keys(SaveData.data.tips).length) {
    SaveData.data.tips = { move: 1, jump: 1, data: 1 };
    SaveData.save();
}

function tutorialForgivesFall() {
    if (Tutorial.seen('jump')) return false;
    hudToast('NO LIFE LOST', 'YOU ARE STILL LEARNING', '#29f3ff');
    return true;
}

function tutorialEvent(evt) {
    if (evt === 'switch' && !Tutorial.seen('core')) Tutorial.done('core');
}

// The platform the ball is over, and the next one
function platformAt(z) {
    return platforms.find(p => z <= p.position.z + p.geometry.parameters.depth / 2 && z >= p.position.z - p.geometry.parameters.depth / 2) || null;
}

// Every frame while playing (js/game.js animate)
function updateTutorial() {
    if (!isPlaying || isGameOver || Pause.paused || !ball.visible) { if (Tutorial.tip && Pause.paused) timeWarp = 1; return; }
    const T = Tutorial;

    // 1. Roll
    if (!T.seen('move')) {
        T.show('move');
        if (pos.z < -7) T.done('move');
        return;
    }

    // 2. First gap: slow motion until the player jumps, done when they land across
    if (!T.seen('jump')) {
        const plat = platformAt(pos.z);
        if (T.tip !== 'jump') {
            if (!plat || !onGround) return;
            const farEnd = plat.position.z - plat.geometry.parameters.depth / 2;
            const isLast = platforms.every(p => p.position.z >= plat.position.z);
            if (!isLast && pos.z - farEnd < 7) { T.show('jump'); T.jumpFrom = plat; T.jumpEdge = farEnd; T.jumped = false; }
            return;
        }
        if (keys.space) T.jumped = true;                                         // they pressed jump
        if (!onGround) { timeWarp = 1; return; }                                // in the air: normal speed
        // Learned once they jumped and landed past the edge (rolling off doesn't count)
        if (T.jumped && plat && plat !== T.jumpFrom && pos.z < T.jumpEdge) { T.done('jump', 'NICE JUMP!'); return; }
        if (plat === T.jumpFrom) T.jumped = false;                               // back on the first one (respawn)
        timeWarp = 0.3;                                                          // waiting for the jump
        return;
    }

    // 3. Data rings
    if (!T.seen('data')) {
        if (ringsCollected > 0) { T.done('data'); return; }
        T.show('data');
        return;
    }
    if (T.tip === 'data') T.hide();

    // 4. First red gate ahead
    if (!T.seen('gate')) {
        const gate = spikes.find(s => !s.userData.dead && s.position.z < pos.z && pos.z - s.position.z < 16);
        if (gate && T.tip !== 'gate') { T.show('gate'); T.gateZ = gate.position.z; }
        if (T.tip === 'gate' && pos.z < T.gateZ - 2) T.done('gate', 'CLEAN!');
        if (T.tip === 'gate') return;
    }

    // 5. Core switching, once there is something to switch to
    if (!T.seen('core') && !T.coreSnoozed && !document.getElementById('core-switch').hidden && Cores.cooldown <= 0) {
        if (T.tip !== 'core') T.show('core');
        if (performance.now() - T.shownAt > 7000) { T.hide(); T.coreSnoozed = true; }   // again next sector
    }
}

// A new sector clears whatever tip was on screen
const _generateLevelForTips = generateLevel;
generateLevel = function () { Tutorial.hide(); Tutorial.coreSnoozed = false; _generateLevelForTips(); };

attachButtonAction('replay-tutorial', () => {
    SaveData.data.tips = {};
    SaveData.save();
    showAdToast('Tutorial tips will show again in your next run.', 2400);
});
