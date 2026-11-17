// =========================================================
// Neon Core — sound: synthwave music + sound effects, all made live with the
// Web Audio API (no audio files: nothing to license, nothing added to the app size).
//
//   Settings  music / sound effects / vibration on-off (saved), the mute button mutes all
//   Music     4-chord synthwave loop (Am F C G, 124 BPM). Menus: pads, bass, soft arp and hats.
//             Playing: + drums, arpeggio and a lead every other pass. Paused: muffled.
//             The mode follows the game state by itself (Music.tick).
//   SFX       jump, landing, data (pitch climbs on quick pickups), core switch, shield,
//             crash, sector cleared, menu clicks
//   haptic()  vibration: the native Haptics plugin in the Android app (it brings the VIBRATE
//             permission), navigator.vibrate in mobile browsers
//
// Phone speakers barely play anything below ~150 Hz, so the bass sits an octave higher than
// usual and the kick has a click on top: otherwise the music is inaudible on a phone.
// =========================================================

let audioCtx;
let isMuted = false;

// ---------- Settings ----------

const Settings = {
    data: { music: true, sfx: true, vibration: true },
    load() {
        try { Object.assign(this.data, JSON.parse(localStorage.getItem('neonCoreSettings') || '{}')); } catch (e) {}
    },
    set(key, on) {
        this.data[key] = on;
        try { localStorage.setItem('neonCoreSettings', JSON.stringify(this.data)); } catch (e) {}
        applyVolumes();
    }
};
Settings.load();

// Vibration. kind: light (data) · medium (landing, core switch) · heavy (shield) ·
// error (life lost) · success (sector cleared)
const HAPTICS = {
    light:   { impact: 'LIGHT',  ms: 30 },
    medium:  { impact: 'MEDIUM', ms: 45 },
    heavy:   { impact: 'HEAVY',  ms: 70 },
    error:   { notification: 'ERROR',   ms: [70, 60, 140] },
    success: { notification: 'SUCCESS', ms: [40, 60, 60] }
};
let hapticsPlugin = null;
function nativeHaptics() {
    if (hapticsPlugin === null) {
        const cap = window.Capacitor;
        const register = (window.capacitorExports && window.capacitorExports.registerPlugin) || (cap && cap.registerPlugin);
        hapticsPlugin = cap && cap.isNativePlatform && cap.isNativePlatform() && register ? register('Haptics') : false;
    }
    return hapticsPlugin;
}
function haptic(kind) {
    const h = HAPTICS[kind] || HAPTICS.light;
    if (!Settings.data.vibration) return;
    const native = nativeHaptics();
    if (native) {
        const done = h.impact ? native.impact({ style: h.impact }) : native.notification({ type: h.notification });
        done.catch(() => { try { navigator.vibrate && navigator.vibrate(h.ms); } catch (e) {} });
        return;
    }
    try { navigator.vibrate && navigator.vibrate(h.ms); } catch (e) {}
}

// ---------- Audio graph: sfx + music → compressor → speakers ----------

let master, sfxBus, musicBus, musicFilter, echo, noiseBuf;

function initAudio() {
    if (audioCtx) {
        if (audioCtx.state === 'suspended' && !isMuted && !(typeof Ads !== 'undefined' && Ads.busy)) audioCtx.resume().catch(() => {});
        return;
    }
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return; }

    const comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = audioCtx.createGain();
    master.connect(comp); comp.connect(audioCtx.destination);

    sfxBus = audioCtx.createGain(); sfxBus.connect(master);

    // Music: its own low-pass (closes when paused) and a dotted-eighth echo for that synthwave space
    musicFilter = audioCtx.createBiquadFilter();
    musicFilter.type = 'lowpass'; musicFilter.frequency.value = 18000;
    musicBus = audioCtx.createGain();
    musicBus.connect(musicFilter); musicFilter.connect(master);
    echo = audioCtx.createDelay(1);
    echo.delayTime.value = (60 / Music.bpm) * 0.75;
    const fb = audioCtx.createGain(); fb.gain.value = 0.32;
    const echoOut = audioCtx.createGain(); echoOut.gain.value = 0.35;
    echo.connect(fb); fb.connect(echo); echo.connect(echoOut); echoOut.connect(musicFilter);

    noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    applyVolumes();
    if (isMuted) audioCtx.suspend();
    Music.start();
}

function applyVolumes() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    master.gain.setTargetAtTime(0.9, t, 0.05);
    sfxBus.gain.setTargetAtTime(Settings.data.sfx ? 1.5 : 0, t, 0.05);   // sits on top of the music
    musicBus.gain.setTargetAtTime(Settings.data.music ? 0.8 : 0, t, 0.15);
}

