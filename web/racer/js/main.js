// Neon Core: Racer prototype — renderer, camera, input, menus, loop

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 600);   // fog hides anything further
const renderer = new THREE.WebGLRenderer({ antialias: !QUALITY_LOW, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY_LOW ? 1 : 1.75));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0x8a6bff, 0x100818, 0.9));
const moon = new THREE.DirectionalLight(0xffc0f0, 0.6);
moon.position.set(-30, 60, 20);
scene.add(moon);

// Bloom makes the neon glow; skipped on ?quality=low
let composer = null;
if (!QUALITY_LOW && THREE.EffectComposer) {
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.9, 0.45, 0.2));
}

function fitCamera() {
    camera.aspect = innerWidth / innerHeight;
    camera.fov = camera.aspect < 1 ? 82 : 66;              // portrait needs a wider view
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    if (composer) composer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', fitCamera);
fitCamera();

Effects.init(scene);
let road = null;

// ---------- feedback ----------

let toastTimer = 0;
function showToast(text, sub = '', kind = '') {
    const el = document.getElementById('toast');
    el.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
    el.style.color = kind === 'hit' ? '#ff4d6d' : '';
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), kind === 'big' ? 1400 : 800);
}

function haptic(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }

// Tiny synth: engine hum that follows speed, shock zap, crash
const Sfx = {
    ctx: null, eng: null, engGain: null,
    init() {
        if (this.ctx) { this.ctx.resume(); return; }
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
        const c = this.ctx;
        this.eng = c.createOscillator(); this.eng.type = 'sawtooth'; this.eng.frequency.value = 60;
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
        this.engGain = c.createGain(); this.engGain.gain.value = 0;
        this.eng.connect(f); f.connect(this.engGain); this.engGain.connect(c.destination);
        this.eng.start();
    },
    engine(v) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.eng.frequency.setTargetAtTime(55 + v * 2.6, t, 0.08);
        this.engGain.gain.setTargetAtTime(v > 1 ? 0.05 : 0, t, 0.2);
    },
    noise(dur, vol, freq) {
        if (!this.ctx) return;
        const c = this.ctx, t = c.currentTime;
        const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const src = c.createBufferSource(); src.buffer = buf;
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(freq / 6, t + dur);
        const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        src.connect(f); f.connect(g); g.connect(c.destination); src.start(t);
    },
    zap(k) { this.noise(0.18, 0.35 * k, 4000); },
    crash() { this.noise(0.7, 0.5, 1500); }
};

// ---------- input ----------

const keys = {};
addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if ((e.code === 'Space' || e.code === 'KeyJ') && !e.repeat) Race.punch();
    if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });

// Touch steering: drag the knob left/right inside the steer zone (springs back to centre)
const zone = document.getElementById('steer-zone'), knob = document.getElementById('steer-knob');
let steerTouch = null, steerTouchVal = 0;
zone.addEventListener('pointerdown', (e) => { steerTouch = e.pointerId; zone.setPointerCapture(e.pointerId); moveSteer(e); });
zone.addEventListener('pointermove', (e) => { if (e.pointerId === steerTouch) moveSteer(e); });
const endSteer = (e) => { if (e.pointerId !== steerTouch) return; steerTouch = null; steerTouchVal = 0; knob.style.transform = ''; };
zone.addEventListener('pointerup', endSteer); zone.addEventListener('pointercancel', endSteer);
function moveSteer(e) {
    const r = zone.getBoundingClientRect();
    const x = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2 - 20), -1, 1);
    steerTouchVal = x;
    knob.style.transform = `translateX(${x * (r.width / 2 - 34)}px)`;
}
// Hold-buttons (GAS, BRAKE): pressed while a finger is on them
function holdButton(id, onChange) {
    const el = document.getElementById(id);
    const set = (v) => { el.classList.toggle('on', v); onChange(v); };
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); set(true); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => el.addEventListener(ev, () => set(false)));
}
let brakeTouch = false, gasTouch = false;
holdButton('btn-brake', (v) => { brakeTouch = v; });
holdButton('btn-gas', (v) => { gasTouch = v; if (v) haptic(15); });
addEventListener('contextmenu', (e) => e.preventDefault());     // long-press on GAS must not open a menu
document.getElementById('btn-punch').addEventListener('pointerdown', (e) => { e.preventDefault(); Race.punch(); });

function readInput() {
    let steer = steerTouchVal;
    if (keys.KeyA || keys.ArrowLeft) steer -= 1;
    if (keys.KeyD || keys.ArrowRight) steer += 1;
    Race.input.steer = clamp(steer, -1, 1);
    Race.input.brake = brakeTouch || keys.KeyS || keys.ArrowDown;
    Race.input.gas = gasTouch || keys.KeyW || keys.ArrowUp;
}

