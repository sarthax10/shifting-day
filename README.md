<p align="center">
  <a href="https://sarthax10.github.io/shifting-day/"><img src="docs/readme/title.jpg" alt="Shifting Day: the title screen, a hand-cut wordmark with a black cat peeking over it, a halftone sun, and the moving truck rolling past" width="100%"></a>
</p>

<p align="center">
  <img src="docs/readme/strap.svg" alt="Everything you own · one small truck" width="100%">
</p>

<p align="center">
  <a href="https://sarthax10.github.io/shifting-day/"><b>▶&nbsp;&nbsp;PLAY IN YOUR BROWSER</b></a>
  &nbsp;&nbsp;·&nbsp;&nbsp;desktop, gamepad or phone (held sideways)
</p>
<p align="center"><sub>MADE BY <b>SARTHAX10</b></sub></p>

<br>

<img src="docs/readme/h-pitch.svg" alt="01 · The pitch" width="100%">

You're moving out of a falling-down house and into a manor by the sea. Everything you own goes on the back of one small truck, along with the cat, and the road between here and there has hills, toll gates, level crossings and cliffs. Every bump shifts the load.

Stack it well, tie it down, drive it gently, and catch whatever bounces off before it's gone for good.

<p align="center">
  <img src="docs/readme/old-street.jpg" alt="Old Street: the leaning, patched-up old house with the furniture piled in front of it and the truck waiting" width="49%">
  <img src="docs/readme/home-stretch.jpg" alt="Home: the manor by the sea under a HOME banner at the end of the road" width="49%">
</p>
<p align="center"><sub>FROM THIS &nbsp;·&nbsp; TO THIS</sub></p>

<br>

<img src="docs/readme/h-play.svg" alt="02 · How to play" width="100%">

**Pack.** Drag things from the pile onto the truck. Turn them to fit, stack them, and tie the wobbly ones down with rope. Fragile things break and pets have opinions.

**Drive.** A real gearbox: let the handbrake off, pull away in first and change up when the gear light goes red. Stop at toll gates and level crossings with the handbrake on. Stall it in too high a gear and you'll have to start again in first.

**Climb and catch.** The roof-mounted anchor crossbow fires a grapple. Shoot the top of a cliff that's too steep to drive, then reel the truck up it. Shoot something that's just fallen off and it gets reeled straight back onto the bed.