// The first tap or key press anywhere starts the sound (browsers need a user gesture)
['pointerdown', 'keydown'].forEach(evt => window.addEventListener(evt, () => initAudio(), { once: false, passive: true }));

const muteBtn = document.getElementById('mute-btn');
muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    muteBtn.classList.toggle('muted', isMuted);
    muteBtn.setAttribute('aria-pressed', String(isMuted));      // label stays "Mute sound"
    if (audioCtx) {
        if (isMuted) audioCtx.suspend();
        else audioCtx.resume();
    }
});

// No sound while the app is in the background
document.addEventListener('visibilitychange', () => {
    if (!audioCtx || isMuted) return;
    if (document.hidden) audioCtx.suspend();
    else if (!(typeof Ads !== 'undefined' && Ads.busy)) audioCtx.resume();
});

// ---------- Building blocks ----------

const canPlay = () => audioCtx && !isMuted && audioCtx.state === 'running';

// One oscillator note: optional pitch slide, attack, filter
function tone(freq, type, dur, vol, o = {}) {
    if (!canPlay()) return;
    const t = audioCtx.currentTime + (o.delay || 0);
    const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + (o.slideTime || dur));
    if (o.detune) osc.detune.value = o.detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.filter) {
        const f = audioCtx.createBiquadFilter();
        f.type = o.filter; f.frequency.value = o.filterFreq || 2000;
        osc.connect(f); node = f;
    }
    node.connect(g); g.connect(o.bus || sfxBus);
    osc.start(t); osc.stop(t + dur + 0.02);
}

// A burst of filtered noise: whooshes, hits, crashes
function noise(dur, vol, o = {}) {
    if (!canPlay()) return;
    const t = audioCtx.currentTime + (o.delay || 0);
    const src = audioCtx.createBufferSource(); src.buffer = noiseBuf;
    const f = audioCtx.createBiquadFilter();
    f.type = o.type || 'lowpass'; f.Q.value = o.q || 0.8;
    f.frequency.setValueAtTime(o.freq || 1200, t);
    if (o.freqTo) f.frequency.exponentialRampToValueAtTime(o.freqTo, t + dur);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}

// Kept for older calls
function playSynth(freq, type, duration, vol = 0.1) { tone(freq, type, duration, vol); }

// ---------- Sound effects ----------

function playJump() {
    tone(300, 'sine', 0.16, 0.22, { slideTo: 760, slideTime: 0.12 });
    noise(0.12, 0.08, { type: 'highpass', freq: 1800, freqTo: 5000 });
}

function playLand(hit) {                       // hit 0..0.8 (js/juice.js onLanding)
    const k = Math.min(hit / 0.8, 1);
    tone(150, 'sine', 0.2, 0.08 + k * 0.22, { slideTo: 42 });
    noise(0.09, 0.03 + k * 0.08, { freq: 500, freqTo: 120 });
}

let coinChain = 0, lastCoinAt = 0;
function playCoin() {                          // pitch climbs on quick pickups, like a combo
    const now = performance.now();
    coinChain = now - lastCoinAt < 1600 ? Math.min(coinChain + 1, 7) : 0;
    lastCoinAt = now;
    const f = 1046 * Math.pow(2, [0, 2, 4, 7, 9, 12, 14, 16][coinChain] / 12);
    tone(f, 'triangle', 0.28, 0.17);
    tone(f * 1.5, 'sine', 0.38, 0.08, { delay: 0.045 });
    noise(0.05, 0.02, { type: 'highpass', freq: 6000 });
}

function playPowerup() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 'square', 0.12, 0.045, { delay: i * 0.045, filter: 'lowpass', filterFreq: 3500 }));
    noise(0.3, 0.035, { type: 'bandpass', freq: 1200, freqTo: 6000, q: 2 });
}

function playSwitch(color) {                   // core switch: whoosh + a chord that rises
    noise(0.22, 0.07, { type: 'bandpass', freq: 400, freqTo: 4000, q: 1.5 });
    [392, 523, 784].forEach((f, i) => tone(f, 'sawtooth', 0.18, 0.035, { delay: 0.03 + i * 0.03, filter: 'lowpass', filterFreq: 2600 }));
}

function playShieldBreak() {
    noise(0.3, 0.12, { type: 'highpass', freq: 2500, freqTo: 900 });
    tone(940, 'triangle', 0.16, 0.08, { slideTo: 470 });
}

