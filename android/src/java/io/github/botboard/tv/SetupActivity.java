package io.github.botboard.tv;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * First-run setup, shown when no dashboard URL is saved. Built for the TV remote: every control is
 * reachable with the D-pad, the URL box opens the on-screen keyboard on OK, and quick-fill buttons
 * cover the common pieces of an address. Result: RESULT_OK once a URL (or the demo) is saved.
 */
public class SetupActivity extends Activity {
    private static final int TIMEOUT_MS = 5000;
    private static final int C_BG = 0xFF0B0F15, C_TXT = 0xFFEEF1F6, C_TXT2 = 0xFFB4BCCB, C_ACC = 0xFF4F8DFF,
            C_OK = 0xFF3CCF8E, C_BAD = 0xFFFF6B6B, C_BTN = 0xFF1A2130;

    private final Handler ui = new Handler(Looper.getMainLooper());
    private EditText url;
    private TextView status;
    private Button saveBtn;
    private RefreshPicker refresh;
    private String failedUrl;   // last URL that failed the test; a second Save keeps it anyway
    private int testSeq;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(dp(64), dp(40), dp(64), dp(40));
        col.setBackgroundColor(C_BG);

        col.addView(text("Set up AgentTelecast", 30, C_TXT, true));
        col.addView(text("Enter the address of your AgentTelecast page, for example http://agenttelecast.local:8099/ . "
                + "Select the box and press OK to type with the on-screen keyboard, or use the buttons below it.", 17, C_TXT2, false));

