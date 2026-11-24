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
| Pause / resume | `P` or `Esc` |
| Toggle sound | 🔊 button in the footer |

## Features

- Parallax background, scrolling ground, animated bird and pipes
- Score tracking with a persistent personal best (`localStorage`)
- Local top-10 leaderboard with pilot names and dates
- Medals for score milestones and a "New Best" notice
- Particle effects and synthesized sound effects via WebAudio
- Gradually increasing difficulty
- Responsive, mobile-friendly layout with high-DPI canvas rendering

## Files

- `index.html` — page structure and overlays
- `style.css` — styling and responsive layout
- `game.js` — game loop, physics, rendering, audio, and leaderboard
