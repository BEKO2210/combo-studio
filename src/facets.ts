// Facetten für Katalog-Suche: Farbfamilie der kräftigeren Farbe.
import { hexToOklch } from './color.ts';

export const FAMILIES = ['red', 'orange', 'yellow', 'lime', 'green', 'teal', 'cyan', 'blue', 'indigo', 'violet', 'magenta', 'pink', 'neutral'] as const;
export type Family = (typeof FAMILIES)[number];

// Farbton-Grenzen in OKLCH (Grad), grob an Wahrnehmung angelehnt
const EDGES: [number, Family][] = [
  [15, 'pink'], [40, 'red'], [70, 'orange'], [105, 'yellow'], [130, 'lime'], [160, 'green'],
  [185, 'teal'], [215, 'cyan'], [255, 'blue'], [285, 'indigo'], [315, 'violet'], [350, 'magenta'], [360, 'pink'],
];

export function familyOf(a: string, b: string): Family {
  const A = hexToOklch(a), B = hexToOklch(b);
  const V = A.c >= B.c ? A : B;
  if (V.c < 0.04) return 'neutral';
  for (const [edge, f] of EDGES) if (V.h < edge) return f;
  return 'pink';
}
