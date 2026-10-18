// =========================================================
// Neon Core — Three.js scene, camera, lights, materials, ball
// =========================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a1a);
scene.fog = new THREE.FogExp2(0x0a0a1a, 0.018);

// Set initial aspect ratio and FOV based on orientation
let initialAspect = window.innerWidth / window.innerHeight;
let initialFov = initialAspect < 1 ? 75 : 55; // Wider FOV for portrait mode
const camera = new THREE.PerspectiveCamera(initialFov, initialAspect, 0.1, 250);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// --- Lights ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444466, 0.5);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0x00ffff, 1.2);
dirLight.position.set(15, 25, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 100;
dirLight.shadow.bias = -0.001;
scene.add(dirLight);

const pinkLight = new THREE.DirectionalLight(0xff00ff, 0.6);
pinkLight.position.set(-15, 15, -15);
scene.add(pinkLight);

// --- Shared geometries & materials ---
const floorMat = new THREE.MeshPhysicalMaterial({ color: 0x15152a, roughness: 0.1, metalness: 0.8, clearcoat: 0.5, clearcoatRoughness: 0.2 });
const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(14, 1, 15));
const edgeMat = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2, transparent: true, opacity: 0.8 });

const ringGeo = new THREE.OctahedronGeometry(0.8);   // cyan data pickups
const ringMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00aaff, emissiveIntensity: 0.8, wireframe: true });

const spikeGeo = new THREE.DodecahedronGeometry(0.9); // red mines
const spikeMat = new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xcc0000, emissiveIntensity: 0.8, wireframe: true });

const bigMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xaa5500, wireframe: true });   // orange powerup
const smallMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00aa00, wireframe: true }); // green powerup

// --- Player ball ---
const coreMat = new THREE.MeshPhysicalMaterial({ color: 0x00ffff, emissive: 0x0055aa, roughness: 0.05, transmission: 0.9, thickness: 1.0, clearcoat: 1.0 });
const steelMat = new THREE.MeshPhysicalMaterial({ color: 0xffaa00, emissive: 0x663300, roughness: 0.3, metalness: 1.0, clearcoat: 0.8 });

const ballGeo = new THREE.SphereGeometry(1, 64, 64);
const ball = new THREE.Mesh(ballGeo, coreMat);

const coreLight = new THREE.PointLight(0x00ffff, 2.0, 15);
ball.add(coreLight);
ball.castShadow = true;
scene.add(ball);
