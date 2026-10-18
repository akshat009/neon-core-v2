// =========================================================
// Neon Core — synth sound effects (Web Audio API)
// =========================================================

let audioCtx;
let isMuted = false;

function initAudio() {
    if(!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if(isMuted) audioCtx.suspend();
        } catch(e) {}
    }
}

document.getElementById('mute-btn').addEventListener('click', (e) => {
    isMuted = !isMuted;
    e.target.innerText = isMuted ? "🔇 UNMUTE" : "🔊 MUTE";
    if(audioCtx) {
        if(isMuted) audioCtx.suspend();
        else audioCtx.resume();
    }
});

function playSynth(freq, type, duration, vol=0.1) {
    if(!audioCtx || isMuted) return;
    try {
        let osc = audioCtx.createOscillator(); let gain = audioCtx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
}

function playJump()    { playSynth(200, 'sine', 0.2, 0.15); setTimeout(()=>playSynth(400, 'sine', 0.2, 0.1), 50); }
function playCoin()    { playSynth(800, 'square', 0.1, 0.05); setTimeout(() => playSynth(1200, 'square', 0.2, 0.05), 50); }
function playWin()     { playSynth(300, 'sawtooth', 0.2); setTimeout(()=>playSynth(400, 'sawtooth', 0.2), 150); setTimeout(()=>playSynth(600, 'sawtooth', 0.4), 300); }
function playDie()     { playSynth(100, 'sawtooth', 0.8, 0.2); }
function playPowerup() { playSynth(500, 'sine', 0.1); setTimeout(() => playSynth(1000, 'sine', 0.3), 100); }
