// =========================================================
// Neon Core — the world around the track
//
// • Sky: deep navy to a purple horizon with a hot pink glow band and a striped synthwave sun
// • City: neon skyline on both sides (one instanced draw call), buildings recycle ahead of you
// • Arches: a neon arch over the front edge of every platform (added from createPlatform)
// • Rails: light packets race along the side rails towards the camera
// Everything is drawn without lights or shadows so it stays cheap on phones.
// =========================================================

// ---------- Sky dome (follows the camera) ----------

const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
        varying vec3 vDir;
        void main() {
            vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
    fragmentShader: `
        uniform float uTime;
        varying vec3 vDir;
        void main() {
            vec3 d = normalize(vDir);
            float h = d.y;
            vec3 zen = vec3(0.010, 0.014, 0.045);
            vec3 mid = vec3(0.060, 0.025, 0.150);
            vec3 hor = vec3(0.300, 0.060, 0.380);
            vec3 col = mix(hor, mid, smoothstep(0.0, 0.16, h));
            col = mix(col, zen, smoothstep(0.16, 0.55, h));
            col = mix(col, vec3(0.012, 0.010, 0.035), smoothstep(0.0, -0.2, h));   // below the horizon
            col += vec3(1.0, 0.22, 0.62) * exp(-abs(h) * 30.0) * 0.3;              // horizon glow band

            // Synthwave sun straight ahead, striped in its lower half
            vec3 sunDir = normalize(vec3(0.0, 0.10, -1.0));
            float ang = acos(clamp(dot(d, sunDir), -1.0, 1.0));
            float R = 0.15;
            float v = clamp((d.y - (sunDir.y - R)) / (2.0 * R), 0.0, 1.0);          // 0 bottom .. 1 top
            vec3 sunCol = mix(vec3(1.0, 0.16, 0.55), vec3(1.0, 0.82, 0.32), v);
            float gap = 1.0 - step(0.45, v) ;                                         // stripes only below the middle
            float stripes = step(0.62 - (0.45 - v) * 0.9, fract(v * 14.0 - uTime * 0.25));
            float sun = (1.0 - smoothstep(R - 0.004, R, ang)) * step(0.0, h) * (1.0 - gap * stripes);
            col = mix(col, sunCol * 0.72, sun);
            col += vec3(1.0, 0.25, 0.6) * exp(-max(ang - R, 0.0) * 9.0) * 0.12 * step(0.0, h + 0.02);

            // A few faint stars
            vec3 sp = floor(d * 140.0);
            float star = step(0.9975, fract(sin(dot(sp, vec3(12.9898, 78.233, 37.719))) * 43758.5453));
            col += vec3(0.7, 0.8, 1.0) * star * smoothstep(0.2, 0.5, h) * 0.8;

            gl_FragColor = vec4(col, 1.0);
        }`
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(220, 32, 16), skyMat);
sky.renderOrder = -10;
sky.frustumCulled = false;
scene.add(sky);
scene.background = null;

// ---------- City skyline ----------

const CITY_COUNT = 150;
const CITY_DEPTH = 230;           // buildings are spread over this many units ahead of the camera
const CITY_COLORS = [0x29f3ff, 0xff3fb4, 0x9b5cff, 0x4aa8ff, 0xff3fb4];

const cityGeo = new THREE.BoxGeometry(1, 1, 1);
cityGeo.translate(0, 0.5, 0);    // base at y = 0

const cityMat = new THREE.ShaderMaterial({
    fog: false,
    uniforms: { uHaze: { value: new THREE.Color(0x2a0a3a) } },
    vertexShader: `
        varying vec3 vWorld; varying vec3 vLocal; varying vec3 vNormalL; varying vec3 vTint; varying float vDepth;
        void main() {
            vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
            vWorld = wp.xyz;
            vLocal = position;
            vNormalL = normal;
            #ifdef USE_INSTANCING_COLOR
                vTint = instanceColor;
            #else
                vTint = vec3(0.16, 0.95, 1.0);
            #endif
            vec4 mv = viewMatrix * wp;
            vDepth = -mv.z;
            gl_Position = projectionMatrix * mv;
        }`,
    fragmentShader: `
        uniform vec3 uHaze;
        varying vec3 vWorld; varying vec3 vLocal; varying vec3 vNormalL; varying vec3 vTint; varying float vDepth;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
            vec3 col = vec3(0.018, 0.016, 0.05);
            if (abs(vNormalL.y) < 0.5) {
                float u = abs(vNormalL.x) > 0.5 ? vWorld.z : vWorld.x;
                vec2 cell = vec2(u / 1.1, vWorld.y / 1.5);
                vec2 f = fract(cell);
                float win = step(0.36, f.x) * step(f.x, 0.64) * step(0.38, f.y) * step(f.y, 0.62);
                float lit = step(0.7, hash(floor(cell) + floor(vWorld.xz * 0.05)));
                col += vTint * win * lit * 0.5;
                col += vTint * 0.04 * smoothstep(0.0, 1.0, vLocal.y);                // faint facade gradient
                col += vTint * smoothstep(0.985, 1.0, vLocal.y) * 1.4;              // bright roof edge
            } else {
                col += vTint * 0.25;                                                 // roof top
            }
            float haze = smoothstep(30.0, 170.0, vDepth);
            col = mix(col, uHaze, haze * 0.9);
            gl_FragColor = vec4(col, 1.0);
        }`
});

