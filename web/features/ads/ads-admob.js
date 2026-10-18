// =========================================================
// Neon Core — ANDROID APP ads: AdMob through the Capacitor plugin
// (@capacitor-community/admob v8, see android-app/).
//
// Used automatically when the game runs inside the Capacitor app.
// • On start: ask for ad consent where required (EEA/UK), then initialise AdMob,
//   then preload one rewarded ad so "Watch ad" opens instantly.
// • Rewarded: the reward only counts when AdMob reports it (Rewarded event);
//   closing the ad early gives nothing. The game stays frozen until the ad is closed.
// • Banner: AdMob adaptive banner at the bottom of the Run Reset screen.
// =========================================================

const AdMobAds = {
    plugin: null,
    ready: false,
    initPromise: null,
    rewardLoaded: false,
    rewardLoading: null,

    getPlugin() {
        if (!this.plugin) {
            const register = (window.capacitorExports && window.capacitorExports.registerPlugin)
                || (window.Capacitor && window.Capacitor.registerPlugin);
            this.plugin = register ? register('AdMob') : null;
        }
        return this.plugin;
    },

    init() {
        if (!this.initPromise) this.initPromise = this.setup();
        return this.initPromise;
    },

    async setup() {
        const AdMob = this.getPlugin();
        if (!AdMob) return false;
        try {
            let consent = await AdMob.requestConsentInfo();
            if (consent.isConsentFormAvailable && consent.status === 'REQUIRED') consent = await AdMob.showConsentForm();
            if (consent.canRequestAds === false) return false;
        } catch (e) { /* consent check unavailable: carry on */ }
        try {
            await AdMob.initialize({ initializeForTesting: ADS_CONFIG.admob.testing });
            this.ready = true;
            this.preload();
            return true;
        } catch (e) {
            return false;
        }
    },

    // Load one rewarded ad in the background (resolves true when ready)
    preload() {
        if (!this.ready) return Promise.resolve(false);
        if (this.rewardLoaded) return Promise.resolve(true);
        if (this.rewardLoading) return this.rewardLoading;
        this.rewardLoading = this.getPlugin()
            .prepareRewardVideoAd({ adId: ADS_CONFIG.admob.rewardedId, isTesting: ADS_CONFIG.admob.testing })
            .then(() => { this.rewardLoaded = true; return true; })
            .catch(() => false)
            .finally(() => { this.rewardLoading = null; });
        return this.rewardLoading;
    },

    prepareRewarded() {
        this.init().then((ok) => { if (ok) this.preload(); });
    },

    async showRewarded() {
        if (!(await this.init())) return 'unavailable';
        const AdMob = this.getPlugin();

        if (!this.rewardLoaded) {
            showAdLoading(true);
            const ok = await this.preload();
            showAdLoading(false);
            if (!ok) return 'unavailable';
        }

        let earned = false, finish;
        const closed = new Promise((resolve) => { finish = resolve; });
        const listeners = await Promise.all([
            AdMob.addListener('onRewardedVideoAdReward', () => { earned = true; }),
            AdMob.addListener('onRewardedVideoAdDismissed', () => finish('closed')),
            AdMob.addListener('onRewardedVideoAdFailedToShow', () => finish('failed'))
        ]);

        this.rewardLoaded = false;
        // Resolves when the reward is earned; the ad may still be on screen, so wait for "closed"
        AdMob.showRewardVideoAd().then(() => { earned = true; }).catch(() => finish('failed'));
        const how = await closed;

        listeners.forEach((l) => { try { l.remove(); } catch (e) {} });
        this.preload();                                   // get the next one ready
        if (earned) return 'viewed';
        return how === 'failed' ? 'unavailable' : 'dismissed';
    },

    showBanner() {
        this.init().then((ok) => {
            if (!ok) return;
            this.getPlugin().showBanner({
                adId: ADS_CONFIG.admob.bannerId,
                adSize: 'ADAPTIVE_BANNER',
                position: 'BOTTOM_CENTER',
                margin: 0,
                isTesting: ADS_CONFIG.admob.testing
            }).catch(() => {});
        });
    },

    hideBanner() {
        if (this.ready) this.getPlugin().removeBanner().catch(() => {});
    }
};
