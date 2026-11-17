// =========================================================
// Neon Core — Three.js scene, camera, lights and the look of every object
// =========================================================

const IS_TOUCH = 'ontouchstart' in window;
const BG_COLOR = 0x03060d;

const scene = new THREE.Scene();
scene.background = new THREE.Color(BG_COLOR);
scene.fog = new THREE.FogExp2(BG_COLOR, 0.02);

// Set initial aspect ratio and FOV based on orientation
let initialAspect = window.innerWidth / window.innerHeight;
let initialFov = initialAspect < 1 ? 75 : 55; // Wider FOV for portrait mode
const camera = new THREE.PerspectiveCamera(initialFov, initialAspect, 0.1, 250);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- Lights ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0x88ccff, 0x101020, 0.4);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0x00ffff, 0.9);
dirLight.position.set(15, 25, 10);
scene.add(dirLight);

const pinkLight = new THREE.DirectionalLight(0xff00ff, 0.22);
pinkLight.position.set(-15, 15, -15);
scene.add(pinkLight);

// =========================================================
// Helpers: textures, glow sprites, thick neon outlines
// =========================================================

function makeGlowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
}

// One grid cell: dark tile with a bright border (the border halves join into full lines)
function makeGridTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgb(60,220,255)'; g.lineWidth = 3; g.strokeRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(60,220,255,0.5)'; g.fillRect(62, 62, 4, 4);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
}

const glowTex = makeGlowTexture();
const gridTex = makeGridTexture();

function glowSprite(color, scale, opacity) {
    const mat = new THREE.SpriteMaterial({ map: glowTex, color: color, transparent: true, opacity: opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.scale.set(scale, scale, 1);
    return s;
}

// Keep the grid the same size on every box, whatever its dimensions
const GRID_CELL = 2;
function scaleBoxUVs(geo, w, h, d) {
    const uv = geo.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // +x, -x, +y, -y, +z, -z faces
    for (let f = 0; f < 6; f++) {
        for (let v = 0; v < 4; v++) {
            const i = f * 4 + v;
            uv.setXY(i, uv.getX(i) * dims[f][0] / GRID_CELL, uv.getY(i) * dims[f][1] / GRID_CELL);
        }
    }
    uv.needsUpdate = true;
}

// Thick glowing outline: one thin cylinder per edge, merged into one geometry.
// (WebGL lines are always 1px wide, so wireframes look weak on phones.)
function tubeEdges(srcGeo, radius) {
    const edgePos = new THREE.EdgesGeometry(srcGeo).attributes.position.array;
    const positions = [], normals = [];
    const a = new THREE.Vector3(), b = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion(), m = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < edgePos.length; i += 6) {
        a.set(edgePos[i], edgePos[i + 1], edgePos[i + 2]);
        b.set(edgePos[i + 3], edgePos[i + 4], edgePos[i + 5]);
        const tube = new THREE.CylinderGeometry(radius, radius, a.distanceTo(b) + radius * 2, 6, 1).toNonIndexed();
        q.setFromUnitVectors(up, b.clone().sub(a).normalize());
        m.compose(a.clone().add(b).multiplyScalar(0.5), q, one);
        tube.applyMatrix4(m);
        positions.push(...tube.attributes.position.array);
        normals.push(...tube.attributes.normal.array);
        tube.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return geo;
}

function additiveMat(color, opacity) {
    return new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, blending: THREE.AdditiveBlending, depthWrite: false });
}

// =========================================================
// Track
// =========================================================

