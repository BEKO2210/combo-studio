// Zeichnet die Combo-Karte (Design nach „LEARN DESIGN / COMBO“-Vorlage) auf ein Canvas.
// Eine Zeichenfunktion für Vorschau, PNG, ZIP und Video – alles sieht identisch aus.

import { hexToOklch, mixOklab } from './color.ts';

export type Format = '4:5' | '3:4' | '9:16' | '1:1';
export const FORMATS: Record<Format, [number, number]> = {
  '4:5': [1080, 1350],
  '3:4': [1080, 1440],
  '9:16': [1080, 1920],
  '1:1': [1080, 1080],
};

export type CardData = {
  a: string; b: string; aName: string; bName: string;
  number: number; header: string;
  /** Katalognummer; ohne = eigene Combo (nur „COMBO“ im Kreis). */
  id?: number;
};

/** Signatur unten links – fest auf jeder Karte. */
export const BRAND = '#BEKO2210';

const DISPLAY = '"Archivo Variable", "Archivo", system-ui, sans-serif';
const TALL = '"Big Shoulders Display Variable", "Archivo Variable", sans-serif';

export async function fontsReady(): Promise<void> {
  await Promise.all([
    document.fonts.load(`900 96px ${DISPLAY}`),
    document.fonts.load(`500 30px ${DISPLAY}`),
    document.fonts.load(`700 80px ${TALL}`),
    document.fonts.load(`800 30px ${TALL}`),
  ]);
}

let grain: HTMLCanvasElement | null = null;
function grainTile(): HTMLCanvasElement {
  if (grain) return grain;
  grain = document.createElement('canvas');
  grain.width = grain.height = 256;
  const g = grain.getContext('2d')!;
  const img = g.createImageData(256, 256);
  let seed = 7;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const v = seed & 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return grain;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Schrift so setzen, dass Text in maxW passt (verkleinert bei Bedarf). */
function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxW: number, family: string, stretch = 'normal') {
  let s = size;
  for (;;) {
    ctx.font = `${weight} ${stretch} ${s}px ${family}`;
    if (ctx.measureText(text).width <= maxW || s <= 20) return s;
    s -= 2;
  }
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, u: number, color: string) {
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.lineWidth = 2.5 * u;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function chevronCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, u: number, color: string, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3 * u;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3.6 * u;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 5 * u, cy - 8 * u);
  ctx.lineTo(cx + 6 * u, cy);
  ctx.lineTo(cx - 5 * u, cy + 8 * u);
  ctx.stroke();
  ctx.restore();
}

