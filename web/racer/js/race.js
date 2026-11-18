// Neon Core: Racer prototype — the race: you vs three rivals
//
// Everyone rides along the highway at distance s with a sideways offset d (js/track.js).
//   • Throttle is automatic; steer with the stick / A-D, brake with BRAKE / S.
//   • Shock-punch (PUNCH / Space / J): hits the nearest rival beside you. 3 hits = TAKEDOWN:
//     they crash and lose seconds. Rivals punch back when they ride next to you.
//   • Rubbing a rail or another bike costs speed.
//   • Position is by distance; reach the finish line (RACE_LEN) to see your place.

const RIDE = {
    maxV: 52,             // m/s at full throttle (≈ 187 km/h on the HUD)
    accel: 0.9,           // how fast speed reaches its target (per second)
    steerV: 15,           // sideways speed at full stick (m/s)
    punchReachS: 3.4,     // how far ahead/behind a punch reaches (m)
    punchReachD: 3.8,     // how far sideways
    punchCooldown: 0.55,
    rivalHits: 3,         // punches for a takedown
    draftBoost: 0.08,     // slipstream: riding close behind someone gives +8% speed
    draftLen: 14, draftWidth: 2.2,
    takedownData: 150, hitData: 20,
    placeData: [500, 300, 150, 50]
};

// Rivals are a touch faster than you on an empty road: you win with the slipstream, clean
// lines and takedowns, not by holding the throttle
const RIVALS = [
    { name: 'VOLT',  color: 0x19f0ff, skill: 1.025 },
    { name: 'NOVA',  color: 0xffe14d, skill: 1.035 },
    { name: 'RAZOR', color: 0x7cff4d, skill: 1.01 }
];

