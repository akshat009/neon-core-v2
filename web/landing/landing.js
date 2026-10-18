// =========================================================
// Neon Core landing page — Android download button
//
// When the APK is ready:
//   1. Upload it next to this page, e.g. play/downloads/neon-core.apk
//   2. Fill in url (and version) below. The button turns on by itself.
// =========================================================

const ANDROID_APK = {
    url: '',          // e.g. 'downloads/neon-core-1.0.0.apk'
    version: '',      // e.g. '1.0.0'
    sizeMb: ''        // e.g. '12'
};

(function () {
    const btn = document.getElementById('apk-download');
    const status = document.getElementById('apk-status');
    if (!ANDROID_APK.url) return;                       // stays "Coming soon"

    btn.href = ANDROID_APK.url;
    btn.setAttribute('download', '');
    btn.removeAttribute('aria-disabled');
    btn.removeAttribute('role');
    btn.classList.remove('is-soon');
    const bits = [];
    if (ANDROID_APK.version) bits.push('Version ' + ANDROID_APK.version);
    if (ANDROID_APK.sizeMb) bits.push(ANDROID_APK.sizeMb + ' MB');
    status.textContent = bits.length ? bits.join(', ') : 'Ready to download';
    status.classList.add('ready');
})();
