// =========================================================
// Neon Core — ads adapter (picks the right ad network for the platform)
//
// The game only calls:
//   Ads.prepareRewarded(placement)   get an ad ready when an offer appears (optional)
//   Ads.showRewarded(placement)      → Promise<boolean>  true = watched, give the reward
//   Ads.showBanner(placement) / Ads.hideBanner()
// Placements: 'shield', 'continue' (rewarded), 'restart' (banner).
// =========================================================

const AD_NETWORKS = { admob: AdMobAds, applixir: AppLixirAds, web: WebAds, demo: DemoAds };

function isNativeApp() {
    const cap = window.Capacitor;
    return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
}

function pickAdNetwork() {
    if (isNativeApp()) return ADS_CONFIG.admob.rewardedId ? 'admob' : 'demo';
    const lx = ADS_CONFIG.applixir;
    if (lx.apiKey && (!lx.allowedHosts.length || lx.allowedHosts.includes(location.hostname))) return 'applixir';
    return ADS_CONFIG.web.adsenseClient ? 'web' : 'demo';
}

const Ads = {
    network: pickAdNetwork(),
    busy: false,

    prepareRewarded(placement) {
        try { AD_NETWORKS[this.network].prepareRewarded(placement); } catch (e) {}
    },

    lastAdAt: 0,              // any fullscreen ad (rewarded or interstitial), for pacing
    clearsSinceInterstitial: 0,

    async showRewarded(placement) {
        if (this.busy) return false;
        this.busy = true;
        this.lastAdAt = Date.now();
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

    // Called after every cleared sector, when the player moves on. Shows a skippable interstitial
    // after every Nth clear, never after a fail and never too soon after another ad.
    async maybeInterstitial(placement) {
        this.clearsSinceInterstitial++;
        const due = this.clearsSinceInterstitial >= FEATURES.interstitialEverySectors;
        const rested = Date.now() - this.lastAdAt >= FEATURES.interstitialMinGapSeconds * 1000;
        if (!due || !rested || this.busy || adsRemoved()) return;
        const net = AD_NETWORKS[this.network];
        if (!net.showInterstitial) return;
        this.busy = true;
        setGameAudio(false);
        try {
            const r = await net.showInterstitial(placement);
            if (r === 'viewed') { this.clearsSinceInterstitial = 0; this.lastAdAt = Date.now(); }
        } catch (e) {
        } finally {
            setGameAudio(true);
            this.busy = false;
        }
    },

    showBanner(placement) {
        try { AD_NETWORKS[this.network].showBanner(placement); } catch (e) {}
    },

    hideBanner() {
        try { AD_NETWORKS[this.network].hideBanner(); } catch (e) {}
    }
};

// "Remove Ads" purchase (coming with Google Play billing): forced ads off, rewarded ads stay opt-in
function adsRemoved() {
    try { return localStorage.getItem('neonCoreNoAds') === '1'; } catch (e) { return false; }
}

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
