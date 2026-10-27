package io.github.botboard.tv;

import android.content.Context;
import android.content.SharedPreferences;

final class Prefs {
    /** The demo page bundled in the APK (assets/agenttelecast/index.html). */
    static final String DEMO_URL = "file:///android_asset/agenttelecast/index.html";
    static final int DEFAULT_RELOAD_MIN = 5;
    static final int DEFAULT_TEXT_ZOOM = 100;

    private static final String FILE = "kiosk";
    static final String K_URL = "url";
    static final String K_RELOAD = "reload_minutes";
    static final String K_ZOOM = "text_zoom";

    private Prefs() {}

    static SharedPreferences sp(Context c) {
        return c.getSharedPreferences(FILE, Context.MODE_PRIVATE);
    }
    /** Saved dashboard URL, or "" when none is set (then the setup screen is shown). */
    static String url(Context c) {
        String u = sp(c).getString(K_URL, null);
        if (u != null && !u.trim().isEmpty()) return u;
        return Flavor.LEGACY_URL;
    }
    static boolean hasUrl(Context c) { return !url(c).isEmpty(); }
    static void saveUrl(Context c, String u) {
        if (u == null || u.trim().isEmpty()) sp(c).edit().remove(K_URL).apply();
        else sp(c).edit().putString(K_URL, u).apply();
    }
    static int reloadMinutes(Context c) { return sp(c).getInt(K_RELOAD, DEFAULT_RELOAD_MIN); }
    static int textZoom(Context c) { return sp(c).getInt(K_ZOOM, DEFAULT_TEXT_ZOOM); }

    /** Adds http:// when no scheme is given. Returns "" for blank input. */
    static String normalizeUrl(String u) {
        if (u == null) return "";
        u = u.trim();
        if (u.isEmpty()) return "";
        if (!u.matches("(?i)^[a-z][a-z0-9+.-]*://.*")) u = "http://" + u;
        return u;
    }

    /** Returns a short error for a URL the app can't use, or null when it looks fine. */
    static String validate(String u) {
        if (u == null || u.isEmpty()) return "Enter the address of your AgentTelecast page.";
        if (u.equals(DEMO_URL)) return null;
        android.net.Uri p;
        try { p = android.net.Uri.parse(u); } catch (Exception e) { return "That doesn't look like a web address."; }
        String s = p.getScheme() == null ? "" : p.getScheme().toLowerCase(java.util.Locale.US);
        if (!s.equals("http") && !s.equals("https")) return "Use an address that starts with http:// or https://";
        String h = p.getHost();
        if (h == null || h.isEmpty()) return "The address needs a host name or IP, e.g. http://agenttelecast.local:8099/";
        if (h.contains(" ")) return "The host name can't contain spaces.";
        if (p.getPort() > 65535) return "The port number is too large.";
        return null;
    }
}
