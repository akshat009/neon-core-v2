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

// Distance from each vertex to the two ends of a track piece (aEnd.x = far end the ball rolls
// towards (-z), aEnd.y = near end). Linear along z, so it interpolates exactly; the road shader
// uses it to mark where a platform stops, so gaps read clearly even on a dim phone screen.
function addEndDistances(geo, length) {
    const pos = geo.attributes.position;
    const ends = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
        const z = pos.getZ(i);
        ends[i * 2] = z + length / 2;
        ends[i * 2 + 1] = length / 2 - z;
    }
    geo.setAttribute('aEnd', new THREE.BufferAttribute(ends, 2));
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

// Neon highway surface. One shader for every face of a platform box:
//   top    = glossy dark road, dashed glowing lane lines, neon glow along both edges,
//            faint grid, pink horizon reflection at grazing angles
//   sides  = dark panels with a bright top edge and a soft underglow
//   ends   = amber hazard chevrons and a hot lip where the road drops away; the end wall
//            facing the camera glows, so the next platform stands out across a gap
// uTime is set in js/world.js. Fog is applied by hand (same falloff as the scene fog).
function makeRoadMat(halfWidth, edgeHex, lanes) {
    return new THREE.ShaderMaterial({
        extensions: { derivatives: true },
        uniforms: {
            uTime: { value: 0 },
            uHalfW: { value: halfWidth },
            uEdge: { value: new THREE.Color(edgeHex) },
            uLanes: { value: lanes ? 1 : 0 }
        },
        vertexShader: `
            attribute vec2 aEnd;
            varying vec3 vLocal; varying vec3 vWorld; varying vec3 vNormalL; varying float vDepth; varying vec2 vEnd;
            void main() {
                vLocal = position;
                vEnd = aEnd;
                vNormalL = normal;
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vWorld = wp.xyz;
                vec4 mv = viewMatrix * wp;
                vDepth = -mv.z;
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: `
            uniform float uTime; uniform float uHalfW; uniform vec3 uEdge; uniform float uLanes;
            varying vec3 vLocal; varying vec3 vWorld; varying vec3 vNormalL; varying float vDepth; varying vec2 vEnd;
            const vec3 WARN = vec3(1.0, 0.56, 0.12);

            float lineAA(float d, float w) { float fw = fwidth(d); return 1.0 - smoothstep(w, w + fw * 1.5, abs(d)); }

            void main() {
                vec3 col;
                if (vNormalL.y > 0.5) {
                    // ---- road top ----
                    float x = vLocal.x, ax = abs(x), z = vWorld.z;
                    float edgeDist = uHalfW - ax;
                    col = mix(vec3(0.010, 0.014, 0.032), vec3(0.030, 0.018, 0.070), smoothstep(uHalfW * 0.2, uHalfW, ax));

                    // faint 2-unit grid
                    vec2 gp = vec2(x, z) / 2.0;
                    vec2 gd = abs(fract(gp - 0.5) - 0.5) / fwidth(gp);
                    col += vec3(0.10, 0.45, 0.65) * (1.0 - min(min(gd.x, gd.y), 1.0)) * 0.07;

                    // neon glow along both edges + a crisp inner line
                    col += uEdge * exp(-edgeDist * 2.4) * 0.55;
                    col += uEdge * lineAA(edgeDist - 0.35, 0.025) * 0.9;

                    // dashed lane lines with a soft glow
                    if (uLanes > 0.5) {
                        float laneX = uHalfW / 3.0;
                        float dl = ax - laneX;
                        float dash = step(0.42, fract(z / 4.0));
                        col += vec3(0.55, 0.95, 1.0) * lineAA(dl, 0.045) * dash * 0.95;
                        col += uEdge * exp(-abs(dl) * 5.0) * 0.06;
                        // centre line: thin, magenta
                        col += vec3(1.0, 0.25, 0.7) * lineAA(x, 0.02) * step(0.5, fract(z / 2.0 + 0.25)) * 0.45;
                    }

                    // glossy reflection of the pink horizon at grazing angles
                    vec3 v = normalize(cameraPosition - vWorld);
                    float fres = pow(1.0 - max(v.y, 0.0), 4.0);
                    col += vec3(0.55, 0.10, 0.45) * fres * 0.55;

                    // slow light sweeps rolling towards the camera
                    float sweep = fract((z - uTime * 18.0) / 36.0);
                    col += uEdge * smoothstep(0.0, 0.04, sweep) * (1.0 - smoothstep(0.04, 0.16, sweep)) * 0.05;

                    // ---- where the road ends ----
                    float dFar = vEnd.x, dNear = vEnd.y;
                    float band = 1.0 - smoothstep(2.8, 3.3, dFar);                  // last ~3 units
                    float chev = step(0.55, fract((dFar + ax * 0.55) / 1.1));        // V chevrons
                    col += WARN * chev * band * 0.62;
                    col += WARN * exp(-dFar * 2.2) * 0.75;                           // warm glow at the drop
                    col += vec3(1.0, 0.85, 0.6) * lineAA(dFar - 0.14, 0.07) * 1.3;   // hot lip
                    col += uEdge * exp(-dNear * 3.0) * 0.25;                         // landing edge
                    col += vec3(0.75, 1.0, 1.0) * lineAA(dNear - 0.14, 0.06) * 0.8;
                } else if (vNormalL.y < -0.5) {
                    col = vec3(0.004, 0.004, 0.012);                       // underside
                } else {
                    // ---- sides ----
                    float y = vLocal.y;                                      // -0.5 .. 0.5
                    col = mix(vec3(0.006, 0.006, 0.02), vec3(0.02, 0.02, 0.05), y + 0.5);
                    col += uEdge * smoothstep(0.38, 0.5, y) * 0.9;           // bright top edge
                    col += vec3(1.0, 0.25, 0.7) * smoothstep(-0.38, -0.5, y) * 0.35;   // underglow
                    float u = abs(vNormalL.x) > 0.5 ? vWorld.z : vWorld.x;
                    col += uEdge * lineAA(fract(u / 3.0) - 0.5, 0.01) * 0.12;          // panel seams
                    if (vNormalL.z > 0.5) {
                        // end wall facing the camera: the edge of the next platform across a gap
                        col += uEdge * (0.08 + 0.3 * smoothstep(0.0, 0.5, y));
                        col += vec3(0.8, 1.0, 1.0) * smoothstep(0.36, 0.5, y) * 0.6;
                    } else if (vNormalL.z < -0.5) {
                        col += WARN * smoothstep(0.2, 0.5, y) * 0.5;                   // far wall, seen from below
                    }
                }
                float fogK = exp(-pow(0.02 * vDepth, 2.0));
                col = mix(vec3(0.03, 0.015, 0.06), col, fogK);
                gl_FragColor = vec4(col, 1.0);
            }`
    });
}
const floorMat = makeRoadMat(7, 0x29f3ff, true);
const movFloorMat = makeRoadMat(3, 0xff3df5, false);
const edgeMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.18 });
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

// Main platform: 14 wide, 1 tall. Collision code reads geometry.parameters, so it stays a BoxGeometry.
function createPlatform(length) {
    const geo = new THREE.BoxGeometry(14, 1, length);
    scaleBoxUVs(geo, 14, 1, length);
    addEndDistances(geo, length);
    const plat = new THREE.Mesh(geo, floorMat);

    const railGeo = new THREE.BoxGeometry(0.05, 0.04, length);  // thin bright side rails
    for (const x of [-6.97, 6.97]) {
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.set(x, 0.52, 0);
        plat.add(rail);
    }
    decoratePlatform(plat, length);   // neon arch (js/world.js)
    return plat;
}

const movPlatGeo = new THREE.BoxGeometry(6, 0.5, 4);
scaleBoxUVs(movPlatGeo, 6, 0.5, 4);
addEndDistances(movPlatGeo, 4);
const movPlatFrameGeo = tubeEdges(movPlatGeo, 0.02);
const movPlatFrameMat = new THREE.MeshBasicMaterial({ color: 0xff3df5 });

function createMovingPlatform() {
    const mPlat = new THREE.Mesh(movPlatGeo, movFloorMat);
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

// Core morphs (the items that change the ball): a hex frame holding a small hologram of the
// ball form you will turn into, over a light beam, with an icon on the floor pad.
//   orange "big"   = heavy core: bigger, jumps higher  → big orange ball, up-arrows
//   green  "small" = micro core: smaller, faster       → small green ball, lightning bolt
const POWERUP_COLORS = { big: 0xffa12e, small: 0x45ff6a };

function makePowerupIcon(type) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    g.lineCap = g.lineJoin = 'round';
    const glow = type === 'big' ? '#ff8a1a' : '#2dff6a';
    const main = type === 'big' ? '#ffc070' : '#9dffb4';
    const draw = (width, color, blur) => {
        g.shadowColor = glow; g.shadowBlur = blur;
        g.strokeStyle = color; g.fillStyle = color; g.lineWidth = width;
        if (type === 'big') {                                    // two stacked up-arrows
            for (const y of [0, 62]) {
                g.beginPath(); g.moveTo(62, 140 + y - 30); g.lineTo(128, 74 + y - 30); g.lineTo(194, 140 + y - 30); g.stroke();
            }
        } else {                                                 // lightning bolt
            g.beginPath();
            g.moveTo(150, 34); g.lineTo(78, 140); g.lineTo(126, 140); g.lineTo(104, 224);
            g.lineTo(182, 112); g.lineTo(132, 112); g.closePath();
            if (width > 8) g.stroke(); else g.fill();
        }
    };
    draw(26, main, 24);        // thick glowing stroke
    draw(8, '#ffffff', 6);     // bright core
    return new THREE.CanvasTexture(c);
}

const hexFrameGeo = tubeEdges(new THREE.CylinderGeometry(0.86, 0.86, 0.16, 6).rotateX(Math.PI / 2), 0.022);
const hexFillGeo = new THREE.CircleGeometry(0.84, 6).rotateZ(Math.PI / 2);
const iconGeo = new THREE.PlaneGeometry(1.1, 1.1).rotateX(-Math.PI / 2);   // lies on the floor pad
const MORPH_BALL_SIZE = { big: 0.6, small: 0.3 };
const morphBallGeo = new THREE.SphereGeometry(1, 32, 24);
const beamGeo = new THREE.CylinderGeometry(0.5, 0.78, 1.0, 24, 1, true);
const padGeo = new THREE.RingGeometry(0.72, 0.84, 6).rotateX(-Math.PI / 2).rotateY(Math.PI / 6);
const POWERUP_MATS = {};
for (const type of ['big', 'small']) {
    const col = POWERUP_COLORS[type];
    POWERUP_MATS[type] = {
        frame: new THREE.MeshBasicMaterial({ color: col }),
        fill: new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
        icon: new THREE.MeshBasicMaterial({ map: makePowerupIcon(type), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
        ball: null,   // made on first use: a copy of the player ball's material in this colour
        beam: new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
        pad: new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })
    };
}

// Morphs are placed at y 1.5 (js/level.js); the track top is y 0.5.
// userData.inner sways and bobs, userData.core (the hex frame) turns,
// userData.orb (the hologram ball) rolls (js/effects.js).
function createPowerup(type, phase) {
    const m = POWERUP_MATS[type];
    if (!m.ball) {
        m.ball = ballMat.clone();
        m.ball.uniforms.uColor.value.setHex(POWERUP_COLORS[type]);
    }
    const g = new THREE.Group();
    const inner = new THREE.Group();
    const frame = new THREE.Mesh(hexFrameGeo, m.frame);
    inner.add(frame);
    inner.add(new THREE.Mesh(hexFillGeo, m.fill));
    const orb = new THREE.Mesh(morphBallGeo, m.ball);
    orb.scale.setScalar(MORPH_BALL_SIZE[type]);
    inner.add(orb);
    inner.add(glowSprite(POWERUP_COLORS[type], 2.6, 0.2));
    g.add(inner);

    const floorY = 0.5 - 1.5 + 0.03;
    const beam = new THREE.Mesh(beamGeo, m.beam);       // light beam from the floor up to the frame
    beam.position.y = -0.5;
    const pad = new THREE.Mesh(padGeo, m.pad);           // hex ring on the floor
    pad.position.y = floorY;
    const icon = new THREE.Mesh(iconGeo, m.icon);        // what the morph does, painted on the pad
    icon.position.y = floorY + 0.005;
    g.add(beam, pad, icon);

    g.userData = { type: type, inner: inner, core: frame, orb: orb, phase: phase };
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
