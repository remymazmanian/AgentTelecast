package io.github.botboard.tv;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

/** Plain, remote-friendly settings screen. Values are stored in SharedPreferences. */
public class SettingsActivity extends Activity {
    private EditText url, reload, zoom;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(96, 64, 96, 64);

        TextView title = text("AgentTelecast settings", 30);
        col.addView(title);
        col.addView(text("Dashboard URL", 20));
        url = edit(Prefs.url(this), InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        col.addView(url);
        col.addView(text("Auto-reload every N minutes (0 = off)", 20));
        reload = edit(String.valueOf(Prefs.reloadMinutes(this)), InputType.TYPE_CLASS_NUMBER);
        col.addView(reload);
        col.addView(text("Text zoom % (100 = normal)", 20));
        zoom = edit(String.valueOf(Prefs.textZoom(this)), InputType.TYPE_CLASS_NUMBER);
        col.addView(zoom);

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.START);
        row.setPadding(0, 32, 0, 0);
        row.addView(button("Save", new View.OnClickListener() { public void onClick(View v) { save(); } }));
        row.addView(button("Setup screen", new View.OnClickListener() { public void onClick(View v) {
            Intent i = new Intent(SettingsActivity.this, SetupActivity.class);
            i.putExtra("prefill", url.getText().toString());
            startActivity(i);
            finish();
        } }));
        row.addView(button("Reset to default", new View.OnClickListener() { public void onClick(View v) {
            url.setText(Flavor.LEGACY_URL);
            reload.setText(String.valueOf(Prefs.DEFAULT_RELOAD_MIN));
            zoom.setText(String.valueOf(Prefs.DEFAULT_TEXT_ZOOM));
        } }));
        row.addView(button("Cancel", new View.OnClickListener() { public void onClick(View v) { finish(); } }));
        col.addView(row);

        col.addView(text("\nLeave the URL empty and save to see the first-run setup screen again.\nDemo page: " + Prefs.DEMO_URL, 16));

        ScrollView sv = new ScrollView(this);
        sv.addView(col);
        setContentView(sv);
        url.requestFocus();
    }

    private void save() {
        String u = Prefs.normalizeUrl(url.getText().toString());
        String err = u.isEmpty() ? null : Prefs.validate(u);
        if (err != null) { Toast.makeText(this, err, Toast.LENGTH_LONG).show(); url.requestFocus(); return; }
        int r = parse(reload.getText().toString(), Prefs.DEFAULT_RELOAD_MIN, 0, 1440);
        int z = parse(zoom.getText().toString(), Prefs.DEFAULT_TEXT_ZOOM, 50, 300);
        Prefs.sp(this).edit()
                .putInt(Prefs.K_RELOAD, r)
                .putInt(Prefs.K_ZOOM, z)
                .apply();
        Prefs.saveUrl(this, u);
        Toast.makeText(this, "Saved", Toast.LENGTH_SHORT).show();
        finish();
    }

    private static int parse(String s, int def, int min, int max) {
        try { return Math.max(min, Math.min(max, Integer.parseInt(s.trim()))); }
        catch (Exception e) { return def; }
    }

    private TextView text(String s, int sp) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(0xFFDDE6EE);
        t.setPadding(0, 24, 0, 8);
        return t;
    }

    private EditText edit(String v, int type) {
        EditText e = new EditText(this);
        e.setText(v);
        e.setInputType(type);
        e.setSingleLine(true);
        e.setTextSize(22);
        e.setTextColor(0xFFFFFFFF);
        e.setSelectAllOnFocus(true);
        e.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT));
        return e;
    }

    private Button button(String label, View.OnClickListener l) {
        Button b = new Button(this);
        b.setText(label);
        b.setTextSize(20);
        b.setOnClickListener(l);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMarginEnd(24);
        b.setLayoutParams(lp);
        return b;
    }
}
