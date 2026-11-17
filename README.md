# Solara Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kazamisao/gta6-01-r3/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kazamisao/gta6-01-r3/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solara Bay is a top-down open-world crime game for the desktop browser. It is plain JavaScript end to end — ES modules, a canvas renderer, no build step and no asset files. The city is generated from a fixed seed, the art is drawn in code, and every sound is synthesized live with WebAudio. Served as static files it plays fully offline. The game, its city, characters, story and sound are all original to this entry, which was built by an AI agent for make.fun's "Make GTA 6" bounty (gta6-01).

## The city

The world is 3200×2400 units of boulevard grid: roads every 400 units with sidewalks and palm trees, buildings packed into the blocks between them, and a beach running into the sea along the southern edge. Six named districts divide the map — Palm Heights, Solara Point, Harbor Point, Old Market, the Marina District and Coral Flats — and the HUD names the one you are standing in. Because generation is seeded, the city is identical on every visit.

## The story

You are Rio Calloway, a driver who owes money to the wrong people. Fixer Marisol "Sol" Vega offers a way out: four jobs against the Coral Kings crew, each a short chain of steps tracked by the objective banner.

1. **First Wheels** ($150) — meet Sol at her marina office, steal a car, and deliver it to the Harbor Point Warehouse.
2. **Ledger Run** ($250) — lift a payoff ledger from Old Market Alley, fight off the two guards who ambush you, and get it to the Palm Heights Safehouse.
3. **Heat Wave** ($400) — wreck both Coral Kings crew cars parked in Coral Flats, then lose the police.
4. **Low Tide** ($800) — take Dario Venn's evidence case from his estate pier, past three guards, and bring it back to Sol.

When the chain is done the city stays open: keep driving, keep your cash, keep out of trouble — or don't.

## On the street

- **Traffic and pedestrians.** AI cars work the grid on the right-hand side, turn at intersections and brake for the car ahead; pedestrians stroll the sidewalks and run when there is gunfire or a crash nearby. Sedans, sports cars and vans all drive differently, and parked cars line the streets waiting to be borrowed.
- **Driving.** Any car can be stolen. The physics are shared by every vehicle: the pedal brakes while you are rolling forward and only engages reverse once you have stopped, and steering bites in proportion to speed. A sports car tops out faster than a police cruiser; a van does not.
- **The wanted system.** Crimes — theft, collisions, shots fired, pedestrians hit, crew cars wrecked — add heat. Heat becomes one to five stars, and stars send out up to six police cars that steer straight at you and ram. Heat only drains while no officer can see you, so breaking line of sight is the way to cool down. If the police pin you, a busted meter fills: you pay a fine of up to $120 and walk out of the marina. Lose all your health and you are wasted instead — up to $80 in fees, and you wake up at the marina.
- **Combat.** Aim with the mouse and fire with F or a click. Mission guards shoot back.
- **HUD and minimap.** Health, cash, wanted stars, weapon state, district and the current objective are painted over the game; the corner minimap shows the road grid, the beach, traffic, police and the mission marker.
- **Sound.** There are no audio files. An engine loop and a police siren loop bend with the action, and one-shot synth sounds cover gunshots, crashes, doors, pickups and the mission-complete jingle.
- **Saves.** Cash, mission progress and where you stood are kept in localStorage and restored on the next visit. You start with $50.

## Run it

You need Node 22. From the repository root:

```
node serve.ts
```

then open http://localhost:8080 in desktop Chrome. If port 8080 is taken, pass `--port <n>` to `serve.ts` and use that port in the address instead.

## Controls

- **WASD / arrow keys** — walk on foot, drive in a car
- **Shift** — sprint on foot
- **E** — get into or out of a car
- **Mouse** — aim; **left click or F** — fire
- **S / ↓ in a car** — brake; keep holding it once stopped to reverse
- **P or Esc** — pause
- **Enter or Space** — confirm on the title, BUSTED and WASTED screens

## Repository layout

- `game/` — the game itself: `index.html` and the ES modules under `game/src/` (city generation, entities and their drivers, physics, the wanted system, missions, combat, rendering, HUD and minimap, audio, saves)
- `serve.ts` — the small static server above; standard library only, bound to 127.0.0.1, and it refuses paths outside `game/`
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` into the output directory and writes `dossier.json` with the vendored library, refusing first if any of the scorer's size caps would be exceeded
- `vendor/` — the vendored make.fun game library `main.ts` builds the dossier with
- `screenshots/` and `shots.json` — three frames of the game (a chase, a drive, on foot) and the `?scene=` queries that stage them
- `tests/` — headless tests over the pure logic modules (city, physics, wanted, missions, saves, audio dispatch); run them with `node tests/run.mjs`
