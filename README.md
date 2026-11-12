# Shifting Day

A game for [GitHub Game Off 2026](https://itch.io/jam/game-off-2026) (theme: SHIFT).

Moving day. One small truck. Everything shifts.

Stack the family's things on the truck, then drive to the new house without losing them. The load shifts on every bump.

```bash
npm install
npm run dev
```

Then open http://localhost:5210.

## Controls

- Packing: drag things with the mouse. Scroll, or press Q / E, to turn the thing you are holding. Right-click turns it a quarter turn.
- Driving: hold D or the right arrow to drive, A or the left arrow to brake and reverse.

Add `?debug` to the address to see the physics shapes.

## How it is built

- `src/ink.ts` draws wobbly hand-inked shapes as SVG. It comes from Pip's Last Sprint.
- `src/art.ts` holds every picture, drawn in code, and the list of household things.
- `src/terrain.ts` is the road: its bumps, holes and hills.
- `src/game.ts` is the game: packing, driving and the score.

Phaser 4 with its built-in Matter physics, TypeScript and Vite.

## AI disclosure

This game is being built with help from Claude (Anthropic).