function playDie() {
    noise(0.7, 0.28, { freq: 3500, freqTo: 120 });
    tone(190, 'sawtooth', 0.6, 0.16, { slideTo: 38, filter: 'lowpass', filterFreq: 900 });
}

function playWin() {
    [440, 554, 659, 880, 1109].forEach((f, i) => {
        tone(f, 'triangle', 0.5, 0.08, { delay: i * 0.08 });
        tone(f * 2, 'sine', 0.35, 0.025, { delay: i * 0.08 + 0.02 });
    });
    noise(0.8, 0.03, { type: 'highpass', freq: 7000, delay: 0.3 });
}

function playClick() { tone(1700, 'sine', 0.04, 0.035); }

// Every menu button clicks (game buttons like jump have their own sounds)
document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b && !b.closest('#mobile-controls') && b.id !== 'shield-btn') playClick();
}, true);

// ---------- Music ----------

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);        // MIDI number → Hz
// Am – F – C – G, one bar each (MIDI roots in octave 2, chord tones above)
const CHORDS = [
    { root: 45, tones: [57, 60, 64] },     // A minor
    { root: 41, tones: [53, 57, 60] },     // F
    { root: 48, tones: [55, 60, 64] },     // C
    { root: 43, tones: [55, 59, 62] }      // G
];
// Lead for every other pass (step → MIDI note), 4 bars of 16 steps
const LEAD = { 0: 76, 6: 74, 8: 72, 12: 71, 16: 72, 22: 74, 24: 76, 28: 79, 32: 79, 38: 77, 40: 76, 44: 74, 48: 74, 52: 72, 56: 71, 60: 67 };