const city = new THREE.InstancedMesh(cityGeo, cityMat, CITY_COUNT);
city.frustumCulled = false;
const cityData = [];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

function placeBuilding(i, z) {
    const b = cityData[i];
    const side = i % 2 ? 1 : -1;
    b.x = side * (34 + Math.random() * 60);
    b.z = z;
    b.w = 5 + Math.random() * 9;
    b.d = 5 + Math.random() * 9;
    b.h = 20 + Math.random() * 60 * (Math.random() < 0.25 ? 1.5 : 1);
    _p.set(b.x, -45, b.z);
    _s.set(b.w, b.h, b.d);
    _m.compose(_p, _q, _s);
    city.setMatrixAt(i, _m);
    city.instanceMatrix.needsUpdate = true;
}

const _c = new THREE.Color();
for (let i = 0; i < CITY_COUNT; i++) {
    cityData.push({});
    placeBuilding(i, 20 - Math.random() * CITY_DEPTH);
    city.setColorAt(i, _c.setHex(CITY_COLORS[i % CITY_COLORS.length]));
}
city.instanceColor.needsUpdate = true;
scene.add(city);

// Buildings that fall behind the camera move to the far end, so the skyline never runs out
function updateCity() {
    const cz = camera.position.z;
    for (let i = 0; i < CITY_COUNT; i++) {
        const b = cityData[i];
        if (b.z > cz + 25) placeBuilding(i, b.z - CITY_DEPTH);
        else if (b.z < cz - CITY_DEPTH) placeBuilding(i, b.z + CITY_DEPTH);   // after a respawn far back
    }
}

// ---------- Arches over the track ----------

const ARCH_RADIUS = 9.4;
const archGeo = new THREE.TorusGeometry(ARCH_RADIUS, 0.07, 6, 64, Math.PI);
// Arches fade out as the camera gets close, so they never fill the screen when you pass under
function archMat(hex) {
    return new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color(hex) } },
        vertexShader: `
            varying float vDepth;
            void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `
            uniform vec3 uColor; varying float vDepth;
            void main() {
                float a = smoothstep(6.0, 16.0, vDepth) * exp(-pow(0.016 * vDepth, 2.0));
                gl_FragColor = vec4(uColor * a, a);
            }`
    });
}
const archMats = [archMat(0x29f3ff), archMat(0xff3fb4)];
const archFootGeo = new THREE.BoxGeometry(0.5, 0.18, 0.5);
const archFootMats = [new THREE.MeshBasicMaterial({ color: 0x29f3ff }), new THREE.MeshBasicMaterial({ color: 0xff3fb4 })];
let archCount = 0;

// Called from createPlatform() in js/scene.js
function decoratePlatform(plat, length) {
    const k = archCount++ % 2;
    const arch = new THREE.Mesh(archGeo, archMats[k]);
    arch.position.set(0, 0.5, length / 2 - 0.3);
    plat.add(arch);
    for (const sx of [-1, 1]) {
        const foot = new THREE.Mesh(archFootGeo, archFootMats[k]);
        foot.position.set(sx * ARCH_RADIUS, 0.5, length / 2 - 0.3);
        plat.add(foot);
    }
}

// ---------- Per frame (called from updateEffects in js/effects.js) ----------

function updateWorld(dt) {
    const t = performance.now() / 1000;
    sky.position.copy(camera.position);
    skyMat.uniforms.uTime.value = t;
    railMat.uniforms.uTime.value = t;
    updateCity();
}
