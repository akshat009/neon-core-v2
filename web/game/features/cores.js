// =========================================================
// Neon Core features — cores (ball forms) and the in-run core switcher
//
// • Cores are bought in the SHOP with Data (features/shop.js). Standard is always owned.
//   Stats, prices and texts: CORES in js/config.js.
// • During a run the player switches with the core button (touch) or keys 1–5 / Q (keyboard),
//   e.g. Magnet when data sits somewhere awkward, Jet before a long gap.
// • After a switch there is a cooldown (5s, Phantom 12s), so the player has to plan ahead
//   instead of swapping for every single obstacle.
// • Phantom: for 1.5s after switching to it the ball passes through hazard gates.
// • The orange / green track boxes are stored as charges of Titan / Jet (saved, up to
//   FEATURES.maxCoreCharges each). Picking a charged core in the picker uses one charge; it
//   stays until the player switches to another core. If the player already owns that core,
//   the box refills the switch recharge instead.
// • A sector starts with the core the player last switched to.
// =========================================================

const Cores = {
    cooldown: 0,          // seconds until the player can switch again
    cooldownMax: 0,
    phase: 0,             // Phantom: seconds left of passing through gates
    borrowed: null,       // core in use from a stored charge (not owned), until switching away

    owns(id) { return id === 'normal' || SaveData.data.cores.includes(id); },

    get equipped() {
        const e = SaveData.data.equippedCore;
        return this.owns(e) ? e : 'normal';
    },

    charges(id) { return SaveData.data.charges[id] || 0; },

    // Cores the player can switch to right now, in CORE_ORDER: owned ones, the ones with stored
    // charges from track boxes, and the borrowed one in use
    available() {
        return CORE_ORDER.filter(id => this.owns(id) || this.charges(id) > 0 || id === this.borrowed);
    },

    // Called from generateLevel() (js/level.js) at the start of every sector
    sectorStartCore() {
        this.cooldown = 0;
        this.phase = 0;
        this.borrowed = null;
        closeCoreTray();
        renderCoreHud();
        return this.equipped;
    }
};

const hexColor = (n) => '#' + n.toString(16).padStart(6, '0');

// ---------- Switching ----------

function switchCore(id) {
    if (!isPlaying || isGameOver || Pause.paused) return false;
    if (!CORES[id] || !Cores.available().includes(id)) return false;
    if (id === ballState) { closeCoreTray(); return false; }
    if (Cores.cooldown > 0) { nudgeCoreButton(); return false; }

    const core = CORES[id];
    if (!Cores.owns(id)) {                                        // not bought: uses one stored charge
        SaveData.data.charges[id] = Cores.charges(id) - 1;
        SaveData.save();
        Cores.borrowed = id;
    } else {
        Cores.borrowed = null;                                    // the borrowed core ends when you switch away
    }
    transformBall(id);
    Cores.cooldown = Cores.cooldownMax = core.cooldown;
    Cores.phase = core.phase;
    if (Cores.owns(id) && SaveData.data.equippedCore !== id) {
        SaveData.data.equippedCore = id;
        SaveData.save();
    }
    flashRing(pos, core.glow, 1.3);
    playSwitch();
    haptic('medium');
    hudToast(`${core.name} CORE`, core.perk.toUpperCase(), hexColor(core.glow));
    closeCoreTray();
    renderCoreHud();
    tutorialEvent('switch');
    return true;
}

// Orange / green track box (js/game.js): store a charge of Titan / Jet to use any time.
// Already own that core? Then the box refills the switch recharge instead.
function pickupCore(boxType) {
    const id = boxType === 'big' ? 'titan' : 'jet';
    const core = CORES[id];
    playPowerup();
    haptic('medium');
    if (Cores.owns(id)) {
        Cores.cooldown = 0;
        renderCoreHud();
        flashCoreReady();
        hudToast('CORE RECHARGED', 'SWITCH ANY TIME', hexColor(core.glow));
        return;
    }
    const before = Cores.charges(id);
    SaveData.data.charges[id] = Math.min(before + 1, FEATURES.maxCoreCharges);
    SaveData.save();
    renderCoreHud();
    flashCoreReady();
    hudToast(`+1 ${core.name} CHARGE`, before >= FEATURES.maxCoreCharges ? 'STORE IS FULL' : 'USE IT FROM THE CORE BUTTON', hexColor(core.glow));
}

