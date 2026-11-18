// Neon Core: Racer prototype — the city around the highway, in two zones
//
//   city     NEON CITY: cold megacity, magenta / cyan / yellow signs in English
//   lucknow  NEO-LUCKNOW 2099: warm saffron / teal / pink, Hindi neon signs, domes and
//            minarets on the rooftops, Rumi Darwaza-style gates over the highway,
//            flying auto-rickshaws
//
// Cheap on purpose (budget phones): buildings are one instanced box with windows drawn in the
// shader, signs are textured planes, rain is a line cloud that follows the camera, the "wet
// road" reflections are faked in the road shader (js/track.js).

const ZONES = {
    city: {
        name: 'NEON CITY', seed: 7,
        colA: 0xff2bd6, colB: 0x19f0ff, fog: 0x0d0618, fogDensity: 0.0055,
        skyTop: 0x05020c, skyHorizon: 0x5a0f6e, skyGlow: 0xff2bd6,
        facade: [0x0d0b1a], windows: [0x19f0ff, 0xff2bd6, 0xffe14d, 0x8a6bff],
        signColors: ['#ff2bd6', '#19f0ff', '#ffe14d', '#7cff4d'],
        words: ['NEXUS', 'HOTEL', 'RAMEN', 'ARCADE', 'CYBERDECK', 'SYNTH', 'CLINIC 24/7', 'DATA BANK', 'BAR', 'NOODLE', 'CHROME', 'NIGHT MARKET'],
        flyer: 'car'
    },
    lucknow: {
        name: 'NEO-LUCKNOW', seed: 11, landmark: 'rumi', domes: true,
        colA: 0xff9a1f, colB: 0x19f0c8, fog: 0x160812, fogDensity: 0.0055,
        skyTop: 0x07030a, skyHorizon: 0x6e1f1a, skyGlow: 0xff7a1f,
        facade: [0x16100f], windows: [0xffc46b, 0x19f0c8, 0xff2bd6, 0xffe14d],
        signColors: ['#ff9a1f', '#19f0c8', '#ff2bd6', '#ffe14d'],
        words: ['चाय', 'लखनऊ', 'नवाब', 'कबाब', 'पान', 'सिनेमा', 'होटल', 'बाज़ार', 'हज़रतगंज', 'अमीनाबाद', 'NEO LUCKNOW', 'CHIKAN 2099'],
        flyer: 'auto'
    },
    delhi: {
        name: 'NEO-DELHI', seed: 23, landmark: 'indiagate', domes: true,
        colA: 0xff9933, colB: 0x19ff8a, fog: 0x0c0a12, fogDensity: 0.0055,      // tricolour light
        skyTop: 0x05040a, skyHorizon: 0x3a2a4e, skyGlow: 0xff9933,
        facade: [0x12101a], windows: [0xffffff, 0xff9933, 0x19ff8a, 0x8ab4ff],
        signColors: ['#ff9933', '#ffffff', '#19ff8a', '#ff2bd6'],
        words: ['दिल्ली', 'चाँदनी चौक', 'कनॉट प्लेस', 'पराठे वाली गली', 'मेट्रो', 'छोले भटूरे', 'NEO DELHI', 'RAJPATH 2099', 'DILLI HAAT'],
        flyer: 'auto'
    },
    hyderabad: {
        name: 'NEO-HYDERABAD', seed: 31, landmark: 'charminar', domes: true,
        colA: 0x19f0c8, colB: 0xffd24d, fog: 0x08100f, fogDensity: 0.0055,
        skyTop: 0x030807, skyHorizon: 0x1e4a44, skyGlow: 0xffd24d,
        facade: [0x0d1414], windows: [0x19f0c8, 0xffd24d, 0xff4fd8, 0xffffff],
        signColors: ['#19f0c8', '#ffd24d', '#ff4fd8', '#ffffff'],
        words: ['హైదరాబాద్', 'బిర్యానీ', 'చార్మినార్', 'HITEC CITY', 'IRANI CHAI', 'NEO HYD', 'LAAD BAZAAR', 'PEARL CITY'],
        flyer: 'car'
    },
    jaipur: {
        name: 'NEO-JAIPUR', seed: 41, landmark: 'hawamahal',
        colA: 0xff4fa0, colB: 0xffb347, fog: 0x170910, fogDensity: 0.0055,      // the Pink City
        skyTop: 0x0a0306, skyHorizon: 0x6a2440, skyGlow: 0xff7a5a,
        facade: [0x1c0e14], windows: [0xffb347, 0xff4fa0, 0xffe0a0, 0x19f0ff],
        signColors: ['#ff4fa0', '#ffb347', '#ffe0a0', '#19f0ff'],
        words: ['जयपुर', 'हवा महल', 'पिंक सिटी', 'दाल बाटी', 'जौहरी बाज़ार', 'NEO JAIPUR', 'RAJ BAZAAR', 'AMER 2099'],
        flyer: 'auto'
    },
    chennai: {
        name: 'NEO-CHENNAI', seed: 53, landmark: 'gopuram',
        colA: 0xffd21f, colB: 0xff3b5c, fog: 0x100808, fogDensity: 0.0055,
        skyTop: 0x060303, skyHorizon: 0x4a1a20, skyGlow: 0xffb21f,
        facade: [0x150f10], windows: [0xffd21f, 0xff3b5c, 0x19f0ff, 0xffffff],
        signColors: ['#ffd21f', '#ff3b5c', '#19f0ff', '#7cff4d'],
        words: ['சென்னை', 'இட்லி', 'ஃபில்டர் காபி', 'மெரினா', 'NEO CHENNAI', 'MARINA 2099', 'T. NAGAR', 'KOLLYWOOD'],
        flyer: 'auto'
    }
};

