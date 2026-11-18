// Neon Core: Racer prototype — the highway
//
// The road is a path sampled every metre: heading (left/right bends) and height (elevated
// sections) are built from a list of pieces, then integrated so `s` is true distance along
// the road. Everything else (bike, rivals, city, camera) is placed by (s, sideways offset).
//
// Pieces: straight · zigzag (quick left-right S bends) · sweep (one long bend) ·
//         elevated (ramp up onto pillars, ride high, ramp down)

const ROAD_HALF = 7;          // road is 14 m wide (4 lanes)
const RACE_LEN = 3000;        // finish line distance
const TRACK_LEN = RACE_LEN + 400;

const Track = {
    n: 0, x: null, y: null, z: null, head: null, pieces: [],

    build(seed) {
        const rng = makeRng(seed);
        const n = TRACK_LEN + 1;
        const curv = new Float32Array(n), elev = new Float32Array(n);
        this.pieces = [];
        // First 120 m straight so the start is calm, then random pieces
        let s = 120, side = rng() < 0.5 ? 1 : -1;
        this.pieces.push({ type: 'straight', from: 0, to: 120 });
        while (s < n) {
            const r = rng();
            let type = r < 0.25 ? 'straight' : r < 0.5 ? 'zigzag' : r < 0.75 ? 'sweep' : 'elevated';
            if (this.pieces[this.pieces.length - 1].type === type) type = 'straight';
            let len;
            if (type === 'straight') len = 80 + rng() * 80;
            if (type === 'zigzag') {
                len = 200 + rng() * 80;
                const k = 0.016 + rng() * 0.006;                       // tight bends
                for (let i = 0; i < len && s + i < n; i++) curv[s + i] = k * Math.sin((i / len) * Math.PI * 4) * side;
            }
            if (type === 'sweep') {
                len = 160 + rng() * 100;
                const k = (0.006 + rng() * 0.004) * side; side = -side; // alternate so the road never loops
                for (let i = 0; i < len && s + i < n; i++) curv[s + i] = k * Math.sin((i / len) * Math.PI);
            }
            if (type === 'elevated') {
                len = 260 + rng() * 120;
                const H = 12 + rng() * 6, ramp = 70;
                for (let i = 0; i < len && s + i < n; i++) {
                    const up = smooth(clamp(i / ramp, 0, 1)), down = smooth(clamp((len - i) / ramp, 0, 1));
                    elev[s + i] = H * Math.min(up, down);
                }
            }
            this.pieces.push({ type, from: s, to: Math.min(s + len, n) });
            s += Math.round(len);
        }

        // Integrate heading → positions (1 m steps)
        this.n = n;
        this.x = new Float32Array(n); this.y = elev; this.z = new Float32Array(n); this.head = new Float32Array(n);
        let h = 0, x = 0, z = 0;
        for (let i = 0; i < n; i++) {
            h += curv[i];
            h = clamp(h, -1.1, 1.1);                                   // keeps the road heading "forward"
            this.head[i] = h; this.x[i] = x; this.z[i] = z;
            x += Math.sin(h); z -= Math.cos(h);
        }
    },

    pieceAt(s) { return this.pieces.find(p => s >= p.from && s < p.to) || this.pieces[0]; },

    // Point on the road at distance s, offset d metres to the right, lifted by up metres
    point(s, d = 0, up = 0, out = new THREE.Vector3()) {
        s = clamp(s, 0, this.n - 2);
        const i = Math.floor(s), f = s - i;
        const h = lerp(this.head[i], this.head[i + 1], f);
        const cx = lerp(this.x[i], this.x[i + 1], f), cz = lerp(this.z[i], this.z[i + 1], f), cy = lerp(this.y[i], this.y[i + 1], f);
        // right-hand normal of the heading (forward = (sin h, 0, -cos h))
        return out.set(cx + Math.cos(h) * d, cy + up, cz + Math.sin(h) * d);
    },
    heading(s) { s = clamp(s, 0, this.n - 2); const i = Math.floor(s); return lerp(this.head[i], this.head[i + 1], s - i); },
    height(s) { s = clamp(s, 0, this.n - 2); const i = Math.floor(s); return lerp(this.y[i], this.y[i + 1], s - i); },
    slope(s) { return this.height(s + 2) - this.height(s - 2); }
};

