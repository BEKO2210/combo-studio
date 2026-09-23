// Nächster Farbname (OKLab-Abstand) aus meodai/color-name-list (MIT), per Raster beschleunigt.

import { hexToRgb, linearize, linToOklab } from './color.ts';

export type NameIndex = { names: string[]; lab: Float32Array; grid: Map<number, number[]> };

const CELL = 0.05;
const key = (L: number, a: number, b: number) =>
  (Math.floor(L / CELL) + 64) * 16384 + (Math.floor(a / CELL) + 64) * 128 + (Math.floor(b / CELL) + 64);

/** Kompaktformat: "Name|RRGGBB\n..." */
export function buildIndex(compact: string): NameIndex {
  const names: string[] = [];
  const rows = compact.trim().split('\n');
  const lab = new Float32Array(rows.length * 3);
  const grid = new Map<number, number[]>();
  rows.forEach((row, i) => {
    const [n, hex] = row.split('|');
    names.push(n);
    const [L, a, b] = linToOklab(linearize(hexToRgb(hex)!));
    lab[i * 3] = L; lab[i * 3 + 1] = a; lab[i * 3 + 2] = b;
    const k = key(L, a, b);
    (grid.get(k) ?? grid.set(k, []).get(k)!).push(i);
  });
  return { names, lab, grid };
}

export function nearestName(idx: NameIndex, hex: string): string {
  const [L, a, b] = linToOklab(linearize(hexToRgb(hex)!));
  const cl = Math.floor(L / CELL), ca = Math.floor(a / CELL), cb = Math.floor(b / CELL);
  let best = -1, bd = Infinity;
  for (let r = 1; r <= 8 && best < 0; r++) {
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) {
      const list = idx.grid.get((cl + i + 64) * 16384 + (ca + j + 64) * 128 + (cb + k + 64));
      if (!list) continue;
      for (const n of list) {
        const d = (idx.lab[n * 3] - L) ** 2 + (idx.lab[n * 3 + 1] - a) ** 2 + (idx.lab[n * 3 + 2] - b) ** 2;
        if (d < bd) { bd = d; best = n; }
      }
    }
  }
  return best < 0 ? hex : idx.names[best];
}
