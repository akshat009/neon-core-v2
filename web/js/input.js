// =========================================================
// Neon Core — keyboard and touch input
// =========================================================

const keys = { w: false, a: false, s: false, d: false, space: false };

window.addEventListener('keydown', (e) => {
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

function moveJoystick(e) {
    const r = joyEl.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const maxR = r.width * 0.32;                       // how far the knob can travel
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) { dx *= maxR / dist; dy *= maxR / dist; }
    joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;

    let nx = dx / maxR, ny = dy / maxR;
    if (Math.hypot(nx, ny) < 0.18) { nx = 0; ny = 0; }  // dead zone
    // Slight boost so a diagonal push still reaches near full speed on each axis
    joystick.x = Math.max(-1, Math.min(1, nx * 1.3));
    joystick.y = Math.max(-1, Math.min(1, ny * 1.3)); // screen down = backwards, up = forwards
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
