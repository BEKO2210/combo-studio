// Combo-Generator: deterministisch pro ID (Katalog) oder zufällig/mit gesperrter Farbe.
// Qualitätstor: WCAG >= 3:1 (große Schrift AA) UND |APCA Lc| >= 60 in beide Richtungen.

import { apcaLc, clamp, hexToOklch, maxChromaFast as maxChroma, oklchToHex, wcagRatio, type OKLCH } from './color.ts';

export const STYLES = ['neon', 'tonal', 'neutral', 'complement', 'split'] as const;
export type Style = (typeof STYLES)[number];
export type Combo = { a: string; b: string; style: Style };

export const CATALOG_SIZE = 1_000_000;

export type Rng = () => number;

/** mulberry32 – kleiner, schneller, reproduzierbarer Zufallsgenerator. */
export function rngFromSeed(seed: number): Rng {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const U = (r: Rng, lo: number, hi: number) => lo + (hi - lo) * r();
const pick = <T,>(r: Rng, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
const hue = (h: number) => ((h % 360) + 360) % 360;

/** Startfarbe: kräftig-hell, kräftig-mittel, tief oder pastell. */
function seedColor(r: Rng): OKLCH {
  const h = U(r, 0, 360);
  const kind = r();
  let l: number, rel: number;
  if (kind < 0.35) { l = U(r, 0.78, 0.93); rel = U(r, 0.8, 1); }        // Neon / hell-kräftig
  else if (kind < 0.6) { l = U(r, 0.55, 0.7); rel = U(r, 0.85, 1); }    // kräftig mittel
  else if (kind < 0.85) { l = U(r, 0.22, 0.4); rel = U(r, 0.45, 0.9); } // tief
  else { l = U(r, 0.86, 0.95); rel = U(r, 0.3, 0.55); }                 // pastell
  return { l, c: maxChroma(l, h) * rel, h };
}

/** Partnerfarbe nach Stilregel; Helligkeit immer auf der Gegenseite. */
function partner(x: OKLCH, style: Style, r: Rng): OKLCH {
  const light = x.l >= 0.6;
  switch (style) {
    case 'neon': {
      // Kräftige Farbe + fast schwarz / fast weiß mit Farbstich derselben Farbe
      const l = light ? U(r, 0.13, 0.22) : U(r, 0.88, 0.97);
      const h = hue(x.h + U(r, -6, 6));
      return { l, c: light ? U(r, 0.003, 0.02) : maxChroma(l, h) * U(r, 0.85, 1), h };
    }
    case 'neutral': {
      const l = light ? U(r, 0.15, 0.24) : U(r, 0.95, 0.99);
      return { l, c: U(r, 0.004, 0.022), h: hue(x.h + U(r, -10, 10)) };
    }
    case 'tonal': {
      const l = light ? U(r, 0.2, 0.34) : U(r, 0.82, 0.94);
      const h = hue(x.h + U(r, -12, 12));
      return { l, c: maxChroma(l, h) * U(r, 0.5, 0.95), h };
    }
    case 'complement':
    case 'split': {
      const h = hue(x.h + (style === 'complement' ? 180 + U(r, -15, 15) : pick(r, [-1, 1]) * U(r, 120, 150)));
      const l = light ? U(r, 0.17, 0.32) : U(r, 0.8, 0.93);
      const rel = light ? U(r, 0.25, 0.7) : U(r, 0.75, 1);
      return { l, c: maxChroma(l, h) * rel, h };
    }
  }
}

export function passes(a: string, b: string): boolean {
  return wcagRatio(a, b) >= 3 && Math.abs(apcaLc(a, b)) >= 60 && Math.abs(apcaLc(b, a)) >= 60;
}

/** Ästhetik-Bewertung (höher = besser). Nur für Paare, die das Qualitätstor bestehen. */
export function score(a: string, b: string): number {
  const A = hexToOklch(a), B = hexToOklch(b);
  const lc = Math.min(Math.abs(apcaLc(a, b)), Math.abs(apcaLc(b, a)));
  let s = clamp((lc - 60) / 20) * 0.5;
  // Leuchtkraft der kräftigeren Farbe relativ zum Möglichen
  const V = A.c >= B.c ? A : B;
  const mc = maxChroma(V.l, V.h);
  s += mc > 0 ? (V.c / mc) * 0.9 + Math.min(V.c, 0.25) * 3 : 0;
  // „Schlamm“: mittlere Helligkeit bei halbherziger Chroma wirkt schmutzig
  for (const X of [A, B]) {
    const rel = X.c / Math.max(0.001, maxChroma(X.l, X.h));
    if (X.l > 0.38 && X.l < 0.68 && rel > 0.12 && rel < 0.45) s -= 0.6;
  }
  // Olivgrün/Senf im Mittelbereich meiden (Farbton 85–125, dunkel-mittel)
  for (const X of [A, B]) if (X.h > 85 && X.h < 125 && X.l > 0.35 && X.l < 0.62 && X.c > 0.05) s -= 0.4;
  return s;
}

function best(cands: Combo[], r: Rng): Combo | null {
  const ok = cands.filter((c) => passes(c.a, c.b)).map((c) => ({ c, s: score(c.a, c.b) }));
  if (!ok.length) return null;
  ok.sort((p, q) => q.s - p.s);
  return ok[Math.floor(r() * Math.min(3, ok.length))].c;
}

/** Neue Combo. style = null: Stil wird zufällig gewählt. */
export function generate(r: Rng, style: Style | null = null, tries = 14): Combo {
  for (let round = 0; round < 20; round++) {
    const cands: Combo[] = [];
    for (let i = 0; i < tries; i++) {
      const st = style ?? pick(r, STYLES);
      const x = seedColor(r);
      const a = oklchToHex(x), b = oklchToHex(partner(x, st, r));
      cands.push(r() < 0.5 ? { a, b, style: st } : { a: b, b: a, style: st });
    }
    const c = best(cands, r);
    if (c) return c;
  }
  return { a: '#21F1A8', b: '#171717', style: 'neon' };
}

/** Passender Partner zu einer festen Farbe (Sperre). */
export function partnerFor(fixed: string, r: Rng, style: Style | null = null): string {
  const x = hexToOklch(fixed);
  // Stil einmal pro Aufruf wählen, sonst gewinnt fast immer der kontraststärkste (Neon/Neutral)
  const st = style ?? pick(r, STYLES);
  for (let round = 0; round < 30; round++) {
    const cands: Combo[] = [];
    for (let i = 0; i < 24; i++) {
      cands.push({ a: fixed, b: oklchToHex(partner(x, st, r)), style: st });
    }
    const c = best(cands, r);
    if (c) return c.b;
  }
  return x.l > 0.6 ? '#141414' : '#FAFAFA';
}

/** Katalog-Combo: ID 1..CATALOG_SIZE -> immer dasselbe Paar. */
export function comboById(id: number): Combo {
  // Seed gestreut, damit benachbarte IDs unabhängig sind
  return generate(rngFromSeed(Math.imul(id, 0x9e3779b1) ^ 0x5bd1e995));
}
