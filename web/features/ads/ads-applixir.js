// =========================================================
// Neon Core — WEBSITE ads: AppLixir rewarded video (SDK v6)
//
// Used on the website when ADS_CONFIG.applixir.apiKey is set and the page runs on one of
// ADS_CONFIG.applixir.allowedHosts (AppLixir only serves ads on domains registered in its
// dashboard, so on other hosts — e.g. GitHub Pages — the game stays on demo ads).
//
// • The ad opens from the player's tap: initializeAndOpenPlayer(options).
// • Reward ONLY on status "complete". "allAdsCompleted" also fires after a skip or when
//   no ad was available, so it's only used to close the player.
// • AppLixir has no banner format, so the Run Reset screen shows no banner here.
// Docs: https://support.applixir.com
// =========================================================

const APPLIXIR_SDK = 'https://cdn.applixir.com/applixir.app.v6.1.0.js';

const AppLixirAds = {
    current: null,      // the ad being shown: { started, earned, errored, finish }

    init() {
        const s = document.createElement('script');
        s.src = APPLIXIR_SDK;
        s.async = true;
        document.head.appendChild(s);
    },

    prepareRewarded() {},   // AppLixir loads the ad when it opens

    showRewarded(placement) {
        return new Promise((resolve) => {
            const container = document.getElementById('applixir-ad-container');
            if (typeof window.initializeAndOpenPlayer !== 'function') { resolve('unavailable'); return; }

            const ad = { started: false, earned: false, errored: false, done: false };
            const finish = () => {
                if (ad.done) return;
                ad.done = true;
                clearTimeout(ad.timeout);
                container.classList.remove('show');
                showAdLoading(false);
                this.current = null;
                if (ad.earned) resolve('viewed');
                else if (!ad.started) resolve('unavailable');   // no fill, blocked or error before playing
                else resolve('dismissed');
            };
            ad.timeout = setTimeout(() => { if (!ad.started) finish(); }, 15000);   // no ad started: give up
            this.current = ad;

            container.classList.add('show');
            showAdLoading(true);
            try {
                window.initializeAndOpenPlayer({
                    apiKey: ADS_CONFIG.applixir.apiKey,
                    injectionElementId: 'applixir-ad-container',
                    customData: { placement: placement },
                    adStatusCallbackFn: (status) => {
                        const type = status && status.type;
                        if (type === 'loaded') showAdLoading(false);
                        if (type === 'started') { ad.started = true; showAdLoading(false); }
                        if (type === 'complete') ad.earned = true;
                        if (type === 'allAdsCompleted' || type === 'skipped' || type === 'manuallyEnded' || type === 'consentDeclined') finish();
                    },
                    adErrorCallbackFn: () => { ad.errored = true; finish(); }
                });
            } catch (e) {
                finish();
            }
        });
    },

    showBanner() {},
    hideBanner() {}
};
