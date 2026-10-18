// =========================================================
// Neon Core — ads adapter (picks the right ad network for the platform)
//
// The game only calls:
//   Ads.prepareRewarded(placement)   get an ad ready when an offer appears (optional)
//   Ads.showRewarded(placement)      → Promise<boolean>  true = watched, give the reward
//   Ads.showBanner(placement) / Ads.hideBanner()
// Placements: 'shield', 'continue' (rewarded), 'restart' (banner).
// =========================================================

const AD_NETWORKS = { admob: AdMobAds, web: WebAds, demo: DemoAds };

function isNativeApp() {
    const cap = window.Capacitor;
    return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
}

function pickAdNetwork() {
    if (isNativeApp()) return ADS_CONFIG.admob.rewardedId ? 'admob' : 'demo';
    return ADS_CONFIG.web.adsenseClient ? 'web' : 'demo';
}

const Ads = {
    network: pickAdNetwork(),
    busy: false,

    prepareRewarded(placement) {
        try { AD_NETWORKS[this.network].prepareRewarded(placement); } catch (e) {}
    },

    async showRewarded(placement) {
        if (this.busy) return false;
        this.busy = true;
        setGameAudio(false);
        let result = 'unavailable';
        try {
            result = await AD_NETWORKS[this.network].showRewarded(placement);
        } catch (e) {
            result = 'unavailable';
        } finally {
            showAdLoading(false);
            setGameAudio(true);
            this.busy = false;
        }
        if (result === 'unavailable') showAdToast('Ad not available right now — try again in a moment.');
        return result === 'viewed';
    },

    showBanner(placement) {
        try { AD_NETWORKS[this.network].showBanner(placement); } catch (e) {}
    },

    hideBanner() {
        try { AD_NETWORKS[this.network].hideBanner(); } catch (e) {}
    }
};

function setGameAudio(on) {
    if (!audioCtx || isMuted) return;
    try { on ? audioCtx.resume() : audioCtx.suspend(); } catch (e) {}
}

// ---------- Small status messages ("Loading ad…", "Ad not available") ----------

let adToastTimer = null;

function showAdToast(text, ms = 2400) {
    const el = document.getElementById('ad-toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(adToastTimer);
    adToastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

function showAdLoading(on) {
    const el = document.getElementById('ad-toast');
    clearTimeout(adToastTimer);
    if (on) { el.textContent = 'Loading ad…'; el.classList.add('show'); }
    else if (el.textContent === 'Loading ad…') el.classList.remove('show');
}

AD_NETWORKS[Ads.network].init();
document.body.dataset.adNetwork = Ads.network;
