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
renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_TOUCH ? 1.5 : 2));
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
    emissive: 0xffffff, emissiveMap: gridTex, emissiveIntensity: 0.16
});
const edgeMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.5 });
const railMat = new THREE.MeshBasicMaterial({ color: 0x35f4ff });
const laneMat = new THREE.MeshBasicMaterial({ color: 0x1aa6c8, transparent: true, opacity: 0.55 });

// Main platform: 14 wide, 1 tall. Collision code reads geometry.parameters, so it stays a BoxGeometry.
function createPlatform(length) {
    const geo = new THREE.BoxGeometry(14, 1, length);
    scaleBoxUVs(geo, 14, 1, length);
    const plat = new THREE.Mesh(geo, floorMat);

    const railGeo = new THREE.BoxGeometry(0.16, 0.1, length);   // bright side rails
    for (const x of [-6.95, 6.95]) {
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.set(x, 0.55, 0);
        plat.add(rail);
    }
    const laneGeo = new THREE.BoxGeometry(0.06, 0.02, length);  // dim lane lines
    for (const x of [-2.35, 2.35]) {
        const lane = new THREE.Mesh(laneGeo, laneMat);
        lane.position.set(x, 0.51, 0);
        plat.add(lane);
    }
    return plat;
}

const movPlatGeo = new THREE.BoxGeometry(6, 0.5, 4);
scaleBoxUVs(movPlatGeo, 6, 0.5, 4);
const movPlatFrameGeo = tubeEdges(movPlatGeo, 0.05);
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
gridFloor.material.opacity = 0.45;
scene.add(gridFloor);

// =========================================================
// Pickups and hurdles
// =========================================================

// Cyan data: glowing octahedron outline
const dataShape = new THREE.OctahedronGeometry(0.7);
const dataFrameGeo = tubeEdges(dataShape, 0.035);
const dataFrameMat = new THREE.MeshBasicMaterial({ color: 0x5ff7ff });
const dataFillMat = additiveMat(0x1ec8ff, 0.16);

function createData(phase) {
    const g = new THREE.Group();
    const inner = new THREE.Group();          // inner spins and bobs; outer stays put for collisions
    inner.add(new THREE.Mesh(dataShape, dataFillMat));
    inner.add(new THREE.Mesh(dataFrameGeo, dataFrameMat));
    inner.add(glowSprite(0x29d8ff, 3.2, 0.35));
    g.add(inner);
    g.userData = { inner: inner, phase: phase };
    return g;
}

// Red hurdles: solid faceted octahedron with bright edges
const mineShape = new THREE.OctahedronGeometry(0.95);
const mineMat = new THREE.MeshStandardMaterial({ color: 0xff1030, emissive: 0xe0001c, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.2, flatShading: true });
const mineFrameGeo = tubeEdges(mineShape, 0.03);
const mineFrameMat = new THREE.MeshBasicMaterial({ color: 0xff4458 });

function createMine() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(mineShape, mineMat);
    const frame = new THREE.Mesh(mineFrameGeo, mineFrameMat);
    body.scale.y = frame.scale.y = 1.15;
    g.add(body, frame, glowSprite(0xff1030, 3.4, 0.35));
    return g;
}

// Power-up boxes: orange = heavy (high jump), green = micro (fast)
const POWERUP_COLORS = { big: 0xffa12e, small: 0x45ff6a };
const boxShape = new THREE.BoxGeometry(1.3, 1.3, 1.3);
const boxFrameGeo = tubeEdges(boxShape, 0.045);
const powerupFrameMats = { big: new THREE.MeshBasicMaterial({ color: POWERUP_COLORS.big }), small: new THREE.MeshBasicMaterial({ color: POWERUP_COLORS.small }) };
const powerupFillMats = { big: additiveMat(POWERUP_COLORS.big, 0.1), small: additiveMat(POWERUP_COLORS.small, 0.1) };

function createPowerup(type, phase) {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    inner.add(new THREE.Mesh(boxShape, powerupFillMats[type]));
    inner.add(new THREE.Mesh(boxFrameGeo, powerupFrameMats[type]));
    inner.add(glowSprite(POWERUP_COLORS[type], 3.6, 0.35));
    g.add(inner);
    g.userData = { type: type, inner: inner, phase: phase };
    return g;
}

// =========================================================
// Player ball: plasma core with energy veins, rim light and glow
// =========================================================

const BALL_LOOKS = {
    normal: { glow: 0x29f3ff, core: 0x063a52, light: 0x00ffff },
    big:    { glow: 0xffa12e, core: 0x4a2200, light: 0xffaa00 },
    small:  { glow: 0x45ff6a, core: 0x0a4a1c, light: 0x00ff00 }
};

const ballMat = new THREE.ShaderMaterial({
    uniforms: {
        uTime:  { value: 0 },
        uColor: { value: new THREE.Color(BALL_LOOKS.normal.glow) },
        uCore:  { value: new THREE.Color(BALL_LOOKS.normal.core) }
    },
    vertexShader: `
        varying vec3 vPos; varying vec3 vNormal; varying vec3 vView;
        void main() {
            vPos = position;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vNormal = normalize(normalMatrix * normal);
            vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
        }`,
    fragmentShader: `
        uniform float uTime; uniform vec3 uColor; uniform vec3 uCore;
        varying vec3 vPos; varying vec3 vNormal; varying vec3 vView;
        float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float noise(vec3 x) {
            vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                       mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
        }
        void main() {
            float n = noise(vPos * 2.6 + uTime * 0.5) * 0.65 + noise(vPos * 5.5 - uTime * 0.8) * 0.35;
            float veins = 1.0 - smoothstep(0.0, 0.035, abs(n - 0.5));
            float facing = max(dot(vNormal, vView), 0.0);
            float rim = pow(1.0 - facing, 2.2);
            vec3 col = uCore + uColor * (0.25 + pow(facing, 1.5) * 0.65) + (uColor * 0.8 + 0.12) * veins * 0.8 + uColor * rim * 1.4;
            gl_FragColor = vec4(col, 1.0);
        }`
});

const ballGeo = new THREE.SphereGeometry(1, 48, 48);
const ball = new THREE.Mesh(ballGeo, ballMat);

const ballGlow = glowSprite(BALL_LOOKS.normal.glow, 4.2, 0.6);
ball.add(ballGlow);

const coreLight = new THREE.PointLight(0x00ffff, 2.0, 15);
ball.add(coreLight);
scene.add(ball);

function setBallLook(type) {
    const look = BALL_LOOKS[type] || BALL_LOOKS.normal;
    ballMat.uniforms.uColor.value.setHex(look.glow);
    ballMat.uniforms.uCore.value.setHex(look.core);
    ballGlow.material.color.setHex(look.glow);
    coreLight.color.setHex(look.light);
}

// Glow ring on the track under the ball (shows where you will land)
const groundRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.2, 40), additiveMat(0x29f3ff, 0.5));
groundRing.rotation.x = -Math.PI / 2;
const groundGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x29f3ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
groundGlow.rotation.x = -Math.PI / 2;
scene.add(groundRing, groundGlow);