**Deliver.** Park between the cones at each stop, and the leg is scored (see [Scoring](#scoring)). Whatever fell off waits in the stop's Lost & Found, and you buy it back with the bubble wrap you collect on the road.

**Race.** Finish the trip, put your name on the run and send it to the [leaderboard](#the-leaderboard).

The game teaches itself as you go: when something new comes up, a key-cap prompt appears right next to it and goes away once you've done it.

<p align="center">
  <img src="docs/readme/maple-valley.jpg" alt="Maple Valley: the truck under red and gold maples by the waterfall" width="100%">
</p>

<br>

<a id="scoring"></a>
<img src="docs/readme/h-score.svg" alt="03 · Scoring" width="100%">

Every stop banks a score for the leg you just drove. The trip's score is the five legs added up.

| On each leg | Points |
|---|---|
| **Everything on the truck and in one piece** | its worth, counted again at every stop |
| **Parking** square between the cones | +10 to +100 |
| **Clean leg:** nothing fell off or broke | +50 |
| **Speed bonus:** every whole second at 50 km/h or more | +5 a second |
| **Breakage:** anything that broke on this leg | minus half its worth |

So whatever you carry safely pays at every stop, and something lost early costs you every leg after, unless you buy it back at a Lost & Found.

**The speed bonus** takes top gear: third runs out of revs just under 50 km/h. While you hold it, a strip of ember tape under the score counts the points up. It's a gamble: the faster you take the bumps, the more shakes loose.

**What things are worth.** Biscuit the cat 250, the grandfather clock 220, Sunny the canary 200, Goldie the fish 160, the fridge 150, the guitar 140, the sofa and the record player 120, the washing machine 110, the old TV and the armchair 90, the bookshelf 80, the rug and the suitcase 70, the mattress, the monstera and the toolbox 60, the jam and the floor lamp 50, the boxes 20 to 40, and the kitchen chair 30.

**Stars.** 1,500 points for one star, 3,000 for two, 4,500 for three.

**The clock.** A run clock counts the whole move, packing included, and your best time is kept. Time is scored apart from points, so emptying the truck to race never wins the TOP SCORE board, and a careful run never wins FASTEST.

<p align="center">
  <img src="docs/readme/checkpoint.jpg" alt="A checkpoint card: still on the truck, parking, clean leg, speed bonus and breakage, then the leg's score" width="49%">
  <img src="docs/readme/speed-bonus.jpg" alt="The truck at speed in a tunnel, the speed bonus strip counting up under the score" width="49%">
</p>

<br>

<a id="the-leaderboard"></a>
<img src="docs/readme/h-board.svg" alt="04 · The leaderboard" width="100%">

At the end of the trip, press **LEADERBOARD** on the score card, put your name on the run (up to 12 letters) and send it. **LEADERBOARD** on the title menu opens the boards any time, just to look.

| Board | Ranks |
|---|---|
| **FASTEST** | whole trips by time, with each one's score beside it |
| **TOP SCORE** | whole trips by points, with each one's time beside it |
| **BY LEG** | any one of the five legs, by the fastest time or the best score on it |

**Tap a name** to open that run's card: its total, time, stars and date, which pets made it home, and every leg's time, score and how it was made (cargo, parking, clean leg, speed bonus, breakage), with what fell off or broke where.

**Fair play.** The server rebuilds every leg's score from its parts and turns away anything the game couldn't have produced: a score that doesn't add up, breakage that doesn't match what broke, a clean leg with losses, a speed bonus longer than the leg, a leg under 30 seconds, or a thing the game doesn't have. It works the stars out itself. The board runs on a Cloudflare Worker with a D1 database, in [`leaderboard/`](leaderboard).

<p align="center">
  <img src="docs/readme/leaderboard.jpg" alt="The leaderboard panel over the score card: the name field, the FASTEST, TOP SCORE and BY LEG tabs, and the fastest runs" width="49%">
  <img src="docs/readme/run-card.jpg" alt="A run card: every leg's time and score, with its breakdown and what was lost or broken" width="49%">
</p>

<br>

<img src="docs/readme/h-controls.svg" alt="05 · Controls" width="100%">

| | Keyboard + mouse | Gamepad | Touch |
|---|---|---|---|
| **Pick up and load** | `DRAG` | `DRAG` | `DRAG` |
| **Turn what you hold** | `Q` `E` `SCROLL` | `Q` `E` | hold it, tap `TURN` |
| **Tie it down** | `R` | `R` | `ROPE` |
| **Gas** | `D` `RIGHT` | `RT` | `GAS` pedal, right thumb |
| **Brake** | `A` `LEFT` | `LT` | `BRAKE` pedal, left thumb |
| **Handbrake** | `P` `SPACE` | `A` | `P` lever |
| **Gear up / down** | `SHIFT` / `CTRL` | `RB` / `LB` | the gear rocker, ▲ / ▼ |
| **First gear / reverse** | `1` / `R` | `LB` | `GEAR −` |
| **Aim the crossbow** | mouse | right stick | drag |
| **Fire the anchor** | `CLICK` | `X` | lift your finger |
| **Reel in** | `W` | `B` | `REEL` |
| **Let go** | `RIGHT-CLICK` | | |
| **Pause** | `ESC` | `START` | `II`, top corner |

The same table is in the game, under **Controls** on the title screen and in the pause menu.

On a phone or an iPad (held sideways) the controls are laid out like a mobile driving game: the pedals under your thumbs, the gear rocker by the brake, the handbrake lever and reel by the gas.

<p align="center">
  <img src="docs/readme/controls.jpg" alt="The in-game Controls sheet, with keyboard, gamepad and touch tabs" width="100%">
</p>

<br>

<img src="docs/readme/h-road.svg" alt="06 · The road" width="100%">

| Leg | Where | When | Stop |
|---|---|---|---|
| **1** | Old Street | the afternoon you leave | Corner Fuel |
| **2** | Maple Valley | a misty autumn morning | Maple Mill Fuel & Pie |
| **3** | Frostpeak Pass | the violet hour under a red aurora | Summit Lodge |
| **4** | Neon Town | a rainy night in the city of tomorrow | Starlite Diner |
| **5** | Coast Road | a bright morning, golden hour home | **home** |

Each leg has its own bumps, hills and cliffs, and each place builds its toll gate its own way: a barn-red turnpike on Old Street, twin stone towers grown over with ivy in the valley, a log gantry and chalet on the pass, a streamline deco bridge by the sea. A tunnel carries you from one place to the next, and the last stretch home runs down a golden-hour avenue under the arches, with fireworks over the sea.

<p align="center">
  <img src="docs/readme/maple-gate.jpg" alt="The Maple Gate: two stone towers under slate cones, an ivy-grown arch and a Tudor lodge" width="49%">
  <img src="docs/readme/frostpeak.jpg" alt="Frostpeak Pass: snow spruces and a violet sky over the high road" width="49%">
</p>
<p align="center">
  <img src="docs/readme/neon-town.jpg" alt="Neon Town: a synth sun, hover-cars and a blimp over the skyline" width="49%">
  <img src="docs/readme/coast-road.jpg" alt="Coast Road: the marine drive, palms and a balustrade over the bay" width="49%">
</p>
<p align="center">
  <img src="docs/readme/scorecard.jpg" alt="The score card: HOME SWEET HOME, a delivery note with what made it, each leg's score, the run time and a DELIVERED stamp" width="100%">
</p>

<br>

<img src="docs/readme/h-run.svg" alt="07 · Run it" width="100%">

```bash
npm install
npm run dev
```

Then open http://localhost:5210. Add `?debug` to the address to see the physics shapes.

| Script | What it does |
|---|---|
| `npm run dev` | The dev server, with hot reload |
| `npm run typecheck` | TypeScript, strict, with unused code reported as errors |
| `npm run build` | Typecheck, then a static copy in `dist/` |
| `npm run preview` | Serves `dist/` at http://localhost:5211 |

The build uses relative paths, so it runs from any folder: GitHub Pages, itch.io or a plain zip. Every push to `master` builds and publishes it to GitHub Pages ([`.github/workflows/pages.yml`](.github/workflows/pages.yml)).

<br>

<img src="docs/readme/h-built.svg" alt="08 · How it is made" width="100%">

Every picture in the game is drawn in code, not painted or imported. Each one is written as SVG by a wobbly ink pen, shaded with halftone dots, and turned into a texture while the game runs. Each leg's pictures are drawn in small slices in idle time, only while the truck is standing still, and the next leg's start as soon as you reach a checkpoint, so the road never stalls to load.

The source is grouped by what it does:

| Folder | What's in it |
|---|---|
| [`src/scenes/`](src/scenes) | The title screen and the game itself: packing, driving, gates, parking and the score |
| [`src/world/`](src/world) | The road and its five legs: terrain, biomes, tunnels, the finale, and the loader that draws each leg's art in the background |
| [`src/art/`](src/art) | Every picture, drawn as SVG with the wobbly ink pen in [`ink.ts`](src/art/ink.ts): the truck, the houses, trees, toll gates, skylines and the sea |
| [`src/ui/`](src/ui) | The printed poster screens (pause, Controls, Lost & Found), key-cap prompts, the dashboard and the score card |
| [`src/systems/`](src/systems) | The engine and gearbox, the anchor crossbow, sound, weather and the colour grade |
| [`src/dev/`](src/dev) | `?debug` and QA helpers |
| [`leaderboard/`](leaderboard) | The online leaderboard: a Cloudflare Worker, its D1 database and the admin console ([notes](leaderboard/README.md)) |
| [`itch/`](itch) | The itch.io page: cover, banner, screenshots, description and custom CSS ([setup notes](itch/README.md)) |
| [`docs/`](docs) | Design notes: [the journey](docs/JOURNEY.md) and [the gameplay](docs/GAMEPLAY.md) |

**Type:** [Anton](https://fonts.google.com/specimen/Anton) for anything you read as a word, [Space Mono](https://fonts.google.com/specimen/Space+Mono) for small labels and numbers.

**Inks:** ink, oxblood, red, ember and bone from the title screen's proof bar, with gold for highlights.

<p align="center">
  <img src="docs/readme/palette.svg" alt="The palette: ink #0A0712, oxblood #3A0F22, red #E3263A, ember #FF6A30, bone #F3E3CC" width="100%">
</p>

Built with [Phaser 4](https://phaser.io) and its Matter physics, TypeScript and Vite.

<br>

<p align="center">
  <img src="docs/readme/logo.png" alt="Shifting Day" width="280">
</p>

<p align="center"><sub>Made by <b>sarthax10</b>, with help from Claude (Anthropic).</sub></p>
