// =========================================================
// Neon Core — DEMO ads (used until real ad IDs are filled in)
// Same behaviour as real rewarded ads: close early = no reward.
// =========================================================

const DemoAds = {
    finish: null,

    init() {
        attachButtonAction('demo-ad-close', () => { if (this.finish) this.finish(); });
    },

    prepareRewarded() {},

    showRewarded(placement) {
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

            const finish = () => {
                clearInterval(timer);
                this.finish = null;
                el.classList.remove('show', 'done');
                resolve(earned ? 'viewed' : 'dismissed');
            };
            this.finish = finish;
        });
    },

    showBanner(placement) {
        const slot = document.getElementById('banner-slot');
        slot.dataset.placement = placement;
        slot.classList.add('show');
    },

    hideBanner() {
        document.getElementById('banner-slot').classList.remove('show');
    }
};