const floorMat = new THREE.MeshStandardMaterial({
    color: 0x060b16, roughness: 0.55, metalness: 0.45,
    emissive: 0xffffff, emissiveMap: gridTex, emissiveIntensity: 0.13
});
const edgeMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.45 });
// Side rails: light packets race along them towards the camera (uTime set in js/world.js)
const railMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x5ff8ff) } },
    vertexShader: `
        varying float vZ; varying float vDepth;
        void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vZ = wp.z;
            vec4 mv = viewMatrix * wp;
            vDepth = -mv.z;
            gl_Position = projectionMatrix * mv;
        }`,
    fragmentShader: `
        uniform float uTime; uniform vec3 uColor;
        varying float vZ; varying float vDepth;
        void main() {
            float p = fract((vZ - uTime * 26.0) / 9.0);
            float packet = smoothstep(0.0, 0.03, p) * (1.0 - smoothstep(0.03, 0.2, p));
            vec3 col = uColor * 0.75 + vec3(1.0) * packet * 1.4;
            float fogK = exp(-pow(0.02 * vDepth, 2.0));            // same falloff as the scene fog
            gl_FragColor = vec4(col * fogK, 1.0);
        }`
});
const laneMat = new THREE.MeshBasicMaterial({ color: 0x1aa6c8, transparent: true, opacity: 0.45 });

// Main platform: 14 wide, 1 tall. Collision code reads geometry.parameters, so it stays a BoxGeometry.
function createPlatform(length) {
    const geo = new THREE.BoxGeometry(14, 1, length);
    scaleBoxUVs(geo, 14, 1, length);
    const plat = new THREE.Mesh(geo, floorMat);

    const railGeo = new THREE.BoxGeometry(0.05, 0.04, length);  // thin bright side rails
    for (const x of [-6.97, 6.97]) {
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.set(x, 0.52, 0);
        plat.add(rail);
    }
    const laneGeo = new THREE.BoxGeometry(0.022, 0.01, length); // hairline lane markers
    for (const x of [-2.35, 2.35]) {
        const lane = new THREE.Mesh(laneGeo, laneMat);
        lane.position.set(x, 0.506, 0);
        plat.add(lane);
    }
    decoratePlatform(plat, length);   // neon arch (js/world.js)
    return plat;
}

const movPlatGeo = new THREE.BoxGeometry(6, 0.5, 4);
scaleBoxUVs(movPlatGeo, 6, 0.5, 4);
const movPlatFrameGeo = tubeEdges(movPlatGeo, 0.02);
const movPlatFrameMat = new THREE.MeshBasicMaterial({ color: 0xff3df5 });

function createMovingPlatform() {
    const mPlat = new THREE.Mesh(movPlatGeo, floorMat);
    mPlat.add(new THREE.Mesh(movPlatFrameGeo, movPlatFrameMat));
    return mPlat;
}

// Endless grid far below the track (falling = death, so it must read as "far away")
const gridFloor = new THREE.GridHelper(480, 120, 0x0e4a66, 0x0e4a66);
gridFloor.position.y = -14;
gridFloor.material.transparent = true;
gridFloor.material.opacity = 0.4;
scene.add(gridFloor);

// =========================================================
// Pickups and hurdles — thin, crisp neon outlines
// =========================================================

// Cyan data: a glowing neon ring with a thin inner ring and a small bright core
const dataRingGeo = new THREE.TorusGeometry(0.8, 0.085, 10, 48);
const dataInnerGeo = new THREE.TorusGeometry(0.56, 0.024, 6, 40);
const dataDiscGeo = new THREE.CircleGeometry(0.74, 40);
const dataCoreGeo = new THREE.OctahedronGeometry(0.16);
const dataRingMat = new THREE.MeshBasicMaterial({ color: 0x6ff8ff });
const dataCoreMat = new THREE.MeshBasicMaterial({ color: 0xdffeff });
const dataFillMat = new THREE.MeshBasicMaterial({ color: 0x1ec8ff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

function createData(phase) {
    const g = new THREE.Group();
    const inner = new THREE.Group();          // inner spins and bobs; outer stays put for collisions
    inner.add(new THREE.Mesh(dataRingGeo, dataRingMat));
    inner.add(new THREE.Mesh(dataDiscGeo, dataFillMat));
    const ring2 = new THREE.Mesh(dataInnerGeo, dataCoreMat);
    inner.add(ring2);
    inner.add(new THREE.Mesh(dataCoreGeo, dataCoreMat));
    inner.add(glowSprite(0x29d8ff, 2.4, 0.22));
    g.add(inner);
    g.userData = { inner: inner, ring2: ring2, phase: phase };
    return g;
}

// Red warning glow on the floor under every hazard (one shared material, pulsed in js/juice.js)
const mineFloorMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff1030, transparent: true, opacity: 0.5, depthWrite: false });
const mineFloorGeo = new THREE.PlaneGeometry(4.2, 2.6);

