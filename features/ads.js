// =========================================================
// Neon Core features — ads adapter
//
// The game only ever calls these three:
//   Ads.showRewarded(placement)  → Promise<boolean>  (true = player watched it, give the reward)
//   Ads.showBanner(placement)
//   Ads.hideBanner()
//
// Today they show DEMO ads. For the Android build, fill the three admob* functions below with
// your AdMob plugin calls and set ADS_CONFIG.mode = 'admob'. Nothing else needs to change.
// Placements used by the game: 'shield', 'continue' (rewarded), 'restart' (banner).
// =========================================================

const ADS_CONFIG = {
    mode: 'demo',          // 'demo' | 'admob'
    admob: {               // from your AdMob account (use Google's test IDs while developing)
        appId: '',
        rewardedId: '',
        bannerId: ''
    }
};

const Ads = {
    busy: false,

    async showRewarded(placement) {
        if (this.busy) return false;
        this.busy = true;
        setGameAudio(false);
        try {
            return ADS_CONFIG.mode === 'admob' ? await admobShowRewarded(placement) : await demoShowRewarded(placement);
        } catch (e) {
            return false;
        } finally {
            setGameAudio(true);
            this.busy = false;
        }
    },

    showBanner(placement) {
        if (ADS_CONFIG.mode === 'admob') admobShowBanner(placement);
        else demoShowBanner(placement);
    },

    hideBanner() {
        if (ADS_CONFIG.mode === 'admob') admobHideBanner();
        else demoHideBanner();
    }
};

function setGameAudio(on) {
    if (!audioCtx || isMuted) return;
    try { on ? audioCtx.resume() : audioCtx.suspend(); } catch (e) {}
}

// ---------- AdMob (wire these up in the Android build) ----------

async function admobShowRewarded(placement) {
    // Load + show a rewarded ad with ADS_CONFIG.admob.rewardedId.
    // Return true only when the plugin reports the reward was earned.
    console.warn('AdMob rewarded ad not wired yet:', placement);
    return false;
}

function admobShowBanner(placement) {
    // Show a bottom banner with ADS_CONFIG.admob.bannerId.
    console.warn('AdMob banner not wired yet:', placement);
}

function admobHideBanner() {
    // Hide / remove the banner.
}

// ---------- Demo ads (stand-ins with the same behaviour as real ones) ----------

let demoAdFinish = null;

function demoShowRewarded(placement) {
    return new Promise((resolve) => {
        const el = document.getElementById('demo-ad');
        const fill = document.getElementById('demo-ad-fill');
        const count = document.getElementById('demo-ad-count');
        const status = document.getElementById('demo-ad-status');
        const total = FEATURES.demoAdSeconds;
        let left = total, earned = false;

        el.dataset.placement = placement;
        status.textContent = 'Rewarded video · watch till the end to get the reward';
        fill.style.width = '0%';
        count.textContent = Math.ceil(left);
        el.classList.remove('done');
        el.classList.add('show');

        const timer = setInterval(() => {
            left = Math.max(left - 0.1, 0);
            fill.style.width = `${(1 - left / total) * 100}%`;
            count.textContent = Math.ceil(left);
            if (left <= 0 && !earned) {
                earned = true;
                clearInterval(timer);
                status.textContent = 'Reward earned ✓';
                el.classList.add('done');
                setTimeout(finish, 700);
            }
        }, 100);

        function finish() {
            clearInterval(timer);
            demoAdFinish = null;
            el.classList.remove('show', 'done');
            resolve(earned);            // closed early = no reward, like a real rewarded ad
        }
        demoAdFinish = finish;
    });
}

function demoShowBanner(placement) {
    const slot = document.getElementById('banner-slot');
    slot.dataset.placement = placement;
    slot.classList.add('show');
}

function demoHideBanner() {
    document.getElementById('banner-slot').classList.remove('show');
}

attachButtonAction('demo-ad-close', () => { if (demoAdFinish) demoAdFinish(); });