const Race = {
    player: null, rivals: [], t: 0, running: false, finished: false, zone: null,
    cash: 0, takedowns: 0, startCountdown: 0, input: { steer: 0, brake: false },

    start(zoneId, scene) {
        this.zone = zoneId;
        this.t = 0; this.cash = 0; this.takedowns = 0; this.finished = false;
        this.startCountdown = 3;
        this.running = true;

        const mk = (color, visor) => { const b = makeBike(color, { visor }); scene.add(b.root); return b; };
        this.player = { s: 6, d: 0, v: 0, vd: 0, stun: 0, punchCd: 0, bike: mk(0xff2bd6, 0xffe14d), shake: 0 };
        this.rivals = RIVALS.map((r, i) => ({
            ...r, s: 6 + (i + 1) * 0.01, d: [-4.5, 4.5, -1.5][i] , v: 0, vd: 0, targetD: [-4.5, 4.5, 2][i], hp: RIDE.rivalHits,
            crashed: 0, punchCd: 2 + i, stun: 0, laneT: 2 + i, bike: mk(r.color), tumble: 0
        }));
        this.player.d = 1.5;
        this.updateRivalMarkers();
    },

    clear(scene) {
        if (!this.player) return;
        [this.player, ...this.rivals].forEach(r => scene.remove(r.bike.root));
        this.player = null; this.rivals = [];
    },

    position() { return 1 + this.rivals.filter(r => r.s > this.player.s).length; },

    // ---------- per frame ----------
    update(dt) {
        if (!this.running) return;
        if (this.startCountdown > 0) {
            const before = Math.ceil(this.startCountdown);
            this.startCountdown -= dt;
            const now = Math.ceil(this.startCountdown);
            if (now !== before) showToast(now > 0 ? String(now) : 'GO!', now > 0 ? '' : ZONES[this.zone].name);
            this.place(this.player, dt); this.rivals.forEach(r => this.place(r, dt));
            return;
        }
        this.t += dt;
        const P = this.player;

        // ---- player ----
        P.stun = Math.max(0, P.stun - dt);
        P.punchCd = Math.max(0, P.punchCd - dt);
        // slipstream: close behind a rival in the same line → faster (and a chance to punch)
        P.draft = this.rivals.some(R => R.crashed <= 0 && R.s - P.s > 1.5 && R.s - P.s < RIDE.draftLen && Math.abs(R.d - P.d) < RIDE.draftWidth);
        const target = RIDE.maxV * (this.input.brake ? 0.4 : 1) * (P.stun > 0 ? 0.7 : 1) * (P.draft ? 1 + RIDE.draftBoost : 1) * (1 - Track.slope(P.s) * 0.03);
        P.v += (target - P.v) * Math.min(1, RIDE.accel * dt * (this.input.brake ? 2.5 : 1));
        const steer = P.stun > 0 ? this.input.steer * 0.5 + Math.sin(this.t * 30) * 0.3 : this.input.steer;
        P.vd += (steer * RIDE.steerV - P.vd) * Math.min(1, 10 * dt);
        P.s += P.v * dt;
        P.d += P.vd * dt;
        this.rails(P, true);

        // ---- rivals ----
        this.rivals.forEach((R) => this.updateRival(R, dt));
        this.bump();

        this.place(P, dt);
        this.rivals.forEach(r => this.place(r, dt));

        // punch button glows when someone is in reach
        document.getElementById('btn-punch').classList.toggle('ready', !!this.target() && P.punchCd <= 0);

        if (P.s >= RACE_LEN && !this.finished) this.finish();
    },

    updateRival(R, dt) {
        const P = this.player;
        R.punchCd = Math.max(0, R.punchCd - dt);
        R.stun = Math.max(0, R.stun - dt);
        if (R.crashed > 0) {                                     // tumbling after a takedown
            R.crashed -= dt;
            R.v *= Math.pow(0.15, dt);
            R.s += R.v * dt;
            R.tumble += dt * 9;
            if (R.crashed <= 0) { R.hp = RIDE.rivalHits; R.tumble = 0; R.d = clamp(R.d, -4, 4); }
            return;
        }
        // Rubber band keeps the race close: far behind → faster, far ahead → slower
        const gap = R.s - P.s;
        const band = gap < -60 ? 1.1 : gap < -25 ? 1.04 : gap > 80 ? 0.9 : gap > 35 ? 0.96 : 1;
        const target = RIDE.maxV * R.skill * band * (R.stun > 0 ? 0.65 : 1);
        R.v += (target - R.v) * Math.min(1, RIDE.accel * dt);
        // pick a new lane now and then; drift toward the player to start a fight
        R.laneT -= dt;
        if (R.laneT <= 0) {
            R.laneT = 1.5 + Math.random() * 2.5;
            const near = Math.abs(gap) < 12;
            R.targetD = near && Math.random() < 0.55 ? clamp(P.d + (Math.random() < 0.5 ? -2.6 : 2.6), -5.5, 5.5) : (Math.random() * 2 - 1) * 5.5;
        }
        // follow the road's bends a little late, like a real rider
        R.vd += (clamp((R.targetD - R.d) * 2.2, -RIDE.steerV, RIDE.steerV) - R.vd) * Math.min(1, 4 * dt);
        R.s += R.v * dt;
        R.d += R.vd * dt;
        this.rails(R, false);
        // rivals punch you when they're beside you
        if (R.punchCd <= 0 && Math.abs(gap) < RIDE.punchReachS * 0.8 && Math.abs(R.d - P.d) < RIDE.punchReachD * 0.85) {
            R.punchCd = 2.2 + Math.random() * 2;
            R.bike.punch(P.d > R.d ? 1 : -1);
            if (Math.random() < 0.7) this.hitPlayer(R);
        }
    },

    hitPlayer(R) {
        const P = this.player;
        P.stun = 0.7;
        P.v *= 0.82;
        P.vd += (P.d > R.d ? 1 : -1) * 9;
        P.shake = 0.5;
        showToast('HIT!', `${R.name} GOT YOU`, 'hit');
        haptic([40, 30, 60]);
        Sfx.zap(0.6);
    },

    // nearest rival beside the player within punch reach
    target() {
        const P = this.player;
        let best = null, bestDist = 1e9;
        this.rivals.forEach((R) => {
            if (R.crashed > 0) return;
            const ds = Math.abs(R.s - P.s), dd = Math.abs(R.d - P.d);
            if (ds < RIDE.punchReachS && dd < RIDE.punchReachD && ds + dd < bestDist) { best = R; bestDist = ds + dd; }
        });
        return best;
    },

    punch() {
        const P = this.player;
        if (!this.running || this.startCountdown > 0 || P.punchCd > 0 || this.finished) return;
        P.punchCd = RIDE.punchCooldown;
        const R = this.target();
        const dir = R ? (R.d > P.d ? 1 : -1) : 1;
        P.bike.punch(dir);
        Sfx.zap(R ? 1 : 0.35);
        if (!R) return;
        R.hp -= 1;
        R.stun = 0.6;
        R.v *= 0.85;
        R.vd += dir * 10;
        Effects.arc(P, R);
        haptic(30);
        if (R.hp <= 0) {
            R.crashed = 2.6;
            this.takedowns++;
            this.cash += RIDE.takedownData;
            showToast('TAKEDOWN!', `${R.name} · +◈${RIDE.takedownData}`, 'big');
            haptic([30, 40, 80]);
            Sfx.crash();
            Effects.burst(R, 1.6);
        } else {
            this.cash += RIDE.hitData;
            Effects.burst(R, 0.6);
        }
    },

    // keep riders on the road; scraping a rail costs speed
    rails(r, isPlayer) {
        const lim = ROAD_HALF - 0.8;
        if (Math.abs(r.d) > lim) {
            r.d = Math.sign(r.d) * lim;
            r.vd *= -0.3;
            r.v *= 0.985;
            if (isPlayer && Math.random() < 0.3) { Effects.sparks(r); haptic(10); }
        }
    },

    // bikes side by side push each other apart
    bump() {
        const all = [this.player, ...this.rivals.filter(r => r.crashed <= 0)];
        for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
            const a = all[i], b = all[j];
            if (Math.abs(a.s - b.s) < 2.2 && Math.abs(a.d - b.d) < 1.3) {
                const push = a.d < b.d ? -1 : 1;
                a.vd += push * 4; b.vd -= push * 4;
                a.v *= 0.995; b.v *= 0.995;
            }
        }
    },

    // put a rider's bike on the road, leaning into steering and bends
    place(r, dt) {
        const b = r.bike;
        const p = Track.point(r.s, r.d, 0, b.root.position);
        b.root.rotation.set(0, -Track.heading(r.s), 0);
        const pitch = Math.atan2(Track.slope(r.s), 4);
        const leanTarget = clamp(-r.vd * 0.045 - (Track.heading(r.s + 6) - Track.heading(r.s)) * 2.2, -0.6, 0.6);
        b.lean.rotation.z += (leanTarget - b.lean.rotation.z) * Math.min(1, 8 * dt);
        b.lean.rotation.x = pitch;
        if (r.tumble > 0) { b.lean.rotation.z = r.tumble; b.lean.rotation.x = r.tumble * 0.4; b.root.position.y += Math.abs(Math.sin(r.tumble)) * 0.6; }
        b.setSpeed(r.v, dt);
        b.update(dt);
    },

    finish() {
        this.finished = true;
        const place = this.position();
        const earned = RIDE.placeData[place - 1] + this.cash;
        this.cash = earned;
        setTimeout(() => showResult(place, this), 900);
        showToast(['1ST', '2ND', '3RD', '4TH'][place - 1] + ' PLACE', 'FINISH', 'big');
    },

    updateRivalMarkers() {
        document.getElementById('progress-rivals').innerHTML = this.rivals.map(r => `<i style="background:#${r.color.toString(16).padStart(6, '0')}"></i>`).join('');
    },

    hud() {
        if (!this.player) return;
        const P = this.player;
        document.getElementById('pos-now').textContent = this.position();
        document.getElementById('speed-now').textContent = Math.round(P.v * 3.6);
        document.getElementById('cash-now').textContent = this.cash;
        document.getElementById('progress-fill').style.width = `${clamp(P.s / RACE_LEN, 0, 1) * 100}%`;
        const marks = document.querySelectorAll('#progress-rivals i');
        this.rivals.forEach((r, i) => { if (marks[i]) marks[i].style.left = `${clamp(r.s / RACE_LEN, 0, 1) * 100}%`; });
        const piece = Track.pieceAt(P.s).type;
        document.getElementById('hud-zone').textContent = P.draft ? '» SLIPSTREAM «' : `${ZONES[this.zone].name} · ${{ straight: 'STRAIGHT', zigzag: 'ZIGZAG', sweep: 'BEND', elevated: 'SKYWAY' }[piece]}`;
        document.getElementById('hud-zone').classList.toggle('draft', !!P.draft);
    }
};

