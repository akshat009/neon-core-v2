// =========================================================
// Neon Core — ad IDs. This is the only file to edit when you go live.
//
// The game picks the ad network by where it runs:
//   Android app (Capacitor)               → AdMob                  (ads-admob.js)
//   Website on an AppLixir-registered host → AppLixir rewarded video (ads-applixir.js)
//   Website with an AdSense ID             → AdSense H5 Games Ads   (ads-web.js)
//   Nothing filled in / other hosts        → demo ads               (ads-demo.js)
// =========================================================

const ADS_CONFIG = {
    admob: {
        // Ad unit IDs from your AdMob account. Google's official TEST IDs are filled in for now:
        // they always serve test ads, so it's safe to tap them while developing.
        // Before publishing: put your own IDs here and set testing to false.
        rewardedId: 'ca-app-pub-3940256099942544/5224354917',
        bannerId:   'ca-app-pub-3940256099942544/6300978111',
        testing: true
        // The AdMob APP ID (ca-app-pub-…~…) goes in
        // android-app/android/app/src/main/res/values/strings.xml → admob_app_id
    },

    applixir: {
        // API key from the AppLixir dashboard → Sites (one key per registered site).
        apiKey: '',
        // Hosts registered in AppLixir (the game lives at https://asaxenadev.com/play/game/).
        // Anywhere else (GitHub Pages, localhost) the game keeps demo ads,
        // because AppLixir only serves ads on registered domains.
        allowedHosts: ['asaxenadev.com', 'www.asaxenadev.com']
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
