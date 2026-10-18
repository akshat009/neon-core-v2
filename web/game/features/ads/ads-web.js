// =========================================================
// Neon Core — WEBSITE ads: Google AdSense "H5 Games Ads" (Ad Placement API)
//
// Used when the game runs in a browser and ADS_CONFIG.web.adsenseClient is set.
// How rewarded ads work here:
//   1. prepareRewarded() asks Google for a rewarded ad (adBreak type 'reward').
//      If one is available, Google hands us showAdFn.
//   2. When the player taps "Watch ad", showRewarded() calls showAdFn right inside that tap.
//   3. adViewed → reward, adDismissed → no reward; adBreakDone always comes last.
// Docs: https://developers.google.com/ad-placement
// =========================================================

const WebAds = {
    pending: null,          // the rewarded break currently being offered
    bannerReady: false,

    init() {
        const cfg = ADS_CONFIG.web;
        window.adsbygoogle = window.adsbygoogle || [];
        window.adBreak = window.adConfig = function (o) { window.adsbygoogle.push(o); };

        const s = document.createElement('script');
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(cfg.adsenseClient);
        s.setAttribute('data-ad-client', cfg.adsenseClient);
        if (cfg.testing) s.setAttribute('data-adbreak-test', 'on');
        document.head.appendChild(s);

        window.adConfig({ sound: isMuted ? 'off' : 'on' });
        document.getElementById('mute-btn').addEventListener('click', () => window.adConfig({ sound: isMuted ? 'off' : 'on' }));
    },

    prepareRewarded(placement) {
        const p = { placement: placement, showAdFn: null, result: null, done: false, onDone: null };
        this.pending = p;
        window.adBreak({
            type: 'reward',
            name: placement,
            beforeReward: (showAdFn) => { p.showAdFn = showAdFn; },
            beforeAd: () => {},
            afterAd: () => {},
            adDismissed: () => { p.result = 'dismissed'; },
            adViewed: () => { p.result = 'viewed'; },
            adBreakDone: (info) => {
                p.done = true;
                if (!p.result) {
                    const status = info && info.breakStatus;
                    p.result = status === 'viewed' ? 'viewed' : status === 'dismissed' ? 'dismissed' : 'unavailable';
                }
                if (p.onDone) p.onDone(p.result);
                if (this.pending === p) this.pending = null;
            }
        });
    },

    showRewarded(placement) {
        return new Promise((resolve) => {
            let p = this.pending;
            if (p && p.placement === placement && p.showAdFn && !p.done) {
                p.onDone = resolve;
                p.showAdFn();                       // inside the player's tap
                return;
            }
            // Nothing ready for this placement: ask now and show it if it arrives quickly
            this.prepareRewarded(placement);
            p = this.pending;
            const started = Date.now();
            const wait = setInterval(() => {
                if (p.showAdFn && !p.done) { clearInterval(wait); p.onDone = resolve; p.showAdFn(); }
                else if (p.done || Date.now() - started > 3000) { clearInterval(wait); resolve('unavailable'); }
            }, 100);
        });
    },

    showBanner() {
        const cfg = ADS_CONFIG.web;
        const slot = document.getElementById('banner-slot');
        if (!cfg.bannerSlot) return;                 // no display unit configured: no banner
        if (!this.bannerReady) {
            slot.textContent = '';
            slot.classList.add('live');
            const ins = document.createElement('ins');
            ins.className = 'adsbygoogle';
            ins.style.cssText = 'display:inline-block;width:320px;height:50px';
            ins.setAttribute('data-ad-client', cfg.adsenseClient);
            ins.setAttribute('data-ad-slot', cfg.bannerSlot);
            slot.appendChild(ins);
            try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
            this.bannerReady = true;
        }
        slot.classList.add('show');
    },

    hideBanner() {
        document.getElementById('banner-slot').classList.remove('show');
    }
};
