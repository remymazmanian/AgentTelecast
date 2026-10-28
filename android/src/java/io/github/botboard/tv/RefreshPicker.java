package io.github.botboard.tv;

import android.content.Context;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;

/**
 * A row of buttons for the data refresh interval (Off, 1, 5, 15, 30 min, 1 hour). Works with the
 * D-pad: left/right moves, OK picks. The picked one is marked with a check. selected = -1 means
 * "not set", so the page uses the feed's setting or its default.
 */
final class RefreshPicker {
    final LinearLayout row;
    int selected;
    private final Button[] buttons = new Button[Prefs.REFRESH_CHOICES.length];

    /** Lets a screen build the buttons in its own style. Null means plain buttons. */
    interface Styler { Button make(String label, View.OnClickListener l); }

    RefreshPicker(Context c, int current, Styler styler, int textSp) {
        row = new LinearLayout(c);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
        for (int i = 0; i < buttons.length; i++) {
            final int m = Prefs.REFRESH_CHOICES[i];
            View.OnClickListener l = new View.OnClickListener() { public void onClick(View v) { select(m); } };
            Button b = styler != null ? styler.make(Prefs.refreshLabel(m), l) : null;
            if (b == null) {
                b = new Button(c);
                b.setAllCaps(false);
                b.setTextSize(textSp);
                b.setOnClickListener(l);
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                lp.setMarginEnd(16);
                b.setLayoutParams(lp);
            }
            buttons[i] = b;
            row.addView(b);
        }
        select(current);
    }

    void select(int m) {
        selected = m;
        for (int i = 0; i < buttons.length; i++) {
            int v = Prefs.REFRESH_CHOICES[i];
            buttons[i].setText((v == m ? "\u2713 " : "") + Prefs.refreshLabel(v));
        }
    }
}
