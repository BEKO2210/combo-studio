// Texte zum Weitergeben: an Chatbots/Agenten (Markdown), als JSON, CSS, Tailwind, Design-Tokens.

import { apcaLc, hexToOklch, hexToRgb, wcagRatio } from './color.ts';
import type { Style } from './generator.ts';

export type Pair = { a: string; b: string; aName: string; bName: string; id?: number; style?: Style };

const STYLE_TEXT: Record<Style, string> = {
  neon: 'vivid accent + near-black/near-white tinted with the same hue',
  tonal: 'same hue, strong light/dark split (tone-on-tone)',
  neutral: 'saturated color + tinted neutral',
  complement: 'complementary hues separated by lightness',
  split: 'split-complementary hues separated by lightness',
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'color';
const rgbStr = (hex: string) => hexToRgb(hex)!.map((x) => Math.round(x * 255)).join(' ');
const oklchStr = (hex: string) => {
  const o = hexToOklch(hex);
  return `oklch(${(o.l * 100).toFixed(1)}% ${o.c.toFixed(3)} ${o.h.toFixed(1)})`;
};

export function wcagLevel(r: number): string {
  return r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA Large' : 'Fail';
}

export function permalink(base: string, p: Pair): string {
  return p.id ? `${base}#${p.id}` : `${base}#${p.a.slice(1)}-${p.b.slice(1)}`;
}

export function shardUrl(base: string, id: number): string {
  return `${base}api/v1/combos/${String(Math.floor((id - 1) / 1000)).padStart(4, '0')}.json`;
}

export function toMarkdown(base: string, p: Pair): string {
  const ratio = wcagRatio(p.a, p.b);
  const title = p.id ? `Color combo #${p.id}` : 'Color combo';
  const lines = [
    `# ${title}: ${p.aName} × ${p.bName}`,
    '',
    `Link: ${permalink(base, p)}` + (p.id ? `  \nJSON: ${shardUrl(base, p.id)} (entry id ${p.id})` : ''),
    p.style ? `Style: ${p.style} (${STYLE_TEXT[p.style]})` : '',
    '',
    '| Role | Name | HEX | RGB | OKLCH |',
    '|---|---|---|---|---|',
    `| Color A | ${p.aName} | ${p.a} | rgb(${rgbStr(p.a)}) | ${oklchStr(p.a)} |`,
    `| Color B | ${p.bName} | ${p.b} | rgb(${rgbStr(p.b)}) | ${oklchStr(p.b)} |`,
    '',
    `Contrast: WCAG 2.2 ${ratio.toFixed(2)}:1 (${wcagLevel(ratio)}), APCA Lc ${apcaLc(p.b, p.a).toFixed(0)} (B text on A) / ${apcaLc(p.a, p.b).toFixed(0)} (A text on B).`,
    '',
    'How to use this pair:',
    '- Two-color system: A as background with B for text/lines, and B as background with A for text/lines. Both directions are readable.',
    `- Safe for headlines and large text in both directions${ratio >= 4.5 ? ', also for body text' : '; for small body text add a neutral (near-black or near-white)'}.`,
    '- Do not add extra hues unless asked; tints/shades of A and B are fine.',
    '',
    '```css',
    ':root {',
    `  --color-a: ${p.a}; /* ${p.aName} */`,
    `  --color-b: ${p.b}; /* ${p.bName} */`,
    '}',
    '```',
  ];
  return lines.filter((l, i) => !(l === '' && lines[i - 1] === '')).join('\n');
}

export function toJson(base: string, p: Pair): string {
  const ratio = wcagRatio(p.a, p.b);
  return JSON.stringify({
    id: p.id ?? null,
    url: permalink(base, p),
    style: p.style ?? null,
    colors: [
      { role: 'a', name: p.aName, hex: p.a, oklch: oklchStr(p.a) },
      { role: 'b', name: p.bName, hex: p.b, oklch: oklchStr(p.b) },
    ],
    contrast: { wcag: +ratio.toFixed(2), wcagLevel: wcagLevel(ratio), apcaBonA: +apcaLc(p.b, p.a).toFixed(1), apcaAonB: +apcaLc(p.a, p.b).toFixed(1) },
  }, null, 2);
}

export function toCss(p: Pair): string {
  return `:root {\n  --color-${slug(p.aName)}: ${p.a};\n  --color-${slug(p.bName)}: ${p.b};\n}`;
}

export function toTailwind(p: Pair): string {
  return `@theme {\n  --color-${slug(p.aName)}: ${p.a};\n  --color-${slug(p.bName)}: ${p.b};\n}`;
}

/** W3C Design Tokens (DTCG 2025.10): Farbe als Objekt mit colorSpace/components/hex. */
export function toTokens(p: Pair): string {
  const tok = (hex: string) => ({ $type: 'color', $value: { colorSpace: 'srgb', components: hexToRgb(hex)!.map((x) => +x.toFixed(4)), hex: hex.toLowerCase() } });
  return JSON.stringify({ combo: { [slug(p.aName)]: tok(p.a), [slug(p.bName)]: tok(p.b) } }, null, 2);
}
