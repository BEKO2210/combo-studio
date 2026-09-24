// PNG, ZIP (Karussell) und Video (Slideshow) – alles im Browser.

import { zipSync } from 'fflate';
import { FORMATS, drawCard, type CardData, type Format } from './card.ts';

export function cardBlob(fmt: Format, d: CardData): Promise<Blob> {
  const c = document.createElement('canvas');
  const [W, H] = FORMATS[fmt];
  c.width = W; c.height = H;
  drawCard(c.getContext('2d')!, W, H, d);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/png'));
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export const fileName = (d: CardData, ext: string) =>
  `combo-${d.id ?? String(d.number).padStart(2, '0')}-${d.a.slice(1)}-${d.b.slice(1)}.${ext}`.toLowerCase();

export async function zipCards(fmt: Format, cards: CardData[]): Promise<Blob> {
  const files: Record<string, Uint8Array> = {};
  for (const d of cards) files[fileName(d, 'png')] = new Uint8Array(await (await cardBlob(fmt, d)).arrayBuffer());
  return new Blob([zipSync(files, { level: 0 }) as BlobPart], { type: 'application/zip' });
}

export function videoMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of ['video/mp4;codecs=avc1.42E01F', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'])
    if (MediaRecorder.isTypeSupported(m)) return m;
  return null;
}

/** Slideshow: jede Karte 2,2 s, dazwischen 0,45 s Schiebe-Übergang. */
export async function recordVideo(fmt: Format, cards: CardData[], onProgress?: (p: number) => void): Promise<Blob> {
  const mime = videoMime();
  if (!mime) throw new Error('MediaRecorder not supported');
  const [W, H] = FORMATS[fmt];
  // Vorab alle Karten rendern
  const frames = cards.map((d) => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    drawCard(c.getContext('2d')!, W, H, d);
    return c;
  });
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(frames[0], 0, 0);
  const stream = out.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<Blob>((res) => (rec.onstop = () => res(new Blob(chunks, { type: mime.split(';')[0] }))));

  const HOLD = 2200, MOVE = 450, per = HOLD + MOVE;
  const total = frames.length * per - MOVE + 400;
  const ease = (t: number) => 1 - (1 - t) ** 3;
  rec.start(250);
  const t0 = performance.now();
  await new Promise<void>((res) => {
    const tick = () => {
      const t = performance.now() - t0;
      if (t >= total) return res();
      const i = Math.min(frames.length - 1, Math.floor(t / per));
      const local = t - i * per;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      if (local > HOLD && i < frames.length - 1) {
        const k = ease((local - HOLD) / MOVE);
        ctx.drawImage(frames[i], -k * W, 0);
        ctx.drawImage(frames[i + 1], W - k * W, 0);
      } else ctx.drawImage(frames[i], 0, 0);
      onProgress?.(t / total);
      requestAnimationFrame(tick);
    };
    tick();
  });
  rec.stop();
  return done;
}