// Tileable diagonal hazard stripes, hot orange and red (scrolled in js/juice.js)
function makeHazardTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#ff2448'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#ffae3a';
    for (let x = -128; x < 256; x += 64) {        // 45° bands that wrap seamlessly
        g.beginPath();
        g.moveTo(x, 128); g.lineTo(x + 30, 128); g.lineTo(x + 30 + 128, 0); g.lineTo(x + 128, 0);
        g.closePath(); g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

// Neon sign frame: a wide soft tube with a bright core, rounded corners, transparent inside
function makeGateFrameTexture() {
    const W = 512, H = 384, r = 46, m = 20;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const rr = (inset) => {
        const x = m + inset, y = m + inset, w = W - 2 * (m + inset), h = H - 2 * (m + inset), k = Math.max(r - inset, 4);
        g.beginPath();
        g.moveTo(x + k, y); g.arcTo(x + w, y, x + w, y + h, k); g.arcTo(x + w, y + h, x, y + h, k);
        g.arcTo(x, y + h, x, y, k); g.arcTo(x, y, x + w, y, k); g.closePath();
    };
    g.lineJoin = 'round';
    rr(0); g.strokeStyle = 'rgba(255, 70, 60, 0.35)'; g.lineWidth = 34; g.stroke();   // halo
    rr(0); g.strokeStyle = '#ff6a3a'; g.lineWidth = 16; g.stroke();                   // tube
    rr(0); g.strokeStyle = '#ffe2b0'; g.lineWidth = 5; g.stroke();                    // hot core
    rr(30); g.strokeStyle = 'rgba(255, 200, 120, 0.8)'; g.lineWidth = 3; g.stroke();  // inner hairline
    return new THREE.CanvasTexture(c);
}

// ---------- Hazard gates (the red hurdles) ----------
// A glowing hazard sign standing across the track, like a neon road barrier.
// Hurdles are placed at y 1.2 (js/level.js); the gate stands on the track top (y 0.5).
// The hit box in js/game.js (hitsGate) uses these sizes.
const GATE_W = 2.8, GATE_H = 2.1, GATE_D = 0.26;
const GATE_BASE = 0.5 - 1.2;                    // track top, relative to the hurdle's position
const GATE_TOP_Y = 0.5 + GATE_H;                // world height of the top bar

const hazardTex = makeHazardTexture();
hazardTex.repeat.set(2.4, 1.8);
const gateFrameTex = makeGateFrameTexture();

const gateStripeMat = new THREE.MeshBasicMaterial({ map: hazardTex, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false });
const gateFrameMat  = new THREE.MeshBasicMaterial({ map: gateFrameTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
const gatePostMat   = new THREE.MeshBasicMaterial({ color: 0xffa050 });
const gateScanMat   = new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });

const gateFaceGeo   = new THREE.PlaneGeometry(GATE_W, GATE_H);
const gateStripeGeo = new THREE.PlaneGeometry(GATE_W * 0.84, GATE_H * 0.78);
const gatePostGeo   = new THREE.CylinderGeometry(0.06, 0.06, GATE_H * 0.98, 10);
const gateFootGeo   = new THREE.BoxGeometry(0.34, 0.08, 0.5);
const gateScanGeo   = new THREE.BoxGeometry(GATE_W * 0.84, 0.035, 0.035);

// children[0] = the gate body (js/juice.js animates its scan line); the group never rotates
function createMine() {
    const g = new THREE.Group();
    const gate = new THREE.Group();
    gate.position.y = GATE_BASE + GATE_H / 2;

    gate.add(new THREE.Mesh(gateStripeGeo, gateStripeMat));               // hazard stripes fill the sign
    for (const z of [0.02, -0.02]) {                                     // neon frame, both faces
        const face = new THREE.Mesh(gateFaceGeo, gateFrameMat);
        face.position.z = z;
        gate.add(face);
    }
    for (const sx of [-1, 1]) {                                          // glowing legs on little feet
        const post = new THREE.Mesh(gatePostGeo, gatePostMat);
        post.position.x = sx * GATE_W * 0.47;
        gate.add(post);
        const foot = new THREE.Mesh(gateFootGeo, gatePostMat);
        foot.position.set(sx * GATE_W * 0.47, -GATE_H / 2 + 0.04, 0);
        gate.add(foot);
    }
    const scan = new THREE.Mesh(gateScanGeo, gateScanMat);              // light that sweeps up and down
    gate.add(scan);
    gate.userData.scan = scan;

    const glow = glowSprite(0xff4a28, 5.2, 0.32);
    glow.position.y = gate.position.y;
    const floor = new THREE.Mesh(mineFloorGeo, mineFloorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = GATE_BASE + 0.03;
    g.add(gate, glow, floor);
    g.userData.phase = Math.random() * Math.PI * 2;
    return g;
}

// Power-up boxes: orange = heavy (high jump), green = micro (fast). Cube-in-cube outline.
const POWERUP_COLORS = { big: 0xffa12e, small: 0x45ff6a };
const boxShape = new THREE.BoxGeometry(1.3, 1.3, 1.3);
const boxFrameGeo = tubeEdges(boxShape, 0.018);
const boxInnerFrameGeo = tubeEdges(new THREE.BoxGeometry(0.6, 0.6, 0.6), 0.012);
const powerupFrameMats = { big: new THREE.MeshBasicMaterial({ color: POWERUP_COLORS.big }), small: new THREE.MeshBasicMaterial({ color: POWERUP_COLORS.small }) };
const powerupFillMats = { big: additiveMat(POWERUP_COLORS.big, 0.045), small: additiveMat(POWERUP_COLORS.small, 0.045) };

function createPowerup(type, phase) {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    inner.add(new THREE.Mesh(boxShape, powerupFillMats[type]));
    inner.add(new THREE.Mesh(boxFrameGeo, powerupFrameMats[type]));
    const core = new THREE.Mesh(boxInnerFrameGeo, powerupFrameMats[type]);
    core.rotation.set(0.6, 0.6, 0);
    inner.add(core);
    inner.add(glowSprite(POWERUP_COLORS[type], 2.0, 0.16));
    g.add(inner);
    g.userData = { type: type, inner: inner, core: core, phase: phase };
    return g;
}

// =========================================================
// Player ball — Tron style: glossy black shell with thin glowing circuit lines
// =========================================================

const BALL_LOOKS = {
    normal: { glow: 0x29f3ff, light: 0x00ffff },
    big:    { glow: 0xffa12e, light: 0xffaa00 },
    small:  { glow: 0x45ff6a, light: 0x00ff00 }
};

const ballMat = new THREE.ShaderMaterial({
    uniforms: {
        uTime:  { value: 0 },
        uBlink: { value: 1 },
        uColor: { value: new THREE.Color(BALL_LOOKS.normal.glow) },
        uSquash: { value: 0 },   // > 0 squashes on landing, < 0 stretches while falling (js/juice.js)
        uRadius: { value: 1 }
    },
    extensions: { derivatives: true },
    transparent: true,           // a slightly see-through shell shows the energy nucleus inside
    vertexShader: `
        uniform float uSquash; uniform float uRadius;
        varying vec3 vPos; varying vec3 vNormal; varying vec3 vView;
        void main() {
            vPos = position;
            // Squash / stretch along world Y, so it works however the ball has rolled
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vec3 c = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            vec3 d = wp.xyz - c;
            d.y *= 1.0 - uSquash;
            d.xz *= 1.0 + uSquash * 0.45;
            wp.xyz = c + d;
            wp.y -= uRadius * max(uSquash, 0.0);          // keep the bottom on the floor
            vec4 mv = viewMatrix * wp;
            vNormal = normalize(normalMatrix * normal);
            vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
        }`,
    fragmentShader: `
        #define PI 3.14159265
        uniform float uTime; uniform float uBlink; uniform vec3 uColor;
        varying vec3 vPos; varying vec3 vNormal; varying vec3 vView;

        // Anti-aliased line: stays ~the same pixel width at any distance
        float aline(float d, float w) {
            float fw = fwidth(d);
            return 1.0 - smoothstep(w, w + fw * 1.5, abs(d));
        }

        void main() {
            vec3 p = normalize(vPos);
            float lat = asin(clamp(p.y, -1.0, 1.0));
            float lon = atan(p.z, p.x);
            float facing = max(dot(vNormal, vView), 0.0);

            // Glossy black shell + one sharp highlight
            vec3 col = vec3(0.008, 0.016, 0.03) + uColor * 0.035 * facing;
            vec3 r = reflect(-vView, vNormal);
            col += vec3(0.55, 0.8, 0.9) * pow(max(dot(r, normalize(vec3(-0.35, 0.75, 0.55))), 0.0), 60.0) * 0.5;

            // Circuit lines
            float pulse = 0.75 + 0.25 * sin(lon * 3.0 - uTime * 5.0);
            float lines = 0.0;
            lines += aline(lat, 0.03) * pulse;                    // main equator band
            lines += 0.85 * aline(abs(lat) - 0.12, 0.006);        // thin guide lines beside it
            lines += 0.6 * aline(abs(lat) - 0.66, 0.006);         // upper / lower rings
            lines += 0.75 * aline(abs(lat) - 1.22, 0.008);        // pole caps
            float m = (mod(lon + PI * 0.25, PI * 0.5) - PI * 0.25) * cos(lat);
            float panel = step(0.14, abs(lat)) * step(abs(lat), 1.2);
            lines += 0.6 * panel * aline(m, 0.006);               // 4 meridian segments

            float rim = pow(1.0 - facing, 3.0);
            col += uColor * min(lines, 1.3) * 1.7 + uColor * rim * 0.7;
            float alpha = clamp(0.72 + min(lines, 1.0) * 0.28 + rim * 0.3, 0.0, 1.0);
            gl_FragColor = vec4(col * uBlink, alpha);
        }`
});

const ballGeo = new THREE.SphereGeometry(1, 64, 48);
const ball = new THREE.Mesh(ballGeo, ballMat);

const ballGlow = glowSprite(BALL_LOOKS.normal.glow, 2.7, 0.18);
ball.add(ballGlow);

// Energy nucleus inside the shell: a small icosahedron cage that spins against the roll
const nucleusMat = new THREE.MeshBasicMaterial({ color: BALL_LOOKS.normal.glow });
const nucleus = new THREE.Group();
nucleus.add(new THREE.Mesh(tubeEdges(new THREE.IcosahedronGeometry(0.42, 0), 0.018), nucleusMat));
nucleus.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), nucleusMat));
ball.add(nucleus);

const coreLight = new THREE.PointLight(0x00ffff, 1.3, 12);
ball.add(coreLight);
scene.add(ball);

function setBallLook(type) {
    const look = BALL_LOOKS[type] || BALL_LOOKS.normal;
    ballMat.uniforms.uColor.value.setHex(look.glow);
    ballGlow.material.color.setHex(look.glow);
    nucleusMat.color.setHex(look.glow);
    coreLight.color.setHex(look.light);
    if (typeof trailMat !== 'undefined') trailMat.uniforms.uColor.value.setHex(look.glow);
}

// Thin ring on the track under the ball (shows where you will land)
const groundRing = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.06, 64), additiveMat(0x29f3ff, 0.7));
groundRing.rotation.x = -Math.PI / 2;
const groundGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x29f3ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
groundGlow.rotation.x = -Math.PI / 2;
scene.add(groundRing, groundGlow);
