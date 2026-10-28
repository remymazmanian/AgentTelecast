package io.github.botboard.tv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final long LONG_PRESS_MS = 800;
    private static final long BACK_WINDOW_MS = 2000;
    private static final long BACKOFF_MIN_MS = 5_000;
    private static final long BACKOFF_MAX_MS = 5 * 60_000;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WebView web;
    private TextView overlay;
    private static final String TAG = "AgentTelecast";
    private String currentUrl;
    private String sessionUrl;  // debug builds only, never persisted
    private boolean loadFailed;
    private long backoffMs = BACKOFF_MIN_MS;
    private long lastBackPress;
    private long centerDownAt = -1;
    private boolean centerLongHandled;

    private final Runnable periodicReload = new Runnable() {
        @Override public void run() {
            schedulePeriodic();
            if (web == null) return;
            if (loadFailed) { load(); return; }
            // The dashboard page checks for new data itself and defers reloads while a
            // details panel is open; only reload blindly for pages that don't.
            web.evaluateJavascript("window.kioskManagesReload===true", new ValueCallback<String>() {
                @Override public void onReceiveValue(String v) {
                    if (!"true".equals(v) && web != null) { loadFailed = false; web.reload(); }
                }
            });
        }
    };
    private final Runnable retry = new Runnable() {
        @Override public void run() { load(); }
    };

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_FULLSCREEN);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        root.setKeepScreenOn(true);

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        WebSettings s = web.getSettings();
        s.setUserAgentString(s.getUserAgentString() + " " + Flavor.UA_TOKEN);
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= 21) s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new AppBridge(), "AgentTelecastApp");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new KioskClient());
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));

        overlay = new TextView(this);
        overlay.setBackgroundColor(0xF0071018);
        overlay.setTextColor(0xFFDDE6EE);
        overlay.setTextSize(28);
        overlay.setGravity(Gravity.CENTER);
        overlay.setPadding(80, 80, 80, 80);
        overlay.setVisibility(View.GONE);
        root.addView(overlay, new FrameLayout.LayoutParams(-1, -1));

        setContentView(root);
        web.requestFocus(View.FOCUS_DOWN);
        handleIntentUrl(getIntent());
        if (targetUrl().isEmpty()) openSetup(); else load();
    }

    private static final int REQ_SETUP = 1;
    private boolean setupOpen;

    /** First run (no URL saved): the remote-friendly setup screen. */
    private void openSetup() {
        if (setupOpen) return;
        setupOpen = true;
        startActivityForResult(new Intent(this, SetupActivity.class), REQ_SETUP);
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != REQ_SETUP) return;
        setupOpen = false;
        if (targetUrl().isEmpty()) { finish(); return; }   // Back on the setup screen: leave the app
        load();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (handleIntentUrl(intent)) load();
    }

    /**
     * Intent "url" extra. Security: the launcher activity is exported, so any app could send this.
     * Release builds ignore it completely; debuggable builds use it for this session only and never
     * persist it. The Settings screen is the only way to change the saved URL.
     */
    private boolean handleIntentUrl(Intent i) {
        if (i == null || !i.hasExtra("url")) return false;
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) == 0) {
            Log.w(TAG, "Ignoring url extra from intent (release build; use Settings to change the URL)");
            i.removeExtra("url");
            return false;
        }
        String u = i.getStringExtra("url");
        if (u == null || u.trim().isEmpty()) return false;
        sessionUrl = Prefs.normalizeUrl(u);
        return true;
    }

    private String targetUrl() { return sessionUrl != null ? sessionUrl : Prefs.url(this); }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemUi();
        if (web == null) return;
        web.onResume();
        web.getSettings().setTextZoom(Prefs.textZoom(this));
        String target = targetUrl();
        if (target.isEmpty()) { if (currentUrl != null) openSetup(); }
        else if (currentUrl != null && !target.equals(currentUrl)) load();
        schedulePeriodic();
        // Settings may have changed the refresh interval; let the page pick it up.
        web.evaluateJavascript("window.kioskRefreshChanged&&window.kioskRefreshChanged()", null);
    }

    /**
     * Lets the page read and save the data refresh choice, so the page's picker and the app's
     * Settings stay in sync. Exposes one bounded number only; no other app data.
     */
    private final class AppBridge {
        @JavascriptInterface public int getRefreshMinutes() { return Prefs.savedRefresh(getApplicationContext()); }
        @JavascriptInterface public void setRefreshMinutes(int m) {
            if (m < 0 || m > 60) return;
            Prefs.saveRefresh(getApplicationContext(), m);
            handler.post(new Runnable() { @Override public void run() { schedulePeriodic(); } });
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        handler.removeCallbacks(periodicReload);
        if (web != null) web.onPause();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (web != null) web.destroy();
        super.onDestroy();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    private void load() {
        handler.removeCallbacks(retry);
        if (targetUrl().isEmpty()) { openSetup(); return; }
        if (web == null) { recreate(); return; }
        currentUrl = targetUrl();
        loadFailed = false;
        web.loadUrl(currentUrl);
    }

    private void schedulePeriodic() {
        handler.removeCallbacks(periodicReload);
        int min = Prefs.reloadMinutes(this);
        if (min > 0) handler.postDelayed(periodicReload, min * 60_000L);
    }

    private void onLoadError(String why) {
        if (loadFailed) return;
        loadFailed = true;
        long secs = backoffMs / 1000;
        overlay.setText("Reconnecting\u2026\n\n" + currentUrl + "\n" + why
                + "\n\nRetrying in " + secs + "s\n\nHold OK or press MENU for settings");
        overlay.setVisibility(View.VISIBLE);
        handler.removeCallbacks(retry);
        handler.postDelayed(retry, backoffMs);
        backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX_MS);
    }

    private void onLoadOk() {
        backoffMs = BACKOFF_MIN_MS;
        overlay.setVisibility(View.GONE);
    }

    private static long goneSince;
    private static int goneCount;

    /**
     * The page's renderer crashed or was killed (for example low memory). Without this the whole
     * app would close. Rebuild the screen a few times, then stop and say so.
     */
    private void onRendererGone(WebView view) {
        handler.removeCallbacksAndMessages(null);
        if (view.getParent() instanceof android.view.ViewGroup) ((android.view.ViewGroup) view.getParent()).removeView(view);
        view.destroy();
        if (view == web) web = null;
        long now = SystemClock.elapsedRealtime();
        if (now - goneSince > 10 * 60_000) { goneSince = now; goneCount = 0; }
        goneCount++;
        overlay.setVisibility(View.VISIBLE);
        if (goneCount <= 3) {
            overlay.setText("The page stopped unexpectedly.\nRestarting\u2026");
            handler.postDelayed(new Runnable() { @Override public void run() { recreate(); } }, 2000);
        } else {
            overlay.setText("The page keeps stopping.\nHold OK or press MENU for Settings, or press Back twice to exit.");
        }
    }

    private class KioskClient extends WebViewClient {
        @Override
        public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
            Log.w(TAG, "renderer gone, crashed=" + (Build.VERSION.SDK_INT >= 26 && detail.didCrash()));
            onRendererGone(view);
            return true;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            if (!loadFailed) onLoadOk();
            if (!view.hasFocus()) view.requestFocus(View.FOCUS_DOWN);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
            if (req.isForMainFrame()) onLoadError(String.valueOf(err.getDescription()));
        }

        @SuppressWarnings("deprecation")
        @Override
        public void onReceivedError(WebView view, int code, String desc, String failingUrl) {
            if (Build.VERSION.SDK_INT < 23) onLoadError(desc);
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest req, WebResourceResponse resp) {
            if (req.isForMainFrame() && resp.getStatusCode() >= 500) {
                onLoadError("HTTP " + resp.getStatusCode());
            }
        }
    }

    // ---- Remote handling ----

    private static boolean isCenter(int k) {
        return k == KeyEvent.KEYCODE_DPAD_CENTER || k == KeyEvent.KEYCODE_ENTER
                || k == KeyEvent.KEYCODE_NUMPAD_ENTER || k == KeyEvent.KEYCODE_BUTTON_A;
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int k = e.getKeyCode();
        if (k == KeyEvent.KEYCODE_MENU || k == KeyEvent.KEYCODE_SETTINGS) {
            if (e.getAction() == KeyEvent.ACTION_UP) openSettings();
            return true;
        }
        if (isCenter(k)) {
            if (e.getAction() == KeyEvent.ACTION_DOWN) {
                if (e.getRepeatCount() == 0) {
                    centerDownAt = SystemClock.uptimeMillis();
                    centerLongHandled = false;
                    return true; // decide on release (short = click, long = settings)
                }
                if (!centerLongHandled && centerDownAt > 0
                        && SystemClock.uptimeMillis() - centerDownAt >= LONG_PRESS_MS) {
                    centerLongHandled = true;
                    openSettings();
                }
                return true;
            }
            if (e.getAction() == KeyEvent.ACTION_UP) {
                boolean wasLong = centerLongHandled
                        || (centerDownAt > 0 && SystemClock.uptimeMillis() - centerDownAt >= LONG_PRESS_MS);
                centerDownAt = -1;
                if (wasLong) {
                    if (!centerLongHandled) openSettings();
                    centerLongHandled = false;
                    return true;
                }
                // Short press: forward a synthetic click to the page.
                long t = SystemClock.uptimeMillis();
                super.dispatchKeyEvent(new KeyEvent(t, t, KeyEvent.ACTION_DOWN, k, 0));
                return super.dispatchKeyEvent(new KeyEvent(t, t, KeyEvent.ACTION_UP, k, 0));
            }
        }
        if (k == KeyEvent.KEYCODE_BACK) {
            if (e.getAction() == KeyEvent.ACTION_UP) {
                if (web == null || loadFailed || overlay.getVisibility() == View.VISIBLE) { exitOrWarn(); return true; }
                // Let the page close an open panel / step back first; exit only when it declines.
                web.evaluateJavascript(
                        "(function(){try{return window.kioskBack?String(window.kioskBack()):'false'}catch(e){return 'false'}})()",
                        new ValueCallback<String>() {
                            @Override public void onReceiveValue(String v) {
                                if (v != null && v.contains("true")) lastBackPress = 0;
                                else exitOrWarn();
                            }
                        });
            }
            return true;
        }
        return super.dispatchKeyEvent(e);
    }

    private void exitOrWarn() {
        long now = SystemClock.uptimeMillis();
        if (now - lastBackPress < BACK_WINDOW_MS) {
            finish();
        } else {
            lastBackPress = now;
            Toast.makeText(this, "Press Back again to exit", Toast.LENGTH_SHORT).show();
        }
    }

    private void openSettings() {
        sessionUrl = null;  // Settings is the source of truth once opened
        startActivity(new Intent(this, SettingsActivity.class));
    }

    @SuppressWarnings("deprecation")
    private void hideSystemUi() {
        View d = getWindow().getDecorView();
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = d.getWindowInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }
    }
}