// ---------- menus ----------

function startRace(zoneId) {
    Sfx.init();
    Race.clear(scene);
    City.dispose(scene);
    if (road) { scene.remove(road.group); road.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    Track.build(ZONES[zoneId].seed * 1000 + 3);
    City.build(zoneId, scene);
    road = buildRoadMeshes(ZONES[zoneId], scene);
    Race.start(zoneId, scene);
    document.getElementById('menu').hidden = true;
    document.getElementById('result').hidden = true;
    document.getElementById('hud').hidden = false;
    document.getElementById('touch').hidden = !IS_TOUCH;
    camPos = null;
}

function showResult(place, race) {
    document.getElementById('res-zone').textContent = ZONES[race.zone].name;
    document.getElementById('res-title').textContent = ['1ST', '2ND', '3RD', '4TH'][place - 1] + ' PLACE';
    document.getElementById('res-takedowns').textContent = race.takedowns;
    document.getElementById('res-time').textContent = race.t.toFixed(1) + 's';
    document.getElementById('res-cash').textContent = '◈ ' + race.cash;
    document.getElementById('result').hidden = false;
    document.getElementById('touch').hidden = true;
    Race.running = false;
    Sfx.engine(0);
}

document.querySelectorAll('.zone-btn[data-zone]').forEach(b => b.addEventListener('click', () => startRace(b.dataset.zone)));
document.getElementById('res-again').addEventListener('click', () => startRace(Race.zone));
document.getElementById('res-menu').addEventListener('click', () => {
    document.getElementById('result').hidden = true;
    document.getElementById('menu').hidden = false;
    document.getElementById('hud').hidden = true;
    Race.clear(scene);
});

// ---------- camera: chase behind the player, looking down the road ----------

let camPos = null;
const camLook = new THREE.Vector3(), tmp = new THREE.Vector3();
function updateCamera(dt) {
    const P = Race.player;
    if (!P) return;
    const portrait = camera.aspect < 1;
    const back = portrait ? 5.6 : 5.2, up = portrait ? 2.5 : 2.2;      // close enough to see the rider
    const want = Track.point(P.s - back, P.d * 0.7, up + Track.height(P.s) - Track.height(P.s - back), tmp.clone());
    want.y = Math.max(want.y, Track.height(P.s) + up * 0.8);
    if (!camPos) camPos = want.clone();
    camPos.lerp(want, Math.min(1, 6 * dt));
    camera.position.copy(camPos);
    if (P.shake > 0) { P.shake -= dt; camera.position.x += (Math.random() - 0.5) * P.shake; camera.position.y += (Math.random() - 0.5) * P.shake; }
    Track.point(P.s + 11, P.d * 0.6, 1.3, camLook);
    camera.lookAt(camLook);
    camera.rotation.z += P.bike.lean.rotation.z * 0.25;           // tilt a little with the lean
    const fovBase = portrait ? 82 : 66;
    camera.fov += (fovBase + clamp((P.v - 30) * 0.25, 0, 8) - camera.fov) * Math.min(1, 3 * dt);
    camera.updateProjectionMatrix();
}

// ---------- loop ----------

let last = performance.now(), clock = 0;
function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now; clock += dt;
    if (Race.player) {
        readInput();
        Race.update(dt);
        Race.hud();
        Sfx.engine(Race.running ? Race.player.v : 0);
        updateCamera(dt);
        City.update(dt, clock, Race.player.s, camera);
        if (road) road.roadMat.uniforms.uTime.value = clock;
        Effects.update(dt);
    } else {
        // menu backdrop: slow fly-over of the city
        idleCamera(dt);
    }
    if (composer) composer.render(); else renderer.render(scene, camera);
    requestAnimationFrame(frame);
}

// Before the first race: show Neon City behind the menu
let idleS = 40;
function idleCamera(dt) {
    idleS += dt * 14;
    if (idleS > RACE_LEN) idleS = 40;
    Track.point(idleS, -3, 6, camera.position);
    Track.point(idleS + 30, 2, 4, camLook);
    camera.lookAt(camLook);
    City.update(dt, clock, idleS, camera);
    if (road) road.roadMat.uniforms.uTime.value = clock;
}

// Testing: run the simulation ahead by `sec` seconds without rendering (window.__ff(10))
window.__ff = (sec) => { for (let t = 0; t < sec; t += 1 / 60) { readInput(); Race.update(1 / 60); updateCamera(1 / 60); } Race.hud(); };

Track.build(ZONES.city.seed * 1000 + 3);
City.build('city', scene);
road = buildRoadMeshes(ZONES.city, scene);
requestAnimationFrame(frame);