// ---------- Meshes: road deck, edge rails, pillars, finish gate ----------

function makeRoadMaterial(zone) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uA: { value: new THREE.Color(zone.colA) },
            uB: { value: new THREE.Color(zone.colB) },
            uFog: { value: new THREE.Color(zone.fog) },
            uFogD: { value: zone.fogDensity },
            uFinish: { value: RACE_LEN }
        },
        vertexShader: `
            varying vec2 vUv; varying vec3 vW; varying float vDepth;
            void main() {
                vUv = uv;
                vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
                vec4 mv = viewMatrix * w; vDepth = -mv.z;
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: `
            uniform float uTime, uFogD, uFinish; uniform vec3 uA, uB, uFog;
            varying vec2 vUv; varying vec3 vW; varying float vDepth;
            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
            float line(float v, float w) { return 1.0 - smoothstep(0.0, w, abs(v)); }
            void main() {
                float u = vUv.x, s = vUv.y;
                vec3 col = vec3(0.022, 0.018, 0.04);
                // asphalt grain
                col += (noise(vW.xz * 3.0) - 0.5) * 0.015;
                // wet puddles reflect the neon city: coloured streaks along the road
                float wet = smoothstep(0.45, 0.75, noise(vW.xz * 0.12));
                float streak = pow(max(0.0, sin(vW.x * 1.3 + noise(vec2(s * 0.05, 0.0)) * 6.0)), 6.0);
                vec3 refl = mix(uA, uB, step(0.5, fract(s * 0.013 + u)));
                col += refl * streak * (0.15 + 0.5 * wet) * 0.55;
                col += refl * wet * 0.05;
                // rain ripples
                vec2 rp = vW.xz * 1.6; vec2 ri = floor(rp); float rt = fract(uTime * 1.3 + hash(ri) * 7.0);
                float ring = line(length(fract(rp) - 0.5) - rt * 0.45, 0.03) * (1.0 - rt) * step(0.7, hash(ri + 3.1));
                col += vec3(0.6, 0.8, 1.0) * ring * 0.25 * wet;
                // lane dashes and edge lines
                float dash = step(0.5, fract(s / 6.0));
                float lanes = max(max(line(u - 0.25, 0.006), line(u - 0.5, 0.006)), line(u - 0.75, 0.006)) * dash;
                col += vec3(0.85, 0.9, 1.0) * lanes * 0.55;
                col += uA * line(u - 0.02, 0.012) * 1.6 + uB * line(u - 0.98, 0.012) * 1.6;
                // finish line: checker band
                float fin = step(abs(s - uFinish), 3.0);
                float chk = mod(floor(u * 14.0) + floor(s * 0.6), 2.0);
                col = mix(col, vec3(chk) * 0.9 + uA * 0.2, fin);
                // fog
                float fog = 1.0 - exp(-pow(vDepth * uFogD, 2.0));
                gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
            }`
    });
}

function buildRoadMeshes(zone, scene) {
    const group = new THREE.Group();
    const CH = 100;                                            // chunk length (m)
    const roadMat = makeRoadMaterial(zone);
    const railMatA = new THREE.MeshBasicMaterial({ color: zone.colA, fog: true });
    const railMatB = new THREE.MeshBasicMaterial({ color: zone.colB, fog: true });
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x0b0a14, metalness: 0.4, roughness: 0.6, fog: true });
    const p = new THREE.Vector3(), q = new THREE.Vector3();

    for (let c = 0; c < Track.n - 1; c += CH) {
        const end = Math.min(c + CH, Track.n - 1);
        const cnt = end - c + 1;
        // road surface
        const pos = new Float32Array(cnt * 2 * 3), uv = new Float32Array(cnt * 2 * 2), idx = [];
        for (let i = 0; i < cnt; i++) {
            const s = c + i;
            Track.point(s, -ROAD_HALF, 0, p); Track.point(s, ROAD_HALF, 0, q);
            pos.set([p.x, p.y, p.z, q.x, q.y, q.z], i * 6);
            uv.set([0, s, 1, s], i * 4);
            if (i < cnt - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        g.setIndex(idx); g.computeBoundingSphere();
        group.add(new THREE.Mesh(g, roadMat));

        // glowing rails (a low wall on each side) + the deck's side faces
        [[-ROAD_HALF - 0.15, railMatA], [ROAD_HALF + 0.15, railMatB]].forEach(([d, mat]) => {
            const rp = new Float32Array(cnt * 2 * 3), ri = [];
            const dp = new Float32Array(cnt * 2 * 3);
            for (let i = 0; i < cnt; i++) {
                const s = c + i;
                Track.point(s, d, 0.55, p); Track.point(s, d, 0.75, q);
                rp.set([p.x, p.y, p.z, q.x, q.y, q.z], i * 6);
                Track.point(s, d, 0, p); Track.point(s, d, -1.4, q);
                dp.set([p.x, p.y, p.z, q.x, q.y, q.z], i * 6);
                if (i < cnt - 1) { const a = i * 2; ri.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
            }
            const rg = new THREE.BufferGeometry();
            rg.setAttribute('position', new THREE.BufferAttribute(rp, 3)); rg.setIndex(ri); rg.computeBoundingSphere();
            group.add(new THREE.Mesh(rg, mat));
            const dg = new THREE.BufferGeometry();
            dg.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dg.setIndex(ri); dg.computeVertexNormals(); dg.computeBoundingSphere();
            const deck = new THREE.Mesh(dg, deckMat); deck.material.side = THREE.DoubleSide;
            group.add(deck);
        });
    }

    // Pillars under the elevated sections
    const pillarGeo = new THREE.BoxGeometry(2.2, 1, 2.2);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x15121f, emissive: zone.colA, emissiveIntensity: 0.05, roughness: 0.8, fog: true });
    const pillars = [];
    for (let s = 0; s < Track.n; s += 24) {
        const hgt = Track.height(s);
        if (hgt > 3) pillars.push([s, hgt]);
    }
    const inst = new THREE.InstancedMesh(pillarGeo, pillarMat, Math.max(1, pillars.length));
    const m = new THREE.Matrix4();
    pillars.forEach(([s, hgt], i) => {
        Track.point(s, 0, 0, p);
        m.makeRotationY(-Track.heading(s));
        m.scale(new THREE.Vector3(1, hgt + 20, 1));
        m.setPosition(p.x, p.y - (hgt + 20) / 2 - 1.4, p.z);
        inst.setMatrixAt(i, m);
    });
    inst.count = pillars.length;
    group.add(inst);

    // Finish gate: two posts and a glowing beam
    const gate = new THREE.Group();
    const postGeo = new THREE.BoxGeometry(0.8, 9, 0.8), beamGeo = new THREE.BoxGeometry(ROAD_HALF * 2 + 3, 1.2, 0.8);
    const gMat = new THREE.MeshBasicMaterial({ color: zone.colA });
    [-1, 1].forEach(sd => { const post = new THREE.Mesh(postGeo, gMat); post.position.set(sd * (ROAD_HALF + 1), 4.5, 0); gate.add(post); });
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: zone.colB })); beam.position.y = 9; gate.add(beam);
    Track.point(RACE_LEN, 0, 0, p); gate.position.copy(p); gate.rotation.y = -Track.heading(RACE_LEN);
    group.add(gate);

    scene.add(group);
    return { group, roadMat };
}