// Script-aware neon font (Android ships Noto fonts for all of these)
function signFont(word) {
    if (/[ఀ-౿]/.test(word)) return '800 70px "Noto Sans Telugu", "Gautami", sans-serif';
    if (/[஀-௿]/.test(word)) return '800 70px "Noto Sans Tamil", "Latha", sans-serif';
    if (/[ऀ-ॿ]/.test(word)) return '800 76px "Noto Sans Devanagari", "Mangal", sans-serif';
    return undefined;
}

const City = {
    group: null, rain: null, flyers: [], flyerMesh: null, sky: null, holos: [],

    build(zoneId, scene) {
        const Z = ZONES[zoneId];
        const rng = makeRng(Z.seed);
        this.group = new THREE.Group();
        scene.add(this.group);
        scene.fog = new THREE.FogExp2(Z.fog, Z.fogDensity);
        scene.background = new THREE.Color(Z.skyTop);

        this.buildSky(Z);
        this.buildGround(Z);
        this.buildBuildings(Z, rng);
        this.buildSigns(Z, rng);
        if (Z.landmark) this.buildLandmarks(Z);
        this.buildFlyers(Z, rng);
        this.buildRain(Z);
    },

    dispose(scene) {
        if (!this.group) return;
        scene.remove(this.group);
        this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } });
        this.group = null; this.flyers = []; this.holos = [];
    },

    buildSky(Z) {
        const g = new THREE.SphereGeometry(500, 24, 12);       // inside the camera's far plane
        const mat = new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false, fog: false,
            uniforms: { uTop: { value: new THREE.Color(Z.skyTop) }, uHor: { value: new THREE.Color(Z.skyHorizon) }, uGlow: { value: new THREE.Color(Z.skyGlow) } },
            vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: `uniform vec3 uTop, uHor, uGlow; varying vec3 vP;
                void main(){ float h = clamp(vP.y, -0.2, 1.0);
                  vec3 c = mix(uHor, uTop, smoothstep(0.0, 0.45, h));
                  c += uGlow * 0.2 * exp(-max(h, 0.0) * 12.0);           // light pollution at the horizon
                  gl_FragColor = vec4(c, 1.0); }`
        });
        this.sky = new THREE.Mesh(g, mat);
        this.group.add(this.sky);
    },

    buildGround(Z) {
        const g = new THREE.PlaneGeometry(4000, 4000);
        const m = new THREE.MeshBasicMaterial({ color: 0x050308, fog: true });
        const ground = new THREE.Mesh(g, m);
        ground.rotation.x = -Math.PI / 2; ground.position.y = -1.6;
        this.group.add(ground);
        this.groundMesh = ground;
    },

    // Tall blocks both sides of the road; windows come from the shader (no textures)
    buildBuildings(Z, rng) {
        const spots = [];
        const p = new THREE.Vector3();
        const clear = Z.landmark ? this.landmarkSpots() : [];                   // keep landmarks free of towers
        const reach = Z.landmark === 'hawamahal' ? 50 : 34;
        for (let s = 0; s < Track.n; s += 9 + rng() * 6) {
            const nearLandmark = clear.some(ls => Math.abs(ls - s) < reach);
            for (const side of [-1, 1]) {
                if (rng() < 0.12) continue;                                     // gaps between blocks
                if (nearLandmark) continue;
                const off = ROAD_HALF + 10 + rng() * 26;
                const w = 8 + rng() * 10, dpt = 8 + rng() * 10;
                const tall = rng() < 0.18 ? 90 + rng() * 80 : 22 + rng() * 55;
                Track.point(s, side * off, 0, p);
                spots.push({ x: p.x, z: p.z, w, d: dpt, h: tall, rot: -Track.heading(s), s, side, off });
                // a second, further row for depth
                if (rng() < 0.6) {
                    Track.point(s, side * (off + 30 + rng() * 40), 0, p);
                    spots.push({ x: p.x, z: p.z, w: w * 1.3, d: dpt * 1.3, h: 40 + rng() * 120, rot: -Track.heading(s), far: true });
                }
            }
        }
        const geo = new THREE.BoxGeometry(1, 1, 1);
        geo.translate(0, 0.5, 0);
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uFog: { value: new THREE.Color(Z.fog) }, uFogD: { value: Z.fogDensity },
                uW0: { value: new THREE.Color(Z.windows[0]) }, uW1: { value: new THREE.Color(Z.windows[1]) },
                uW2: { value: new THREE.Color(Z.windows[2]) }, uW3: { value: new THREE.Color(Z.windows[3]) },
                uFacade: { value: new THREE.Color(Z.facade[0]) }
            },
            vertexShader: `
                attribute float aSeed;
                varying vec3 vB; varying vec3 vN; varying float vDepth; varying float vSeed;
                void main() {
                    vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
                    vB = position * sc;                 // building-space metres
                    vN = normal; vSeed = aSeed;
                    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
                    vDepth = -mv.z;
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: `
                uniform vec3 uFog, uW0, uW1, uW2, uW3, uFacade; uniform float uFogD;
                varying vec3 vB; varying vec3 vN; varying float vDepth; varying float vSeed;
                float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
                void main() {
                    vec3 col = uFacade * (0.8 + 0.4 * hash(vec2(vSeed, 2.0)));
                    if (abs(vN.y) < 0.5) {
                        float u = abs(vN.x) > 0.5 ? vB.z : vB.x;
                        vec2 cell = vec2(floor(u / 2.4), floor(vB.y / 3.2));
                        vec2 f = vec2(fract(u / 2.4), fract(vB.y / 3.2));
                        float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.25, f.y) * step(f.y, 0.75);
                        float h = hash(cell + vSeed * 13.0);
                        float lit = step(0.58, h);
                        vec3 wc = h < 0.7 ? uW0 : h < 0.8 ? uW1 : h < 0.9 ? uW2 : uW3;
                        col = mix(col, wc * (0.55 + 0.6 * hash(cell * 1.7)), win * lit);
                        // a neon band near the top of some towers
                        float band = step(0.7, hash(vec2(vSeed, 9.0))) * (1.0 - smoothstep(0.0, 0.6, abs(vB.y - floor(vB.y / 40.0) * 40.0 - 36.0)));
                        col += uW1 * band * 0.9;
                    }
                    float fog = 1.0 - exp(-pow(vDepth * uFogD, 2.0));
                    gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
                }`
        });
        const inst = new THREE.InstancedMesh(geo, mat, spots.length);
        const seeds = new Float32Array(spots.length);
        const m = new THREE.Matrix4(), qt = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
        spots.forEach((b, i) => {
            qt.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.rot);
            m.compose(ps.set(b.x, -1.6, b.z), qt, sc.set(b.w, b.h, b.d));
            inst.setMatrixAt(i, m);
            seeds[i] = rng() * 100;
        });
        geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
        this.group.add(inst);
        this.spots = spots;

        // Neo-Lucknow: domes and minarets on some near rooftops
        if (Z.domes) {
            const domeGeo = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
            const domeMat = new THREE.MeshStandardMaterial({ color: 0x2a1a18, emissive: Z.colA, emissiveIntensity: 0.22, roughness: 0.5, metalness: 0.3, fog: true });
            const minGeo = new THREE.CylinderGeometry(0.5, 0.7, 1, 8);
            const tipGeo = new THREE.SphereGeometry(1, 10, 8);
            const tipMat = new THREE.MeshBasicMaterial({ color: Z.colB });
            const near = spots.filter(b => !b.far && b.h < 70);
            const domes = near.filter(() => rng() < 0.35);
            const dInst = new THREE.InstancedMesh(domeGeo, domeMat, domes.length);
            const minarets = [];
            domes.forEach((b, i) => {
                const r = Math.min(b.w, b.d) * 0.42;
                m.compose(ps.set(b.x, -1.6 + b.h, b.z), qt.identity(), sc.set(r, r * 1.25, r));
                dInst.setMatrixAt(i, m);
                if (rng() < 0.6) minarets.push({ x: b.x + Math.cos(b.rot) * b.w * 0.45, z: b.z - Math.sin(b.rot) * b.w * 0.45, y: -1.6 + b.h, r });
            });
            this.group.add(dInst);
            const mInst = new THREE.InstancedMesh(minGeo, domeMat, minarets.length);
            const tInst = new THREE.InstancedMesh(tipGeo, tipMat, minarets.length);
            minarets.forEach((mn, i) => {
                const hh = mn.r * 3.2;
                m.compose(ps.set(mn.x, mn.y + hh / 2, mn.z), qt.identity(), sc.set(1, hh, 1)); mInst.setMatrixAt(i, m);
                m.compose(ps.set(mn.x, mn.y + hh + 0.6, mn.z), qt.identity(), sc.set(0.8, 0.8, 0.8)); tInst.setMatrixAt(i, m);
            });
            this.group.add(mInst, tInst);
        }
    },

    // Neon signs on the facades that face the road, and a few big hologram billboards
    buildSigns(Z, rng) {
        const p = new THREE.Vector3();
        const near = this.spots.filter(b => !b.far);
        const texCache = {};
        near.forEach((b) => {
            if (rng() > 0.55) return;
            const word = Z.words[Math.floor(rng() * Z.words.length)];
            const color = Z.signColors[Math.floor(rng() * Z.signColors.length)];
            const key = word + color;
            if (!texCache[key]) texCache[key] = neonSignTexture(word, color, { font: signFont(word) });
            const { tex, aspect, uScale } = texCache[key];
            const hgt = 3 + rng() * 3, wid = Math.min(hgt * aspect, b.d * 1.2);   // b.d runs along the road
            const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: true, side: THREE.DoubleSide });
            mat.map.repeat.set(uScale, 1);
            const plane = new THREE.Mesh(new THREE.PlaneGeometry(wid, wid / aspect), mat);
            // on the facade facing the road (the box's local x is sideways, so half its width),
            // a bit off the wall, turned so the text reads from the road
            Track.point(b.s, b.side * (b.off - b.w / 2 - 0.4), 0, p);
            plane.position.set(p.x, -1.6 + Math.min(b.h - 3, 6 + rng() * Math.max(4, b.h * 0.6)), p.z);
            plane.rotation.y = -Track.heading(b.s) + (b.side > 0 ? -Math.PI / 2 : Math.PI / 2);
            this.group.add(plane);
        });

        // Hologram billboards: big flickering screens above the road at intervals
        const holoMat = (col) => new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
            uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(col) } },
            vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: `uniform float uTime; uniform vec3 uCol; varying vec2 vUv;
                void main(){ float scan = 0.65 + 0.35 * sin(vUv.y * 120.0 - uTime * 6.0);
                  float edge = step(vUv.x, 0.02) + step(0.98, vUv.x) + step(vUv.y, 0.03) + step(0.97, vUv.y);
                  float shape = step(0.3, fract(vUv.x * 3.0 + sin(vUv.y * 6.0 + uTime) * 0.2)) * step(0.2, vUv.y) * step(vUv.y, 0.8);
                  float flick = 0.85 + 0.15 * step(0.5, fract(sin(floor(uTime * 12.0)) * 43758.5));
                  gl_FragColor = vec4(uCol * (shape * 0.22 * scan + edge * 0.6), (0.12 + shape * 0.22 + edge * 0.6) * flick); }`
        });
        for (let s = 200; s < Track.n - 100; s += 260 + rng() * 140) {
            const side = rng() < 0.5 ? -1 : 1;
            const col = Z.colA === undefined ? 0xffffff : (rng() < 0.5 ? Z.colA : Z.colB);
            const mat = holoMat(col);
            const plane = new THREE.Mesh(new THREE.PlaneGeometry(22, 11), mat);
            Track.point(s, side * (ROAD_HALF + 9), 16 + rng() * 10, p);
            plane.position.copy(p);
            plane.rotation.y = -Track.heading(s) - side * 0.5;            // faces back down the road, turned toward it
            this.group.add(plane);
            this.holos.push(mat);
        }
    },

    // ---------- Landmarks (one per zone), every ~650 m, built from simple shapes ----------
    //   rumi       Rumi Darwaza-style gate over the highway (Lucknow)
    //   indiagate  India Gate arch over the highway, tricolour light (Delhi)
    //   charminar  the road runs under Charminar, four minarets (Hyderabad)
    //   hawamahal  Hawa Mahal's pink honeycomb facade beside the road (Jaipur)
    //   gopuram    temple gateway tower over the road, coloured tiers (Chennai)
    // Where the landmarks stand: every ~650 m, only at street level (not on a skyway)
    landmarkSpots() {
        const out = [];
        for (let s = 420; s < RACE_LEN - 60; s += 650) {
            if (Track.height(s) > 1 || Track.height(s - 30) > 1 || Track.height(s + 30) > 1) { s -= 520; continue; }
            out.push(s);
        }
        return out;
    },

    buildLandmarks(Z) {
        const p = new THREE.Vector3();
        const build = { rumi: this.rumi, indiagate: this.indiaGate, charminar: this.charminar, hawamahal: this.hawaMahal, gopuram: this.gopuram }[Z.landmark];
        let i = 0;
        for (const s of this.landmarkSpots()) {
            const g = build.call(this, Z, i++);
            Track.point(s, 0, 0, p);
            g.position.set(p.x, 0, p.z);
            g.rotation.y = -Track.heading(s);
            this.group.add(g);
        }
    },

    stone(color, glow, k = 0.3) { return new THREE.MeshStandardMaterial({ color, emissive: glow, emissiveIntensity: k, roughness: 0.75, fog: true }); },
    neon(color) { return new THREE.MeshBasicMaterial({ color, fog: true }); },
    signBoard(text, color, width) {
        const sg = neonSignTexture(text, color, { font: signFont(text) });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width / sg.aspect), new THREE.MeshBasicMaterial({ map: sg.tex, transparent: true, fog: true }));
        m.material.map.repeat.set(sg.uScale, 1);
        return m;
    },
    box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; },

    rumi(Z) {
        const gate = new THREE.Group(), W = ROAD_HALF + 3;
        const archMat = this.stone(0x3a2418, 0x5a2a10, 0.35), glowMat = this.neon(Z.colA);
        [-1, 1].forEach(sd => {
            gate.add(this.box(4, 22, 4, archMat, sd * (W + 2), 9.4, 0));
            const cap = new THREE.Mesh(new THREE.SphereGeometry(2.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), archMat); cap.position.set(sd * (W + 2), 20.4, 0); gate.add(cap);
            const tip = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), glowMat); tip.position.set(sd * (W + 2), 23.2, 0); gate.add(tip);
        });
        const arch = new THREE.Mesh(new THREE.TorusGeometry(W, 1.6, 8, 32, Math.PI), archMat); arch.position.y = 10; gate.add(arch);
        const outline = new THREE.Mesh(new THREE.TorusGeometry(W - 1.7, 0.18, 6, 48, Math.PI), glowMat); outline.position.y = 10; gate.add(outline);
        gate.add(this.box(W * 2 + 8, 4, 3, archMat, 0, 10 + W + 1, 0));
        const sign = this.signBoard('रूमी दरवाज़ा · 2099', '#ffb347', 10); sign.position.set(0, 10 + W + 1, 1.6); gate.add(sign);
        return gate;
    },

    indiaGate(Z) {
        const g = new THREE.Group(), W = ROAD_HALF + 2.5;
        const sand = this.stone(0x4a3626, 0x3a2010, 0.3);
        const saffron = this.neon(0xff9933), white = this.neon(0xffffff), green = this.neon(0x19ff8a);
        [-1, 1].forEach(sd => {
            g.add(this.box(6, 30, 7, sand, sd * (W + 3), 13.4, 0));                      // piers
            g.add(this.box(0.25, 26, 0.25, saffron, sd * (W + 0.1), 12, 3.6));          // tricolour edge strips
            g.add(this.box(0.25, 26, 0.25, white, sd * (W + 0.1), 12, 0));
            g.add(this.box(0.25, 26, 0.25, green, sd * (W + 0.1), 12, -3.6));
        });
        const arch = new THREE.Mesh(new THREE.TorusGeometry(W, 1.4, 8, 36, Math.PI), sand); arch.position.y = 18; arch.scale.set(1, 1.2, 4.5); g.add(arch);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(W - 1.3, 0.16, 6, 48, Math.PI), saffron); ring.position.set(0, 18, 3.6); ring.scale.y = 1.2; g.add(ring);
        g.add(this.box(W * 2 + 14, 8, 8, sand, 0, 33, 0));                               // attic
        g.add(this.box(W * 2 + 4, 3, 6.5, sand, 0, 38.5, 0));
        const bowl = new THREE.Mesh(new THREE.SphereGeometry(3.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), sand); bowl.position.y = 40; bowl.scale.y = 0.6; g.add(bowl);
        const flame = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), saffron); flame.position.y = 42.5; g.add(flame);
        const sign = this.signBoard('इंडिया गेट · 2099', '#ff9933', 14); sign.position.set(0, 33, 4.1); g.add(sign);
        return g;
    },

    charminar(Z) {
        const g = new THREE.Group(), W = ROAD_HALF + 3, half = W + 3;
        const lime = this.stone(0x4a4236, 0x2a3a30, 0.35), teal = this.neon(Z.colA), gold = this.neon(Z.colB);
        // four corner piers and the arches on all four faces (the road goes through two of them)
        [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => g.add(this.box(6, 22, 6, lime, sx * half, 9.4, sz * half)));
        [0, Math.PI / 2].forEach((rot) => [-1, 1].forEach(sd => {
            const arch = new THREE.Mesh(new THREE.TorusGeometry(W, 1.3, 8, 32, Math.PI), lime);
            const glow = new THREE.Mesh(new THREE.TorusGeometry(W - 1.2, 0.15, 6, 48, Math.PI), teal);
            [arch, glow].forEach(m => { m.position.set(rot ? sd * half : 0, 11, rot ? 0 : sd * half); m.rotation.y = rot; g.add(m); });
        }));
        g.add(this.box(half * 2 + 6, 5, half * 2 + 6, lime, 0, 23, 0));                 // upper storey
        g.add(this.box(half * 2 + 4, 0.3, 0.3, gold, 0, 25.7, half + 3.1));
        // minarets with balconies and domes
        [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
            const x = sx * (half + 2), z = sz * (half + 2);
            const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 34, 12), lime); shaft.position.set(x, 30, z); g.add(shaft);
            [34, 42].forEach(y => { const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.25, 6, 20), gold); ring.rotation.x = Math.PI / 2; ring.position.set(x, y, z); g.add(ring); });
            const dome = new THREE.Mesh(new THREE.SphereGeometry(2, 12, 10), lime); dome.position.set(x, 48, z); dome.scale.y = 1.3; g.add(dome);
            const tip = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), teal); tip.position.set(x, 51.2, z); g.add(tip);
        });
        const sign = this.signBoard('చార్మినార్ · CHARMINAR 2099', '#ffd24d', 16); sign.position.set(0, 23, half + 3.2); g.add(sign);
        return g;
    },

    // Hawa Mahal: stepped pink facade of small glowing jharokha windows, beside the road
    hawaMahal(Z, i) {
        const g = new THREE.Group();
        const side = i % 2 ? 1 : -1;
        const mat = new THREE.ShaderMaterial({
            uniforms: { uFog: { value: new THREE.Color(Z.fog) }, uFogD: { value: Z.fogDensity } },
            vertexShader: `varying vec3 vB; varying vec3 vN; varying float vDepth;
                void main(){ vB = position; vN = normal; vec4 mv = modelViewMatrix * vec4(position,1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
            fragmentShader: `uniform vec3 uFog; uniform float uFogD; varying vec3 vB; varying vec3 vN; varying float vDepth;
                float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9,78.2))) * 43758.5); }
                void main(){
                    vec3 col = vec3(0.2, 0.055, 0.09);                      // pink sandstone at night
                    if (abs(vN.x) > 0.5) {
                        vec2 c = vec2(vB.z / 2.2, vB.y / 2.6); vec2 f = fract(c) - vec2(0.5, 0.45);
                        float arch = step(length(vec2(f.x, max(f.y, 0.0) * 1.2)), 0.3) * step(-0.35, f.y);   // arched window
                        float h = hash(floor(c));
                        vec3 lit = h > 0.5 ? vec3(1.0, 0.62, 0.25) : h > 0.25 ? vec3(1.0, 0.32, 0.6) : vec3(0.3, 0.9, 1.0);
                        col = mix(col, lit * (0.32 + 0.3 * h), arch * step(0.35, h));
                        col += vec3(1.0, 0.5, 0.7) * 0.1 * step(0.92, fract(vB.y / 2.6));      // pale bands between floors
                    }
                    float fog = 1.0 - exp(-pow(vDepth * uFogD, 2.0));
                    gl_FragColor = vec4(mix(col, uFog, fog), 1.0); }`
        });
        const tiers = [[70, 12], [58, 8], [44, 7], [30, 6], [16, 5]];
        let y = -1.6;
        tiers.forEach(([len, h]) => { const t = this.box(5, h, len, mat, 0, y + h / 2, 0); g.add(t); y += h; });
        const pink = this.neon(Z.colA);
        for (let k = -2; k <= 2; k++) {                                                   // cupolas on top
            const cup = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), this.stone(0x5a1a2a, 0xff4fa0, 0.4));
            cup.position.set(0, y, k * 3); g.add(cup);
            const tip = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), pink); tip.position.set(0, y + 1.8, k * 3); g.add(tip);
        }
        const sign = this.signBoard('हवा महल · HAWA MAHAL 2099', '#ffb347', 18);
        sign.position.set(-side * 2.7, 8, 0); sign.rotation.y = -side * Math.PI / 2; g.add(sign);
        // stand it beside the road, facade toward the highway
        g.children.forEach(c => { c.position.x += side * (ROAD_HALF + 10); });
        return g;
    },

    // Gopuram: temple gateway tower over the road; tiers shrink upwards, each a bright band
    gopuram(Z) {
        const g = new THREE.Group(), W = ROAD_HALF + 3;
        const stoneMat = this.stone(0x2e2018, 0x3a1a08, 0.3);
        const bands = [0xffd21f, 0xff3b5c, 0x19f0ff, 0x7cff4d, 0xff7a1f, 0xff4fd8];
        [-1, 1].forEach(sd => g.add(this.box(6, 15, 9, stoneMat, sd * (W + 3), 5.9, 0)));
        g.add(this.box(W * 2 + 12, 4, 9, stoneMat, 0, 15.4, 0));
        let y = 17.4, w = W * 2 + 10, d = 8.5;
        for (let t = 0; t < 9; t++) {
            const h = 3.6;
            g.add(this.box(w, h, d, this.stone(0x2a1a14, bands[t % bands.length], 0.55), 0, y + h / 2, 0));
            g.add(this.box(w + 0.4, 0.35, d + 0.4, this.neon(bands[(t + 2) % bands.length]), 0, y + h, 0));
            y += h; w *= 0.86; d *= 0.9;
        }
        const top = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, w + 2, 12, 1, false, 0, Math.PI), this.stone(0x3a2410, 0xffd21f, 0.5));
        top.rotation.z = Math.PI / 2; top.position.y = y; g.add(top);
        for (let k = -2; k <= 2; k++) {                                                   // kalasam finials
            const fin = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.6, 8), this.neon(0xffd21f)); fin.position.set(k * (w / 5), y + 2.8, 0); g.add(fin);
        }
        const sign = this.signBoard('கோபுரம் · NEO CHENNAI', '#ffd21f', 14); sign.position.set(0, 15.4, 4.6); g.add(sign);
        return g;
    },

    // Flying traffic above the city (cars, or auto-rickshaws in Neo-Lucknow)
    buildFlyers(Z, rng) {
        const count = QUALITY_LOW ? 14 : 32;
        const geo = Z.flyer === 'auto'
            ? (() => { const g = new THREE.BoxGeometry(1.6, 1.6, 2.4); g.translate(0, 0.8, 0); return g; })()
            : new THREE.BoxGeometry(2, 0.7, 4.2);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true });
        this.flyerMesh = new THREE.InstancedMesh(geo, mat, count);
        const cols = Z.flyer === 'auto' ? [0xffd21f, 0x4dff88, 0xffd21f, 0x19f0c8] : [0xff2bd6, 0x19f0ff, 0xffe14d, 0xffffff];
        for (let i = 0; i < count; i++) {
            this.flyers.push({ ds: rng() * 400 - 60, d: (rng() < 0.5 ? -1 : 1) * (10 + rng() * 30), h: 14 + rng() * 30, v: (rng() < 0.5 ? -1 : 1) * (8 + rng() * 14) });
            this.flyerMesh.setColorAt(i, new THREE.Color(cols[i % cols.length]));
        }
        this.group.add(this.flyerMesh);
    },

    buildRain() {
        const count = QUALITY_LOW ? 500 : 1600;
        const pos = new Float32Array(count * 2 * 3);
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * 70, y = Math.random() * 40, z = (Math.random() - 0.5) * 90;
            pos.set([x, y, z, x, y, z], i * 6);                       // head and tail share a base
        }
        const tip = new Float32Array(count * 2);
        for (let i = 0; i < count; i++) tip[i * 2] = 1;               // bright head, faint tail
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aTip', new THREE.BufferAttribute(tip, 1));
        const mat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false,
            uniforms: { uTime: { value: 0 } },
            vertexShader: `uniform float uTime; attribute float aTip; varying float vA;
                void main(){ vec3 p = position; p.y = mod(p.y - uTime * 38.0, 40.0) - 6.0;
                  p += (1.0 - aTip) * vec3(-0.12, 1.4, -0.25);            // tail trails above the head
                  vA = aTip * 0.5 + 0.2;
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
            fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(0.7, 0.8, 1.0, vA * 0.45); }'
        });
        this.rain = new THREE.LineSegments(g, mat);
        this.rain.frustumCulled = false;
        this.group.add(this.rain);
    },

    update(dt, t, playerS, camera) {
        if (!this.group) return;
        this.rain.material.uniforms.uTime.value = t;
        this.rain.position.copy(camera.position);
        this.sky.position.copy(camera.position);
        this.groundMesh.position.x = camera.position.x; this.groundMesh.position.z = camera.position.z;
        this.holos.forEach(m => { m.uniforms.uTime.value = t; });
        // flyers move along the road around the player and wrap
        const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
        this.flyers.forEach((f, i) => {
            f.ds += f.v * dt;
            if (f.ds < -80) f.ds += 480; if (f.ds > 400) f.ds -= 480;
            const s = clamp(playerS + f.ds, 0, Track.n - 2);
            Track.point(s, f.d, f.h, p);
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Track.heading(s) + (f.v < 0 ? Math.PI : 0));
            m.compose(p, q, sc);
            this.flyerMesh.setMatrixAt(i, m);
        });
        this.flyerMesh.instanceMatrix.needsUpdate = true;
    }
};
