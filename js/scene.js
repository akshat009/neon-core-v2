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
const railMat = new THREE.MeshBasicMaterial({ color: 0x5ff8ff });
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

// Cyan data: octahedron outline with a small solid core
const dataShape = new THREE.OctahedronGeometry(0.7);
const dataFrameGeo = tubeEdges(dataShape, 0.016);
const dataCoreGeo = new THREE.OctahedronGeometry(0.2);
const dataFrameMat = new THREE.MeshBasicMaterial({ color: 0x6ff8ff });
const dataCoreMat = new THREE.MeshBasicMaterial({ color: 0xbffcff });
const dataFillMat = additiveMat(0x1ec8ff, 0.06);

function createData(phase) {
    const g = new THREE.Group();
    const inner = new THREE.Group();          // inner spins and bobs; outer stays put for collisions
    inner.add(new THREE.Mesh(dataShape, dataFillMat));
    inner.add(new THREE.Mesh(dataFrameGeo, dataFrameMat));
    inner.add(new THREE.Mesh(dataCoreGeo, dataCoreMat));
    inner.add(glowSprite(0x29d8ff, 1.8, 0.18));
    g.add(inner);
    g.userData = { inner: inner, phase: phase };
    return g;
}

// Red hurdles: dark faceted octahedron with sharp red edges
const mineShape = new THREE.OctahedronGeometry(0.95);
const mineMat = new THREE.MeshStandardMaterial({ color: 0x6a0014, emissive: 0xff0022, emissiveIntensity: 0.3, roughness: 0.25, metalness: 0.5, flatShading: true });
const mineFrameGeo = tubeEdges(mineShape, 0.014);
const mineFrameMat = new THREE.MeshBasicMaterial({ color: 0xff3a50 });

function createMine() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(mineShape, mineMat);
    const frame = new THREE.Mesh(mineFrameGeo, mineFrameMat);
    body.scale.y = frame.scale.y = 1.15;
    g.add(body, frame, glowSprite(0xff1030, 2.2, 0.2));
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
        uColor: { value: new THREE.Color(BALL_LOOKS.normal.glow) }
    },
    extensions: { derivatives: true },
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
        #define PI 3.14159265
        uniform float uTime; uniform vec3 uColor;
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
            gl_FragColor = vec4(col, 1.0);
        }`
});

const ballGeo = new THREE.SphereGeometry(1, 64, 48);
const ball = new THREE.Mesh(ballGeo, ballMat);

const ballGlow = glowSprite(BALL_LOOKS.normal.glow, 2.7, 0.18);
ball.add(ballGlow);

const coreLight = new THREE.PointLight(0x00ffff, 1.3, 12);
ball.add(coreLight);
scene.add(ball);

function setBallLook(type) {
    const look = BALL_LOOKS[type] || BALL_LOOKS.normal;
    ballMat.uniforms.uColor.value.setHex(look.glow);
    ballGlow.material.color.setHex(look.glow);
    coreLight.color.setHex(look.light);
    if (typeof trailMat !== 'undefined') trailMat.uniforms.uColor.value.setHex(look.glow);
}

// Thin ring on the track under the ball (shows where you will land)
const groundRing = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.06, 64), additiveMat(0x29f3ff, 0.7));
groundRing.rotation.x = -Math.PI / 2;
const groundGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x29f3ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
groundGlow.rotation.x = -Math.PI / 2;
scene.add(groundRing, groundGlow);
