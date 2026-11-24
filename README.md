# Flappy Bird — Web Edition

A dependency-free Flappy Bird game built with HTML5 Canvas, CSS, and vanilla JavaScript.

## Play

Open `index.html` in a browser, or serve the folder locally:

```bash
npx serve .
```

## Controls

| Action | Input |
| --- | --- |
| Flap | Click, tap, `Space`, `↑`, or `W` |
| Pause / resume | `P` or `Esc` (auto-pauses when you switch away) |
| Toggle sound | 🔊 button in the footer |

## Cross-platform support

Runs in modern browsers on Windows, macOS, Linux, Android, and iOS, on desktop, tablet, and phone, in both portrait and landscape.

- Responsive board scales to the available screen height/width with no page scrolling
- Touch (`pointerdown` with legacy touch/mouse fallback), mouse, and keyboard input
- High-DPI canvas rendering with resize/orientation handling
- Safe-area insets for notched phones
- WebAudio sound unlocked correctly on iOS/Safari
- Installable as a standalone web app via `manifest.webmanifest` (Android: "Install app", iOS: "Add to Home Screen")

## Features

- Parallax background, scrolling ground, animated bird and pipes
- Score tracking with a persistent personal best (`localStorage`)
- Local top-10 leaderboard — one row per pilot with their best score and date
- Medals for score milestones and a "New Best" notice
- Particle effects and synthesized sound effects via WebAudio
- Gradually increasing difficulty
- Responsive, mobile-friendly layout with high-DPI canvas rendering

## Files

- `index.html` — page structure and overlays
- `style.css` — styling and responsive layout
- `game.js` — game loop, physics, rendering, audio, and leaderboard
- `manifest.webmanifest`, `icon.svg`, `icon-*.png` — installable web-app metadata and icons