const Music = {
    bpm: 124,
    step: 0,
    nextTime: 0,
    timer: null,
    mode: 'menu',          // menu | play | pause
    layers: null,

    start() {
        if (this.timer || !audioCtx) return;
        const mk = (v) => { const g = audioCtx.createGain(); g.gain.value = v; g.connect(musicBus); return g; };
        this.layers = { pad: mk(0.8), bass: mk(0.75), drums: mk(0.35), arp: mk(0.35), lead: mk(0) };
        this.layers.arp.connect(echo); this.layers.lead.connect(echo);
        this.nextTime = audioCtx.currentTime + 0.1;
        this.timer = setInterval(() => this.tick(), 25);
    },

    // Which mix fits what's on screen
    wantedMode() {
        if (!isPlaying || isGameOver) return 'menu';
        if (Pause.reasons.has('esc-pause') || Pause.reasons.has('shield-offer')) return 'pause';
        return 'play';
    },

    setMode(mode) {
        if (mode === this.mode) return;
        this.mode = mode;
        const t = audioCtx.currentTime, L = this.layers;
        const play = mode === 'play';
        // Menus keep a light beat (hats + soft kick) so they don't feel slow; a run gets everything
        L.drums.gain.setTargetAtTime(play ? 1.0 : 0.35, t, 0.25);
        L.arp.gain.setTargetAtTime(play ? 0.9 : 0.35, t, 0.4);
        L.lead.gain.setTargetAtTime(play ? 0.8 : 0, t, 0.4);
        L.bass.gain.setTargetAtTime(play ? 1.0 : 0.75, t, 0.3);
        musicFilter.frequency.setTargetAtTime(mode === 'pause' ? 650 : 18000, t, 0.2);
    },

    tick() {
        if (!audioCtx || audioCtx.state !== 'running') return;
        if (typeof Pause !== 'undefined') this.setMode(this.wantedMode());
        const stepDur = 60 / this.bpm / 4;
        // Schedule a little ahead; after a long stall don't try to catch up
        if (this.nextTime < audioCtx.currentTime - 0.2) this.nextTime = audioCtx.currentTime + 0.05;
        while (this.nextTime < audioCtx.currentTime + 0.12) {
            this.playStep(this.step, this.nextTime, stepDur);
            this.nextTime += stepDur;
            this.step = (this.step + 1) % 128;            // 8 bars: 4 without lead, 4 with
        }
    },

    playStep(s, t, sd) {
        const bar = Math.floor(s / 16) % 4, i = s % 16, chord = CHORDS[bar], L = this.layers;
        // Pad: the whole chord at the start of each bar
        if (i === 0) chord.tones.forEach((n, k) => this.note(L.pad, NOTE(n), t, sd * 16, 0.07, 'sawtooth', { attack: 0.35, cutoff: 1800, detune: k % 2 ? 7 : -7 }));
        // Bass: driving eighths an octave up (phone speakers can't play the low one), plus a
        // quiet sub for headphones; octave jump on the off-beat
        if (i % 2 === 0) {
            const n = chord.root + 12 + (i % 4 === 2 ? 12 : 0);
            this.note(L.bass, NOTE(n), t, sd * 1.6, 0.13, 'sawtooth', { cutoff: 1300 });
            this.note(L.bass, NOTE(n - 12), t, sd * 1.6, 0.09, 'triangle', { cutoff: 400 });
        }
        // Arpeggio: chord tones going up in sixteenths
        this.note(L.arp, NOTE(chord.tones[i % 3] + 12), t, sd * 0.9, 0.06, 'square', { cutoff: 3400 });
        // Lead on the second half of the loop
        if (s >= 64 && LEAD[s - 64] !== undefined) this.note(L.lead, NOTE(LEAD[s - 64]), t, sd * 3.5, 0.085, 'sawtooth', { attack: 0.02, cutoff: 3800, detune: 5 });
        // Drums: four on the floor, snare on 2 and 4, off-beat hats
        if (i % 4 === 0) this.kick(t);
        if (i === 4 || i === 12) this.snare(t);
        if (i % 2 === 1) this.hat(t, i % 4 === 3 ? 0.08 : 0.05);
    },

    note(bus, freq, t, dur, vol, type, o) {
        const osc = audioCtx.createOscillator(), g = audioCtx.createGain(), f = audioCtx.createBiquadFilter();
        osc.type = type; osc.frequency.value = freq;
        if (o.detune) osc.detune.value = o.detune;
        f.type = 'lowpass'; f.frequency.value = o.cutoff || 2000;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + (o.attack || 0.01));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(f); f.connect(g); g.connect(bus);
        osc.start(t); osc.stop(t + dur + 0.05);
    },

    kick(t) {
        const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
        osc.frequency.setValueAtTime(160, t);
        osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        g.gain.setValueAtTime(0.7, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        osc.connect(g); g.connect(this.layers.drums);
        osc.start(t); osc.stop(t + 0.3);
        // Click on top: the part of a kick that phone speakers can actually play
        const src = audioCtx.createBufferSource(); src.buffer = noiseBuf;
        const f = audioCtx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2500; f.Q.value = 1;
        const cg = audioCtx.createGain();
        cg.gain.setValueAtTime(0.25, t); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
        src.connect(f); f.connect(cg); cg.connect(this.layers.drums);
        src.start(t, Math.random() * 0.5); src.stop(t + 0.03);
        const punch = audioCtx.createOscillator(), pg = audioCtx.createGain();
        punch.frequency.setValueAtTime(320, t); punch.frequency.exponentialRampToValueAtTime(120, t + 0.05);
        pg.gain.setValueAtTime(0.3, t); pg.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
        punch.connect(pg); pg.connect(this.layers.drums); punch.start(t); punch.stop(t + 0.08);
    },

    snare(t) {
        const src = audioCtx.createBufferSource(); src.buffer = noiseBuf;
        const f = audioCtx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.32, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        src.connect(f); f.connect(g); g.connect(this.layers.drums);
        src.start(t, Math.random() * 0.5); src.stop(t + 0.2);
        const body = audioCtx.createOscillator(), bg = audioCtx.createGain();
        body.frequency.value = 190;
        bg.gain.setValueAtTime(0.12, t); bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
        body.connect(bg); bg.connect(this.layers.drums); body.start(t); body.stop(t + 0.12);
    },

    hat(t, vol) {
        const src = audioCtx.createBufferSource(); src.buffer = noiseBuf;
        const f = audioCtx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 8000;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
        src.connect(f); f.connect(g); g.connect(this.layers.drums);
        src.start(t, Math.random() * 0.5); src.stop(t + 0.06);
    }
};

// ---------- Settings sheet: on / off buttons ----------

function renderSettings() {
    document.querySelectorAll('.set-opt').forEach((b) => {
        const on = Settings.data[b.dataset.setting] === (b.dataset.on === '1');
        b.classList.toggle('active', on);
        b.setAttribute('aria-checked', String(on));
    });
}
document.querySelectorAll('.set-opt').forEach((b) => b.addEventListener('click', () => {
    Settings.set(b.dataset.setting, b.dataset.on === '1');
    renderSettings();
    if (b.dataset.setting === 'vibration' && b.dataset.on === '1') haptic('medium');   // feel it once
}));
renderSettings();
