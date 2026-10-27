# Contributing

Issues and pull requests are welcome. Remy Mazmanian reviews and merges pull requests.

No signing keys belong in the repo. Never commit keystores, passwords or .env files. Release APKs are signed by the maintainer. CI may build unsigned or debug builds only.

The 1920x1080 TV layout is final and must stay pixel-identical. Responsive web work must not change that layout.

The Android app must never auto-launch on boot. The application id is com.remymazmanian.agenttelecast.

Screenshots and other public assets use made-up demo data only.

The license is MIT. If you share work based on this project, a link back or shout-out to @remymazmanian is welcome, and it is optional.

Internal names that stay: Java package io.github.botboard.tv and CSS class .gbot. The user agent token is AgentTelecastTV, the page global is window.AgentTelecast, and the default storage keys are agenttelecast.v1 (view state) and agenttelecast.feed (feed URL). A build made with its own --storage-key keeps that key. On load, an empty default key is filled from the previous default key, and the previous key is removed.
