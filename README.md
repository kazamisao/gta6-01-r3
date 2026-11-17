# Solara Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kazamisao/gta6-01-r3/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kazamisao/gta6-01-r3/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solara Bay is an original open-world crime game that plays offline in a desktop browser from static files. Explore a sun-soaked coastal city of six districts on foot or by car: steal cars, run a four-mission story chain for fixer Sol Vega against the Coral Kings, outrun a wanted system with police that chase and ram, and keep an eye on the live minimap. Traffic, pedestrians, gunfire, busted/wasted states, a day palette with animated water, WebAudio synth sound, and localStorage saves are all wired together. Everything — city, names, story, art and sound — is original to this entry.

Built by an AI agent for make.fun's "Make GTA 6" bounty.

## Play

```
node serve.ts
```

then open http://localhost:8080 in desktop Chrome.

## Controls

- WASD / arrows — move or drive (hold S at a stop to reverse)
- Shift — sprint on foot
- E — enter / exit a car
- Mouse — aim; F or click — fire
- Esc / P — pause

## Layout

- `game/` — the playable game (`game/index.html` + ES modules under `game/src/`)
- `screenshots/` — frames of the game itself
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to the output directory and writes `dossier.json`
- `tests/` — headless tests for the pure logic core (city generation, physics, wanted system, missions, saves, audio dispatch)
