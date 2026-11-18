// Neon Core: Racer prototype — light-bike model (built from primitives, no model files)
//
// makeBike(color) → { root, lean, wheels, trail, setSpeed(v), punch(dir), crash(t) }
//   root  placed on the road by race.js; lean tilts the bike into turns

function makeBike(color, opts = {}) {
    const c = new THREE.Color(color);
    const root = new THREE.Group();
    const lean = new THREE.Group();
    root.add(lean);

    const dark = new THREE.MeshStandardMaterial({ color: 0x0c0c16, metalness: 0.7, roughness: 0.35 });
    const glow = new THREE.MeshBasicMaterial({ color: c });
    const glowSoft = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55 });
    const visor = new THREE.MeshBasicMaterial({ color: opts.visor || 0xffffff });

    // Wheels: dark disc + glowing rim (spin around their axle)
    const wheels = [];
    [-0.95, 0.95].forEach((z) => {
        const w = new THREE.Group();
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.22, 20), dark);
        disc.rotation.z = Math.PI / 2;
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.07, 6, 28), glow);
        rim.rotation.y = Math.PI / 2;
        const hub = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 16), glow);
        hub.rotation.y = Math.PI / 2;
        w.add(disc, rim, hub);
        w.position.set(0, 0.55, z);
        lean.add(w);
        wheels.push(w);
    });

    // Body: low fairing between the wheels, with neon side strips
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 1.9), dark);
    body.position.set(0, 0.85, 0);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 4), dark);
    nose.rotation.x = -Math.PI / 2; nose.rotation.y = Math.PI / 4;
    nose.position.set(0, 0.9, -1.15);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.6), dark);
    tail.position.set(0, 1.05, 0.85); tail.rotation.x = -0.25;
    [-0.26, 0.26].forEach((x) => {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 2.2), glow);
        strip.position.set(x, 0.86, -0.05);
        lean.add(strip);
    });
    const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.05), visor);
    headlight.position.set(0, 0.98, -1.5);
    const taillight = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.05), new THREE.MeshBasicMaterial({ color: 0xff2040 }));
    taillight.position.set(0, 1.12, 1.16);
    lean.add(body, nose, tail, headlight, taillight);

    // Rider: crouched torso, helmet with a glowing visor, arms to the bars
    const rider = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.34), dark);
    torso.position.set(0, 1.42, 0.12); torso.rotation.x = -0.75;
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), dark);
    helmet.position.set(0, 1.78, -0.25);
    const vis = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.1), visor);
    vis.position.set(0, 1.8, -0.43);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.5), glow);
    stripe.position.set(0, 1.45, 0.1); stripe.rotation.x = -0.75;
    const arms = [];
    [-0.24, 0.24].forEach((x) => {
        const arm = new THREE.Group();
        const a = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.62), dark);
        a.position.set(0, 0, -0.31);
        const fist = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), glow);
        fist.position.set(0, 0, -0.62);
        arm.add(a, fist);
        arm.position.set(x, 1.55, -0.05); arm.rotation.x = 0.55;
        rider.add(arm);
        arms.push(arm);
    });
    rider.add(torso, helmet, vis, stripe);
    lean.add(rider);

    // Light streak behind the bike: a stretched glowing ribbon that grows with speed
    const trailMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uCol: { value: c } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 uCol; varying vec2 vUv; void main(){ float a = vUv.y * (1.0 - abs(vUv.x - 0.5) * 2.0);   /* bright at the bike, fading behind */ gl_FragColor = vec4(uCol, a * 0.8); }'
    });
    const trailGeo = new THREE.PlaneGeometry(0.5, 1);
    trailGeo.translate(0, -0.5, 0);
    trailGeo.rotateX(-Math.PI / 2);                      // lies flat, stretches backwards (+z)
    const trail = new THREE.Mesh(trailGeo, trailMat);
    trail.position.set(0, 0.62, 1.2);
    lean.add(trail);

    // A spark burst / shock arc reuses one small glowing sphere
    const shock = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), glowSoft);
    shock.visible = false;
    root.add(shock);

    let punchT = 0, punchDir = 1;
    return {
        root, lean, wheels, trail, shock, color: c,
        setSpeed(v, dt) {
            wheels.forEach((w) => { w.rotation.x -= v * dt / 0.55; });
            trail.scale.set(1, 1, clamp(v * 0.18, 0.2, 9));
        },
        punch(dir) { punchT = 0.28; punchDir = dir; },
        update(dt) {
            if (punchT > 0) {
                punchT -= dt;
                const k = Math.sin((1 - punchT / 0.28) * Math.PI);           // out and back
                const arm = arms[punchDir > 0 ? 1 : 0];
                arm.rotation.x = 0.55 - k * 0.6;
                arm.rotation.z = -punchDir * k * 1.3;
                arm.position.x = (punchDir > 0 ? 0.24 : -0.24) + punchDir * k * 0.5;
                shock.visible = k > 0.4;
                shock.position.set(punchDir * (0.9 + k), 1.5, -0.4);
                shock.scale.setScalar(0.4 + k * 0.6);
            } else {
                arms.forEach((a, i) => { a.rotation.set(0.55, 0, 0); a.position.x = i ? 0.24 : -0.24; });
                shock.visible = false;
            }
        }
    };
}
