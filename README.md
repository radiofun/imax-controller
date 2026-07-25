# IMAX Controller

A dumb (non-connected) replica of an IMAX GT-style show-control touch panel, rendered as a Next.js web app with a CRT monitor look.

## Features

- Amber-on-black show control UI (transport, flags, lamp/frame readouts)
- Editable show title
- Keyboard navigation (arrows, Tab, Enter, hotkeys)
- WebGL CRT glass (scanlines, vignette, grille, flicker, noise)
- SVG barrel curvature + low-res upscale for soft phosphor edges
- Adjustable CRT sliders (bloom, curvature, resolution, etc.)
- Basic Web Audio panel beeps

This does **not** talk to a real projector. It’s a visual / interaction toy.

## Quick start

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Scripts

| Command        | Description              |
| -------------- | ------------------------ |
| `npm run dev`  | Start Next.js dev server |
| `npm run build`| Production build         |
| `npm run start`| Serve production build   |

## Keyboard

| Key | Action |
| --- | ------ |
| `↑` `↓` `←` `→` / `Tab` | Move focus |
| `Enter` / `Space` | Activate |
| `R` `J` `S` | Run / Jog / Stop |
| `T` | Edit show title |
| `F` `A` `C` | Functions / Alarms / Change Show |
| `M` `L` | Auto↔Manual / Remote↔Local |
| `O` `E` | Auto Load / Exit Show |
| `1`–`5` | Toggle flags |
| `0` | Reset frame count |
| `Esc` | Close overlay / Stop |
| `H` | Toggle key help |

Click or press a key once to unlock audio (browser policy).

## Stack

- Next.js 15 + React 19 + TypeScript
- VT323 for terminal typography
- WebGL2 CRT overlay + SVG `feDisplacementMap` barrel warp

## License

[MIT](./LICENSE) © Minsang Choi
