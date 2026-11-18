// Neon Core: Racer prototype — shared helpers

const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (IS_TOUCH) document.body.classList.add('touch');
const QUALITY_LOW = new URLSearchParams(location.search).get('quality') === 'low';

// Seeded random (mulberry32) so a zone builds the same city every time
function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => t * t * (3 - 2 * t);

function canvasTexture(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
}

// A glowing neon sign: text with a bright core and a coloured halo, on a dark plate
function neonSignTexture(text, color, opts = {}) {
    const font = opts.font || '800 72px Orbitron, "Noto Sans Devanagari", sans-serif';
    const meas = document.createElement('canvas').getContext('2d');
    meas.font = font;
    const tw = Math.ceil(meas.measureText(text).width);
    const w = THREE.MathUtils.ceilPowerOfTwo(tw + 80), h = 128;
    return {
        aspect: (tw + 80) / h,
        tex: canvasTexture(w, h, (g) => {
            g.fillStyle = opts.plate || 'rgba(8,4,16,0.85)';
            g.fillRect(0, 0, tw + 80, h);
            g.strokeStyle = color; g.lineWidth = 4; g.shadowColor = color; g.shadowBlur = 16;
            g.strokeRect(6, 6, tw + 68, h - 12);
            g.font = font; g.textBaseline = 'middle'; g.textAlign = 'center';
            g.shadowBlur = 24; g.fillStyle = color;
            g.fillText(text, (tw + 80) / 2, h / 2 + 4);
            g.shadowBlur = 0; g.fillStyle = '#ffffff'; g.globalAlpha = 0.75;
            g.fillText(text, (tw + 80) / 2, h / 2 + 4);
        }),
        uScale: (tw + 80) / w
    };
}
