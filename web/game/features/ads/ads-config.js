// =========================================================
// Neon Core — ad IDs. This is the only file to edit when you go live.
//
// AdMob has two sets of IDs, chosen by the build:
//   debug   (npm run sync)          → Google's TEST ids, always. Safe to tap.
//   release (npm run sync:release)  → your LIVE ids from admob.live below
//                                     (android-app/scripts/sync-web.mjs marks the build).
// If a live id is still empty, the release build falls back to test ads instead of breaking.
//
// The game picks the ad network by where it runs:
//   Android app (Capacitor)               → AdMob                  (ads-admob.js)
//   Website on an AppLixir-registered host → AppLixir rewarded video (ads-applixir.js)
//   Website with an AdSense ID             → AdSense H5 Games Ads   (ads-web.js)
//   Nothing filled in / other hosts        → demo ads               (ads-demo.js)
// =========================================================

const ADS_CONFIG = {
    admob: {
        // Google's official test units: they always serve test ads.
        test: {
            rewardedId:     'ca-app-pub-3940256099942544/5224354917',
            bannerId:       'ca-app-pub-3940256099942544/6300978111',
            interstitialId: 'ca-app-pub-3940256099942544/1033173712'
        },
        // Your units from the AdMob console (ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY).
        live: {
            rewardedId:     '',
            bannerId:       '',
            interstitialId: ''
        }
        // The AdMob APP ID (ca-app-pub-…~…) is set per build in
        // android-app/android/app/build.gradle (release: NEON_ADMOB_APP_ID in release.properties).
    },

    applixir: {
        // API key from the AppLixir dashboard → Sites (one key per registered site).
        apiKey: '',
        // Hosts registered in AppLixir (the game lives at https://play.asaxenadev.com/game/).
        // Anywhere else (GitHub Pages, localhost) the game keeps demo ads,
        // because AppLixir only serves ads on registered domains.
        allowedHosts: ['play.asaxenadev.com']
    },

    web: {
        // Your AdSense publisher ID (ca-pub-…) once your site is approved for H5 Games Ads.
        // Empty = the website keeps showing demo ads.
        adsenseClient: '',
        // Optional AdSense display ad unit (data-ad-slot) for the banner on the Run Reset screen.
        bannerSlot: '',
        // Adds data-adbreak-test="on" so AdSense serves test ads while you try it out.
        testing: true
    }
};

// The AdMob ids this build uses (see the note at the top)
const ADMOB = (function () {
    const live = ADS_CONFIG.admob.live;
    const useLive = window.NEON_BUILD === 'release' && !!live.rewardedId;
    const ids = useLive ? live : ADS_CONFIG.admob.test;
    return {
        rewardedId: ids.rewardedId,
        bannerId: ids.bannerId || ADS_CONFIG.admob.test.bannerId,
        interstitialId: ids.interstitialId || ADS_CONFIG.admob.test.interstitialId,
        testing: !useLive
    };
})();
