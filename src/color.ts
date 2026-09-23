// Farbmathematik: sRGB <-> OKLab/OKLCH, Gamut-Mapping, Kontrast (WCAG 2.x + APCA), CVD-Simulation.

export type RGB = [number, number, number]; // 0..1, gamma-kodiert
export type OKLCH = { l: number; c: number; h: number };

export const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));

export function hexToRgb(hex: string): RGB | null {
  let h = hex.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  const to = (x: number) => Math.round(clamp(x) * 255).toString(16).padStart(2, '0');
  return ('#' + to(r) + to(g) + to(b)).toUpperCase();
}

const toLin = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
const toGam = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);

export const linearize = (c: RGB): RGB => [toLin(c[0]), toLin(c[1]), toLin(c[2])];
export const delinearize = (c: RGB): RGB => [toGam(c[0]), toGam(c[1]), toGam(c[2])];

export function linToOklab([r, g, b]: RGB): RGB {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToLin([L, a, b]: RGB): RGB {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function hexToOklch(hex: string): OKLCH {
  const [L, a, b] = linToOklab(linearize(hexToRgb(hex) ?? [0, 0, 0]));
  const c = Math.hypot(a, b);
  const h = c < 1e-4 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}

function oklchToLin({ l, c, h }: OKLCH): RGB {
  const r = (h * Math.PI) / 180;
  return oklabToLin([l, c * Math.cos(r), c * Math.sin(r)]);
}

const EPS = 1e-6;
const inGamut = (c: RGB) => c.every((x) => x >= -EPS && x <= 1 + EPS);

/** Größte Chroma, die bei l/h noch in sRGB liegt (Binärsuche). */
export function maxChroma(l: number, h: number): number {
  let lo = 0, hi = 0.4;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToLin({ l, c: mid, h }))) lo = mid; else hi = mid;
  }
  return lo;
}

// Nachschlagetabelle für maxChroma: L in 0.0025er-, h in 1°-Schritten, bilinear interpoliert.
const LN = 400, HN = 360;
let lut: Float32Array | null = null;
export function maxChromaFast(l: number, h: number): number {
  if (!lut) {
    lut = new Float32Array((LN + 1) * (HN + 1));
    for (let i = 0; i <= LN; i++) for (let j = 0; j <= HN; j++) lut[i * (HN + 1) + j] = maxChroma(i / LN, j);
  }
  const x = clamp(l) * LN, y = (((h % 360) + 360) % 360);
  const i = Math.min(LN - 1, Math.floor(x)), j = Math.min(HN - 1, Math.floor(y));
  const fx = x - i, fy = y - j, k = i * (HN + 1) + j;
  const top = lut[k] * (1 - fy) + lut[k + 1] * fy;
  const bot = lut[k + HN + 1] * (1 - fy) + lut[k + HN + 2] * fy;
  return Math.max(0, top * (1 - fx) + bot * fx - 0.0005);
}

/** OKLCH -> Hex; außerhalb von sRGB wird nur die Chroma reduziert (Helligkeit + Farbton bleiben). */
export function oklchToHex(col: OKLCH): string {
  const l = clamp(col.l);
  const direct = oklchToLin({ l, c: Math.max(0, col.c), h: col.h });
  if (inGamut(direct)) return rgbToHex(delinearize(direct.map((x) => clamp(x)) as RGB));
  const c = Math.min(Math.max(0, col.c), maxChromaFast(l, col.h));
  return rgbToHex(delinearize(oklchToLin({ l, c, h: col.h }).map((x) => clamp(x)) as RGB));
}

export function oklabDist(a: string, b: string): number {
  const p = linToOklab(linearize(hexToRgb(a)!));
  const q = linToOklab(linearize(hexToRgb(b)!));
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

// ---- WCAG 2.x ----
export function relLuminance(hex: string): number {
  const [r, g, b] = linearize(hexToRgb(hex)!);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function wcagRatio(a: string, b: string): number {
  const la = relLuminance(a), lb = relLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ---- APCA 0.0.98G-4g (Formel nach SAPC/APCA-Dokumentation, eigene Implementierung) ----
function apcaY(hex: string): number {
  const [r, g, b] = hexToRgb(hex)!;
  return 0.2126729 * r ** 2.4 + 0.7151522 * g ** 2.4 + 0.072175 * b ** 2.4;
}

/** Lc-Wert: positiv = dunkler Text auf hellem Grund, negativ = hell auf dunkel. */
export function apcaLc(text: string, bg: string): number {
  const clampBlack = (y: number) => (y > 0.022 ? y : y + (0.022 - y) ** 1.414);
  const yt = clampBlack(apcaY(text)), yb = clampBlack(apcaY(bg));
  if (Math.abs(yb - yt) < 0.0005) return 0;
  let sapc: number;
  if (yb > yt) {
    sapc = (yb ** 0.56 - yt ** 0.57) * 1.14;
    return sapc < 0.1 ? 0 : (sapc - 0.027) * 100;
  }
  sapc = (yb ** 0.65 - yt ** 0.62) * 1.14;
  return sapc > -0.1 ? 0 : (sapc + 0.027) * 100;
}

// ---- Farbfehlsichtigkeit: Machado, Oliveira & Fernandes 2009, Schweregrad 1.0 (lineares RGB) ----
const CVD: Record<'protan' | 'deutan' | 'tritan', number[]> = {
  protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};
export type CvdKind = keyof typeof CVD;

export function simulateCvd(hex: string, kind: CvdKind): string {
  const [r, g, b] = linearize(hexToRgb(hex)!);
  const m = CVD[kind];
  const out: RGB = [m[0] * r + m[1] * g + m[2] * b, m[3] * r + m[4] * g + m[5] * b, m[6] * r + m[7] * g + m[8] * b];
  return rgbToHex(delinearize(out.map((x) => clamp(x)) as RGB));
}

/** Farbe in Richtung einer anderen mischen (in OKLab). */
export function mixOklab(a: string, b: string, t: number): string {
  const p = linToOklab(linearize(hexToRgb(a)!));
  const q = linToOklab(linearize(hexToRgb(b)!));
  const m: RGB = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  return rgbToHex(delinearize(oklabToLin(m).map((x) => clamp(x)) as RGB));
}
