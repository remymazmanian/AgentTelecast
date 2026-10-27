package io.github.botboard.tv;

/** Build-specific constants. */
final class Flavor {
    /** URL used when none was ever saved. Empty means the setup screen opens on first launch. */
    static final String LEGACY_URL = "";
    /** Added to the WebView user agent; the page switches to its TV layout when it sees it. */
    static final String UA_TOKEN = "AgentTelecastTV/1.0.0";
    private Flavor() {}
}
