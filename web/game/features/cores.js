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
// • The orange / green track boxes give a free try of Titan / Jet (even if not owned),
//   until the player switches to another core. A box doesn't start the cooldown.
// • A sector starts with the core the player last switched to.
// =========================================================

const Cores = {
    cooldown: 0,          // seconds until the player can switch again
    cooldownMax: 0,
    phase: 0,             // Phantom: seconds left of passing through gates
    trial: null,          // core id from a track box this sector (not owned)

    owns(id) { return id === 'normal' || SaveData.data.cores.includes(id); },

    get equipped() {
        const e = SaveData.data.equippedCore;
        return this.owns(e) ? e : 'normal';
    },

    // Cores the player can switch to right now, in CORE_ORDER (+ the free try, if any)
    available() {
        const list = CORE_ORDER.filter(id => this.owns(id));
        if (this.trial && !list.includes(this.trial)) list.push(this.trial);
        return list;
    },

    // Called from generateLevel() (js/level.js) at the start of every sector
    sectorStartCore() {
        this.cooldown = 0;
        this.phase = 0;
        this.trial = null;
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
    if (Cores.trial && id !== Cores.trial) Cores.trial = null;    // the free try ends when you switch away
    transformBall(id);
    Cores.cooldown = Cores.cooldownMax = core.cooldown;
    Cores.phase = core.phase;
    if (Cores.owns(id) && SaveData.data.equippedCore !== id) {
        SaveData.data.equippedCore = id;
        SaveData.save();
    }
    flashRing(pos, core.glow, 1.3);
    playPowerup();
    haptic(18);
    hudToast(`${core.name} CORE`, core.perk.toUpperCase(), hexColor(core.glow));
    closeCoreTray();
    renderCoreHud();
    return true;
}

// Orange / green track box (js/game.js): a free try of Titan / Jet
function pickupCore(boxType) {
    const id = boxType === 'big' ? 'titan' : 'jet';
    const core = CORES[id];
    if (ballState !== id) transformBall(id);
    if (!Cores.owns(id)) Cores.trial = id;
    playPowerup();
    haptic(18);
    hudToast(`${core.name} CORE`, Cores.owns(id) ? core.perk.toUpperCase() : 'FREE TRY · ' + core.perk.toUpperCase(), hexColor(core.glow));
    renderCoreHud();
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

// Short vibration on phones (ignored where not supported, or when the player turned sound off)
function haptic(ms) {
    if (isMuted || !navigator.vibrate) return;
    try { navigator.vibrate(ms); } catch (e) {}
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
        const trial = id === Cores.trial ? '<small>FREE TRY</small>' : '';
        return `<button class="core-opt" data-core="${id}" style="--c:${hexColor(c.glow)}" aria-label="${c.name}: ${c.perk}">`
             + `<span class="core-orb" aria-hidden="true"><span class="core-dot"></span></span><b>${c.short}</b>${trial}<kbd aria-hidden="true">${i + 1}</kbd></button>`;
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
