// =========================================================
// Neon Core — keyboard and touch input
// =========================================================

const keys = { w: false, a: false, s: false, d: false, space: false };

window.addEventListener('keydown', (e) => {
    if(e.code === 'Escape') {
        if (typeof togglePauseMenu === 'function') togglePauseMenu();
        e.preventDefault();
        return;
    }
    if(['ArrowUp','KeyW'].includes(e.code)) keys.w = true;
    if(['ArrowDown','KeyS'].includes(e.code)) keys.s = true;
    if(['ArrowLeft','KeyA'].includes(e.code)) keys.a = true;
    if(['ArrowRight','KeyD'].includes(e.code)) keys.d = true;
    if(e.code === 'Space') { keys.space = true; e.preventDefault(); }
});

window.addEventListener('keyup', (e) => {
    if(['ArrowUp','KeyW'].includes(e.code)) keys.w = false;
    if(['ArrowDown','KeyS'].includes(e.code)) keys.s = false;
    if(['ArrowLeft','KeyA'].includes(e.code)) keys.a = false;
    if(['ArrowRight','KeyD'].includes(e.code)) keys.d = false;
    if(e.code === 'Space') keys.space = false;
});

// ---------- Touch joystick (analog) ----------
// Pointer events + pointer capture, so the joystick and the jump button work with two thumbs at once.

const joystick = { active: false, x: 0, y: 0, pointerId: null };
const joyEl = document.getElementById('joystick');
const joyKnob = document.getElementById('joy-knob');

// ---------- Joystick sensitivity (1 = gentle … 5 = twitchy), saved on the device ----------
// Speed = (how far the knob is pushed) ^ curve. A higher curve means small thumb movements
// give small speeds, so steering is calmer; full speed is always reached at the ring edge.
const JOY_SENSITIVITY = {
    1: { curve: 2.2, gain: 1.0 },
    2: { curve: 1.8, gain: 1.0 },
    3: { curve: 1.5, gain: 1.05 },   // default
    4: { curve: 1.2, gain: 1.15 },
    5: { curve: 1.0, gain: 1.3 }     // the old, very quick response
};
const JOY_DEAD_ZONE = 0.2;           // ignore the first 20% of the knob's travel
let joySensitivity = 3;
try {
    const saved = parseInt(localStorage.getItem('neonCoreJoySensitivity'), 10);
    if (JOY_SENSITIVITY[saved]) joySensitivity = saved;
} catch (e) {}

function setJoySensitivity(level) {
    if (!JOY_SENSITIVITY[level]) return;
    joySensitivity = level;
    try { localStorage.setItem('neonCoreJoySensitivity', String(level)); } catch (e) {}
    document.querySelectorAll('.sens-step').forEach(b => {
        const on = Number(b.dataset.sens) === level;
        b.classList.toggle('active', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
}

function moveJoystick(e) {
    const r = joyEl.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const maxR = r.width * 0.4;                        // how far the knob can travel
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) { dx *= maxR / dist; dy *= maxR / dist; }
    joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;

    const push = Math.min(dist / maxR, 1);             // 0 = centre, 1 = ring edge
    if (push < JOY_DEAD_ZONE || dist === 0) { joystick.x = 0; joystick.y = 0; return; }

    const s = JOY_SENSITIVITY[joySensitivity];
    const m = (push - JOY_DEAD_ZONE) / (1 - JOY_DEAD_ZONE);
    const speed = Math.min(Math.pow(m, s.curve) * s.gain, 1);

    // Direction, stretched from a circle to a square so a full diagonal push gives
    // full speed on both axes (same as holding two arrow keys)
    const ux = dx / dist, uy = dy / dist;
    const stretch = 1 / Math.max(Math.abs(ux), Math.abs(uy));
    joystick.x = Math.max(-1, Math.min(1, ux * speed * stretch));
    joystick.y = Math.max(-1, Math.min(1, uy * speed * stretch)); // screen down = backwards, up = forwards
}

function releaseJoystick() {
    joystick.active = false; joystick.pointerId = null;
    joystick.x = 0; joystick.y = 0;
    joyKnob.style.transform = '';
    joyEl.classList.remove('active');
}

joyEl.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (joystick.active) return;
    joystick.active = true; joystick.pointerId = e.pointerId;
    try { joyEl.setPointerCapture(e.pointerId); } catch (_) {}
    joyEl.classList.add('active');
    moveJoystick(e);
});
joyEl.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joystick.pointerId) return;
    e.preventDefault();
    moveJoystick(e);
});
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
    joyEl.addEventListener(type, (e) => { if (e.pointerId === joystick.pointerId) releaseJoystick(); });
});

// ---------- Jump button ----------

const jumpBtn = document.getElementById('btn-jump');
jumpBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    keys.space = true;
    jumpBtn.classList.add('pressed');
    try { jumpBtn.setPointerCapture(e.pointerId); } catch (_) {}
    if (navigator.vibrate) navigator.vibrate(8);
});
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
    jumpBtn.addEventListener(type, () => { keys.space = false; jumpBtn.classList.remove('pressed'); });
});

// No long-press menu / text selection on the controls
document.getElementById('mobile-controls').addEventListener('contextmenu', (e) => e.preventDefault());

// Sensitivity picker on the start menu (shown on touch screens only)
document.querySelectorAll('.sens-step').forEach(btn => {
    btn.addEventListener('click', () => setJoySensitivity(Number(btn.dataset.sens)));
});
setJoySensitivity(joySensitivity);
