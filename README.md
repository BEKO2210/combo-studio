# Combo Studio

1,000,000 pre-checked two-color combinations for designers and AI agents.

- Generator in OKLCH. Every pair passes WCAG 2.2 ≥ 3:1 and |APCA Lc| ≥ 60 in both directions, so either color works as background with the other as text.
- Card export in the "LEARN DESIGN / COMBO" style: PNG, ZIP carousel, MP4/WebM slideshow (4:5, 3:4, 9:16, 1:1).
- "Copy for AI": ready-made Markdown with HEX/RGB/OKLCH, contrast and CSS. Also JSON, CSS, Tailwind v4, W3C design tokens.
- Open static API for agents, see [`public/llms.txt`](public/llms.txt).
- Lock a color to get a matching partner, filter by style and color family, color-vision previews (Machado 2009).
- PWA, works offline, no cookies, no tracking.

## Development

```bash
npm ci
npm run data   # color names + 1,000,000-combo catalog -> public/api/v1 (~2-3 min)
npm run dev
npm test
npm run build  # data + typecheck + vite build -> dist/
```

The catalog is deterministic: `comboById(id)` in `src/generator.ts` always yields the same pair, so the catalog is rebuilt on every deploy instead of being committed.

## Credits

Color names: [meodai/color-names](https://github.com/meodai/color-names) (MIT). Icons: [Lucide](https://lucide.dev) (ISC). Fonts: Archivo, Big Shoulders Display (OFL). APCA math implemented from the published 0.0.98G-4g constants.