// Every physics step (js/game.js): count down the cooldown and the Phantom phase
let coreHudShown = -1;
function tickCores(timeScale) {
    const dt = timeScale / 60;
    if (Cores.phase > 0) Cores.phase = Math.max(0, Cores.phase - dt);
    if (Cores.cooldown > 0) {
        Cores.cooldown = Math.max(0, Cores.cooldown - dt);
        const shown = Math.ceil(Cores.cooldown * 10);       // update the HUD 10× a second at most
        if (shown !== coreHudShown) { coreHudShown = shown; renderCoreCooldown(); }
        if (Cores.cooldown === 0) { renderCoreHud(); flashCoreReady(); }
    }
}

// ---------- HUD: core button + picker ----------

const coreBtn = document.getElementById('core-btn');
const coreTray = document.getElementById('core-tray');
let coreTrayTimer = 0;

function renderCoreHud() {
    const list = Cores.available();
    const wrap = document.getElementById('core-switch');
    wrap.hidden = list.length < 2;                     // nothing to switch between yet
    const core = CORES[ballState] || CORES.normal;
    coreBtn.style.setProperty('--c', hexColor(core.glow));
    coreBtn.querySelector('.core-name').textContent = core.name;
    coreBtn.setAttribute('aria-label', `Core: ${core.name}. ${Cores.cooldown > 0 ? 'Recharging.' : 'Tap to switch.'}`);
    renderCoreCooldown();

    // The picker lists the other cores; the number is the keyboard shortcut (1–5, fixed order)
    coreTray.innerHTML = list.map((id, i) => {
        if (id === ballState) return '';
        const c = CORES[id];
        const left = Cores.owns(id) ? 0 : Cores.charges(id);          // stored charges from track boxes
        const badge = left > 0 ? `<small>×${left}</small>` : '';
        const label = `${c.name}: ${c.perk}${left > 0 ? `. ${left} stored ${left === 1 ? 'charge' : 'charges'}` : ''}`;
        return `<button class="core-opt" data-core="${id}" style="--c:${hexColor(c.glow)}" aria-label="${label}">`
             + `<span class="core-orb" aria-hidden="true"><span class="core-dot"></span></span><b>${c.short}</b>${badge}<kbd aria-hidden="true">${i + 1}</kbd></button>`;
    }).join('');
}

function renderCoreCooldown() {
    const k = Cores.cooldownMax > 0 ? Cores.cooldown / Cores.cooldownMax : 0;
    coreBtn.style.setProperty('--cd', k.toFixed(3));
    coreBtn.classList.toggle('cooling', Cores.cooldown > 0);
    coreTray.classList.toggle('cooling', Cores.cooldown > 0);
}

function openCoreTray() {
    if (!isPlaying || isGameOver || Pause.paused) return;
    if (Cores.cooldown > 0) { nudgeCoreButton(); return; }
    renderCoreHud();
    coreTray.classList.add('open');
    coreBtn.setAttribute('aria-expanded', 'true');
    clearTimeout(coreTrayTimer);
    coreTrayTimer = setTimeout(closeCoreTray, FEATURES.coreTrayCloseMs);
}

function closeCoreTray() {
    coreTray.classList.remove('open');
    coreBtn.setAttribute('aria-expanded', 'false');
    clearTimeout(coreTrayTimer);
}

function nudgeCoreButton() {
    coreBtn.classList.remove('nudge'); void coreBtn.offsetWidth; coreBtn.classList.add('nudge');
}

function flashCoreReady() {
    coreBtn.classList.remove('ready'); void coreBtn.offsetWidth; coreBtn.classList.add('ready');
}

attachButtonAction('core-btn', () => (coreTray.classList.contains('open') ? closeCoreTray() : openCoreTray()));
coreTray.addEventListener('click', (e) => {
    const opt = e.target.closest('.core-opt');
    if (opt) switchCore(opt.dataset.core);
});

// Keyboard (the mouse pointer is hidden while playing):
//   1–5  pick that core straight away (numbers shown on the picker tiles)
//   Q    the next core in the list
window.addEventListener('keydown', (e) => {
    if (!isPlaying || e.repeat) return;
    const list = Cores.available();
    if (e.code === 'KeyQ') {
        if (list.length < 2) return;
        switchCore(list[(list.indexOf(ballState) + 1) % list.length]);
        return;
    }
    const n = /^Digit([1-5])$/.exec(e.code);
    const id = n && list[Number(n[1]) - 1];
    if (id) switchCore(id);
});

renderCoreHud();