/** Inhalt einer Kartenhälfte: Farbname + „Hex →“ + Hexcode. */
function cardContent(ctx: CanvasRenderingContext2D, W: number, u: number, centerY: number, name: string, hex: string, ink: string) {
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const size = fitFont(ctx, name.toUpperCase(), 900, 104 * u, W - 150 * u, DISPLAY, 'semi-condensed');
  ctx.letterSpacing = `${-1.5 * u}px`;
  ctx.fillText(name.toUpperCase(), W / 2, centerY + size * 0.36);
  ctx.letterSpacing = '0px';

  const pw = 224 * u, ph = 62 * u, gap = 22 * u;
  const py = centerY + size * 0.36 + 24 * u;
  const x1 = W / 2 - gap / 2 - pw, x2 = W / 2 + gap / 2;
  pill(ctx, x1, py, pw, ph, u, ink);
  pill(ctx, x2, py, pw, ph, u, ink);

  ctx.font = `500 normal ${34 * u}px ${DISPLAY}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const hexW = ctx.measureText('Hex').width;
  const arrowW = 64 * u;
  const startX = x1 + (pw - hexW - 16 * u - arrowW) / 2;
  ctx.fillText('Hex', startX, py + ph / 2 + u);
  // Pfeil
  const ax = startX + hexW + 16 * u, ay = py + ph / 2 + u;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.2 * u;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + arrowW, ay); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ax + arrowW, ay); ctx.lineTo(ax + arrowW - 11 * u, ay - 5 * u); ctx.lineTo(ax + arrowW - 11 * u, ay + 5 * u); ctx.closePath(); ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillText(hex.toUpperCase(), x2 + pw / 2, py + ph / 2 + u);
}

export function drawCard(ctx: CanvasRenderingContext2D, W: number, H: number, d: CardData) {
  const u = W / 1080;
  const m = 18 * u, g = 14 * u, R = 36 * u, pad = 54 * u;
  const cardH = (H - 2 * m - g) / 2;
  const topY = m, botY = m + cardH + g;

  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // Kartenflächen
  ctx.fillStyle = d.a; roundRect(ctx, m, topY, W - 2 * m, cardH, R); ctx.fill();
  ctx.fillStyle = d.b; roundRect(ctx, m, botY, W - 2 * m, cardH, R); ctx.fill();

  // Körnung (nur auf den Karten)
  ctx.save();
  ctx.beginPath(); ctx.roundRect(m, topY, W - 2 * m, cardH, R); ctx.roundRect(m, botY, W - 2 * m, cardH, R); ctx.clip();
  ctx.globalAlpha = 0.07;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat')!;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Kopfzeile
  ctx.fillStyle = d.b;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `500 normal ${27 * u}px ${DISPLAY}`;
  ctx.fillText(d.header.toUpperCase(), pad, topY + 66 * u);

  const num = String(d.number).padStart(2, '0');
  ctx.textAlign = 'right';
  ctx.font = `700 ${84 * u}px ${TALL}`;
  const numW = ctx.measureText(num).width;
  ctx.fillText(num, W - pad, topY + 104 * u);
  ctx.font = `800 ${32 * u}px ${TALL}`;
  ctx.fillText('PA', W - pad - numW - 6 * u, topY + 68 * u);
  ctx.fillText('GE', W - pad - numW - 6 * u, topY + 100 * u);

  // Inhalte
  cardContent(ctx, W, u, topY + cardH * 0.47, d.aName, d.a, d.b);
  cardContent(ctx, W, u, botY + cardH * 0.42, d.bName, d.b, d.a);

  // Fußzeile
  ctx.fillStyle = d.a;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `400 normal ${30 * u}px ${DISPLAY}`;
  ctx.fillText(BRAND, pad, botY + cardH - 52 * u);
  const r = 23 * u;
  [0.3, 0.6, 1].forEach((al, i) => chevronCircle(ctx, W - pad - r - (2 - i) * 56 * u, botY + cardH - 62 * u, r, u, d.a, al));

  // Mittelkreis mit „COMBO NN“ im Verlauf
  const cy = botY - g / 2;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(W / 2, cy, 146 * u, 0, Math.PI * 2); ctx.fill();
  const vivid = hexToOklch(d.a).c >= hexToOklch(d.b).c ? d.a : d.b;
  const other = vivid === d.a ? d.b : d.a;
  // Schmal gestaucht wie in der Vorlage: hoch, eng, mit Luft zum Kreisrand.
  // Katalog-Combos: „COMBO“ klein, darunter die eigene Nummer groß.
  const sx = 0.74, maxW = (210 * u) / sx;
  ctx.translate(W / 2, cy + 4 * u);
  ctx.scale(sx, 1);
  const top = d.id ? -62 * u : -48 * u, bottom = d.id ? 66 * u : 48 * u;
  const grad = ctx.createLinearGradient(0, top, 0, bottom);
  grad.addColorStop(0, vivid);
  grad.addColorStop(1, mixOklab(vivid, other, 0.55));
  ctx.fillStyle = grad;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (d.id) {
    ctx.font = `700 ${54 * u}px ${TALL}`;
    ctx.fillText('COMBO', 0, -36 * u, maxW);
    ctx.font = `800 ${92 * u}px ${TALL}`;
    ctx.fillText(String(d.id), 0, 30 * u, maxW);
  } else {
    ctx.font = `700 ${96 * u}px ${TALL}`;
    ctx.fillText('COMBO', 0, 0, maxW);
  }
  ctx.restore();
}

export function renderToCanvas(canvas: HTMLCanvasElement, fmt: Format, d: CardData, scale = 1) {
  const [W, H] = FORMATS[fmt];
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  drawCard(canvas.getContext('2d')!, canvas.width, canvas.height, d);
}