// ---------- small visual effects: shock arcs, spark bursts ----------

const Effects = {
    items: [], scene: null,
    init(scene) { this.scene = scene; },
    arc(a, b) {
        const pts = [];
        const pa = Track.point(a.s, a.d, 1.5), pb = Track.point(b.s, b.d, 1.4);
        for (let i = 0; i <= 8; i++) {
            const t = i / 8;
            pts.push(new THREE.Vector3().lerpVectors(pa, pb, t).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.5)));
        }
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xfff6a0, transparent: true }));
        this.scene.add(line);
        this.items.push({ obj: line, life: 0.18, max: 0.18 });
    },
    burst(r, size) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        Track.point(r.s, r.d, 1.2, m.position);
        this.scene.add(m);
        this.items.push({ obj: m, life: 0.35, max: 0.35, grow: size * 3 });
    },
    sparks(r) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true }));
        Track.point(r.s, Math.sign(r.d) * (ROAD_HALF - 0.2), 0.6, m.position);
        this.scene.add(m);
        this.items.push({ obj: m, life: 0.2, max: 0.2, grow: 1.5 });
    },
    update(dt) {
        this.items = this.items.filter((it) => {
            it.life -= dt;
            const k = it.life / it.max;
            it.obj.material.opacity = Math.max(0, k);
            if (it.grow) it.obj.scale.setScalar(0.3 + (1 - k) * it.grow);
            if (it.life <= 0) { this.scene.remove(it.obj); it.obj.geometry.dispose(); it.obj.material.dispose(); return false; }
            return true;
        });
    }
};
