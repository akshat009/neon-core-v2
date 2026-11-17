package com.akshat009.neoncore;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebSettings;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Neon Core runs fullscreen: status and navigation bars are hidden (immersive sticky).
 * A swipe from the edge shows them for a moment, then they hide again.
 *
 * • Ads and dialogs can bring the bars back, so they are hidden again whenever the
 *   game window gets focus back (onWindowFocusChanged).
 * • The game may draw into the display cutout (notch / punch-hole). Capacitor's
 *   SystemBars plugin passes the cutout insets to the page, where the CSS keeps the HUD
 *   clear of it with env(safe-area-inset-*) (see --safe-* in web/game/css/style.css).
 * • Android's "Font size" setting also scales the page text. It is capped at 115% so text
 *   still gets a little bigger for people who need it, without breaking the HUD layout.
 */
public class MainActivity extends BridgeActivity {

    private static final int MAX_TEXT_ZOOM = 115;   // percent

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams params = getWindow().getAttributes();
            params.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(params);
        }
        hideSystemBars();

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebSettings settings = getBridge().getWebView().getSettings();
            settings.setTextZoom(Math.min(settings.getTextZoom(), MAX_TEXT_ZOOM));
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }
}