        url = new EditText(this);
        url.setSingleLine(true);
        url.setTextSize(24);
        url.setTextColor(Color.WHITE);
        url.setHintTextColor(0xFF6B7588);
        url.setHint("http://");
        url.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        url.setImeOptions(EditorInfo.IME_ACTION_DONE);
        url.setId(View.generateViewId());
        url.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        url.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            @Override public boolean onEditorAction(TextView v, int id, KeyEvent e) { saveBtn.requestFocus(); return false; }
        });
        col.addView(url);

        LinearLayout chips = row();
        for (final String piece : new String[] { "http://", "https://", ".local", ":8099", "/" }) {
            chips.addView(button(piece, false, new View.OnClickListener() { public void onClick(View v) { insert(piece); } }));
        }
        chips.addView(button("Delete", false, new View.OnClickListener() { public void onClick(View v) { backspace(); } }));
        chips.addView(button("Clear", false, new View.OnClickListener() { public void onClick(View v) { url.setText(""); onEdited(); } }));
        col.addView(chips);

        status = text("", 18, C_TXT2, false);
        status.setMinLines(2);
        col.addView(status);

        col.addView(text("Look for new data every", 17, C_TXT2, false));
        refresh = new RefreshPicker(this, Prefs.savedRefresh(this), new RefreshPicker.Styler() {
            public Button make(String label, View.OnClickListener l) { return button(label, false, l); }
        }, 18);
        refresh.row.setPadding(0, dp(4), 0, dp(6));
        col.addView(refresh.row);

        LinearLayout actions = row();
        saveBtn = button("Save", true, new View.OnClickListener() { public void onClick(View v) { save(); } });
        actions.addView(saveBtn);
        actions.addView(button("Test", false, new View.OnClickListener() { public void onClick(View v) { test(false); } }));
        actions.addView(button("Try demo", false, new View.OnClickListener() { public void onClick(View v) { finishWith(Prefs.DEMO_URL); } }));
        col.addView(actions);

        col.addView(text("Change it later: hold OK (or press MENU) on the dashboard to open Settings.", 15, 0xFF7A8496, false));

        ScrollView sv = new ScrollView(this);
        sv.setBackgroundColor(C_BG);
        sv.setFillViewport(true);
        sv.addView(col);
        setContentView(sv);

        String pre = getIntent() != null ? getIntent().getStringExtra("prefill") : null;
        if (pre != null && !pre.equals(Prefs.DEMO_URL)) url.setText(pre);
        url.setSelection(url.getText().length());
        url.addTextChangedListener(new android.text.TextWatcher() {
            public void beforeTextChanged(CharSequence s, int a, int c, int d) {}
            public void onTextChanged(CharSequence s, int a, int c, int d) {}
            public void afterTextChanged(android.text.Editable s) { onEdited(); }
        });
        url.requestFocus();
    }

    private void onEdited() {
        failedUrl = null;
        saveBtn.setText("Save");
        testSeq++;
        setStatus("", C_TXT2);
    }

    private void insert(String piece) {
        int a = Math.max(0, url.getSelectionStart()), z = Math.max(0, url.getSelectionEnd());
        url.getText().replace(Math.min(a, z), Math.max(a, z), piece);
    }

    private void backspace() {
        int a = Math.max(0, url.getSelectionStart()), z = Math.max(0, url.getSelectionEnd());
        if (a != z) url.getText().delete(Math.min(a, z), Math.max(a, z));
        else if (a > 0) url.getText().delete(a - 1, a);
    }

    private String current() { return Prefs.normalizeUrl(url.getText().toString()); }

    private void save() {
        String u = current();
        String err = Prefs.validate(u);
        if (err != null) { setStatus(err, C_BAD); url.requestFocus(); return; }
        if (u.equals(failedUrl)) { finishWith(u); return; }   // "Save anyway"
        test(true);
    }

    /** Fetches the URL in the background (5 s timeouts). When saving, a reachable URL is saved right away. */
    private void test(final boolean thenSave) {
        final String u = current();
        String err = Prefs.validate(u);
        if (err != null) { setStatus(err, C_BAD); return; }
        if (u.equals(Prefs.DEMO_URL)) { if (thenSave) finishWith(u); else setStatus("Built-in demo page.", C_OK); return; }
        final int seq = ++testSeq;
        setStatus("Checking " + u + " \u2026", C_TXT2);
        new Thread(new Runnable() {
            @Override public void run() {
                final String[] res = probe(u);   // {ok?"1":"", message}
                ui.post(new Runnable() {
                    @Override public void run() {
                        if (seq != testSeq || isFinishing()) return;
                        boolean ok = res[0].length() > 0;
                        if (ok && thenSave) { finishWith(u); return; }
                        if (ok) { setStatus(res[1], C_OK); return; }
                        failedUrl = u;
                        saveBtn.setText("Save anyway");
                        setStatus("Can't reach " + u + "\n" + res[1] + "\nCheck the address and that the computer serving it is on. "
                                + "Choose Save anyway to keep it.", C_BAD);
                    }
                });
            }
        }, "setup-test").start();
    }

    static String[] probe(String u) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(u).openConnection();
            c.setConnectTimeout(TIMEOUT_MS);
            c.setReadTimeout(TIMEOUT_MS);
            c.setInstanceFollowRedirects(true);
            c.setRequestProperty("User-Agent", "AgentTelecastSetup");
            int code = c.getResponseCode();
            if (code < 200 || code >= 400) return new String[] { "", "The server answered HTTP " + code + "." };
            byte[] buf = new byte[16384];
            int n = 0, r;
            InputStream in = c.getInputStream();
            while (n < buf.length && (r = in.read(buf, n, buf.length - n)) > 0) n += r;
            String head = new String(buf, 0, n, "UTF-8");
            boolean looks = head.contains("data-version=") || head.contains("AgentTelecast");
            return new String[] { "1", "Reachable (HTTP " + code + ")." + (looks ? " It looks like an AgentTelecast page." : " It doesn't look like an AgentTelecast page, but it will open.") };
        } catch (java.net.SocketTimeoutException e) {
            return new String[] { "", "No answer within " + (TIMEOUT_MS / 1000) + " seconds." };
        } catch (java.net.UnknownHostException e) {
            return new String[] { "", "Unknown host name." };
        } catch (java.net.ConnectException e) {
            return new String[] { "", "Connection refused or no route to that address." };
        } catch (Exception e) {
            return new String[] { "", e.getClass().getSimpleName() + (e.getMessage() != null ? ": " + e.getMessage() : "") };
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private void finishWith(String u) {
        Prefs.saveUrl(this, u);
        Prefs.saveRefresh(this, refresh.selected);
        setResult(RESULT_OK);
        finish();
    }

    private void setStatus(String s, int color) { status.setText(s); status.setTextColor(color); }

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    private LinearLayout row() {
        LinearLayout r = new LinearLayout(this);
        r.setOrientation(LinearLayout.HORIZONTAL);
        r.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
        r.setPadding(0, dp(14), 0, dp(6));
        return r;
    }

    private TextView text(String s, int sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(color);
        if (bold) t.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        t.setPadding(0, dp(10), 0, dp(6));
        return t;
    }

    private Button button(String label, boolean primary, View.OnClickListener l) {
        Button b = new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextSize(18);
        b.setTextColor(Color.WHITE);
        b.setFocusable(true);
        b.setPadding(dp(18), dp(8), dp(18), dp(8));
        StateListDrawable bg = new StateListDrawable();
        bg.addState(new int[] { android.R.attr.state_focused }, round(primary ? C_ACC : 0xFF33405A, Color.WHITE));
        bg.addState(new int[] {}, round(primary ? 0xFF2F5DB8 : C_BTN, 0));
        b.setBackground(bg);
        b.setOnClickListener(l);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMarginEnd(dp(12));
        b.setLayoutParams(lp);
        return b;
    }

    private GradientDrawable round(int fill, int stroke) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(fill);
        g.setCornerRadius(dp(10));
        if (stroke != 0) g.setStroke(dp(2), stroke);
        return g;
    }
}
