// =========================================================
// Neon Core — keyboard and touch input
// =========================================================

const keys = { w: false, a: false, s: false, d: false, space: false };

window.addEventListener('keydown', (e) => {
    if(['ArrowUp','KeyW'].includes(e.code)) keys.w = true;
    if(['ArrowDown','KeyS'].includes(e.code)) keys.s = true;
    if(['ArrowLeft','KeyA'].includes(e.code)) keys.a = true;
    if(['ArrowRight','KeyD'].includes(e.code)) keys.d = true;
    if(e.code === 'Space') { keys.space = true; e.preventDefault(); }
});

window.addEventListener('keyup', (e) => {
    if(['ArrowUp','KeyW'].includes(e.code)) keys.w = false;
    if(['ArrowDown','KeyS'].includes(e.code)) keys.s = false;
    if(['ArrowLeft','KeyA'].includes(e.code)) keys.a = false;
    if(['ArrowRight','KeyD'].includes(e.code)) keys.d = false;
    if(e.code === 'Space') keys.space = false;
});

// On-screen D-pad and jump button
const setupBtnTouch = (id, k) => {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', (e)=>{ e.stopPropagation(); e.preventDefault(); keys[k]=true; }, {passive: false});
    el.addEventListener('touchend', (e)=>{ e.stopPropagation(); e.preventDefault(); keys[k]=false; }, {passive: false});
};
setupBtnTouch('btn-up','w'); setupBtnTouch('btn-down','s'); setupBtnTouch('btn-left','a'); setupBtnTouch('btn-right','d');
setupBtnTouch('btn-jump','space');
