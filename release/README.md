# AgentTelecast for Android TV (APK)

`AgentTelecast-1.0.0.apk` is the Android TV app. It shows an AgentTelecast page full screen and lets you
drive it with the TV remote. It works on Android TV and Google TV devices running Android 5.0 or newer.

Download the APK and `SHA256SUMS` from the [latest release](https://github.com/remymazmanian/agenttelecast/releases/latest). Those files are release assets. This folder keeps the install notes.

## Check the download

`SHA256SUMS` lists the file's checksum. On macOS or Linux:

```sh
shasum -a 256 -c SHA256SUMS
```

## Install

The app isn't in the Play Store, so you sideload it. Pick one way.

**With adb from a computer**

1. On the TV: Settings → Device Preferences → About → click **Build** seven times to turn on developer options.
2. Settings → Device Preferences → Developer options → turn on **USB debugging** (on some devices also **Network debugging**).
3. Find the TV's address under Settings → Network.
4. On the computer:

   ```sh
   adb connect <tv-address>:5555
   adb install AgentTelecast-1.0.0.apk
   ```

   Accept the prompt on the TV the first time.

**With the Downloader app on the TV**

1. Install **Downloader** (by AFTVnews) from the TV's app store.
2. Allow it to install unknown apps (Settings → Apps → Security & restrictions → Unknown sources).
3. Enter the APK link from the release page,
   `https://github.com/remymazmanian/agenttelecast/releases/download/v1.0.0/AgentTelecast-1.0.0.apk`, and install it.

To update later, install the new APK the same way. Your settings are kept as long as the new APK
is signed with the same key as the old one.

## First run

The app doesn't start by itself when the TV turns on. Open it from the apps row
(on Google TV: Apps, or Settings → Apps → See all apps).

With no page saved yet, the app opens a setup screen:

- Type the address of your AgentTelecast page (for example the `index.html` you serve on your home
  network) with the on-screen keyboard.
- **Test** checks that the TV can reach it. If it can't, you see why, and can still choose **Save anyway**.
- **Save** stores it and opens the dashboard.
- **Try demo** opens the built-in demo page with made-up data, no server needed.

Change it later from Settings: hold **OK** or press **MENU** on the dashboard. Leave the address empty
and save to see the setup screen again.

## Remote controls

| Button | What it does |
|---|---|
| Arrows | Move between sections and cards |
| OK | Open the highlighted card or section |
| Back | Close the open panel or step back; press twice quickly to exit |
| Hold OK, or MENU | Settings (page address, auto-reload, text zoom) |

## Privacy

The app loads only the page address you give it (or the built-in demo). It has no analytics,
no ads, no accounts and sends nothing anywhere else.
