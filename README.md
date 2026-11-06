<p align="center"><img src="favicon.svg" width="72" alt="ClockOut logo"></p>

# ClockOut

**Your time. Your checkout.**

ClockOut is a tiny, static web app that answers two questions:

1. **How much office time is left today?**
2. **At what exact time can I check out?**

No frameworks, no backend, no build step. Just `index.html`, `style.css` and `script.js`.

## Features

- **Two modes**
  - **Check-in** – enter when you arrived; the checkout time and a live countdown are calculated from the current time.
  - **Last swipe** – enter the completed time your attendance system reported and the time it was recorded (e.g. *"4h 30m completed till 1:30 PM"*). The checkout time is based on that recorded time, not the current clock.
- **Required hours** – defaults to 9 hours; quick buttons for 8h, 8h 30m, 9h, or type any custom duration.
- **12H / 24H** – every displayed time follows the toggle, with AM/PM dropdowns in 12H mode. Switching converts what you already typed.
- **Optional seconds** – a *Seconds* switch adds `ss` fields and a per-second live countdown. Leave it off for a minutes-only view.
- **Light / dark mode** – follows your device by default; toggle with the sun/moon button.
- **Smart handling of edge cases**
  - Overtime is shown separately (never negative hours): *"You're done for the day!"*
  - Overnight shifts, with a *Tomorrow / Yesterday* label next to the checkout time.
  - Future check-in or till times are flagged as invalid, with a hint to tick **This was yesterday** when relevant.
  - Friendly validation for hours, minutes and seconds out of range.
  - Refreshes immediately when you return to the tab.
- **Remembers your inputs** via `localStorage` (nothing sensitive, nothing leaves your device).
- **Installable** – add it to your phone's home screen and it opens like an app (web manifest + icons included).
- Mobile-first, responsive, no external APIs. Only the Manrope font is loaded from Google Fonts (falls back to the system font).

## Run locally

Open `index.html` in any modern browser. No install needed.

## Deploy on GitHub Pages

1. Push these files to a GitHub repository (keep `index.html` at the repo root).
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then **Save**.
4. After a minute your site is live at `https://<your-username>.github.io/<repo-name>/`.

## How the calculation works

All math is done in whole seconds using your device's local time zone.

```
Remaining  = Required − Completed
Checkout   = Reference time + Remaining
```

| Mode | Reference time | Completed |
| --- | --- | --- |
| Check-in | Your check-in time | Time since check-in |
| Last swipe | The time you entered | The duration you entered, plus time elapsed since then |

Breaks are **not** deducted automatically. The calculator trusts the completed time you provide.

## Project structure

```
index.html            Markup and page metadata
manifest.webmanifest  Home-screen install info
favicon.svg           Browser tab icon
apple-touch-icon.png  iPhone home-screen icon
icon-192.png / icon-512.png  Android / PWA icons
og-image.png          Link-preview image (WhatsApp, LinkedIn, etc.)
style.css    Styles (light/dark themes, responsive layout)
script.js    Calculation, validation, rendering, persistence
```

## Link previews

For the preview image to show when you share the link, change `og-image.png` in `index.html` to your full URL after deploying, for example `https://<your-username>.github.io/<repo-name>/og-image.png`.

## Browser support

Current versions of Chrome, Edge, Firefox and Safari (desktop and mobile).
