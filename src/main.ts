import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/big-shoulders-display';
import './style.css';
import './page.css';

import { apcaLc, hexToRgb, relLuminance, simulateCvd, wcagRatio, type CvdKind } from './color.ts';
import { CATALOG_SIZE, STYLES, comboById, partnerFor, rngFromSeed, type Style } from './generator.ts';
import { FAMILIES, familyOf, type Family } from './facets.ts';
import { buildIndex, nearestName, type NameIndex } from './names.ts';
import { FORMATS, fontsReady, renderToCanvas, type CardData, type Format } from './card.ts';
import { permalink, shardUrl, toCss, toJson, toMarkdown, toTailwind, toTokens, wcagLevel, type Pair } from './ai.ts';
import { cardBlob, download, fileName, recordVideo, videoMime, zipCards } from './exporters.ts';
import { LANGS, detectLang, type Lang, type Strings } from './i18n.ts';
import { icon, type IconName } from './icons.ts';

// ---------- Zustand ----------
type State = Pair & { lockA: boolean; lockB: boolean };
type Settings = { header: string; number: number; format: Format };
type Row = [number, string, string, string, string, Style, Family];

const $ = <T extends HTMLElement = HTMLElement>(s: string, root: ParentNode = document) => root.querySelector<T>(s)!;
const $$ = <T extends HTMLElement = HTMLElement>(s: string, root: ParentNode = document) => [...root.querySelectorAll<T>(s)];
const esc = (v: string) => v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9A-F]{6}$/i.test(v);
const BASE = new URL('./', location.href).href.replace(/#.*$/, '');

const store = {
  get<T>(k: string, fallback: T): T {
    try { const v = localStorage.getItem(k); return v ? { ...fallback, ...JSON.parse(v) } : fallback; } catch { return fallback; }
  },
  getArr<T>(k: string): T[] {
    try { const v = JSON.parse(localStorage.getItem(k) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
  },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privater Modus */ } },
};

let lang: Lang = detectLang();
let T: Strings = LANGS[lang];
let state: State = { a: '#21F1A8', b: '#171717', aName: 'Tiffany', bName: 'Dark Gray', lockA: false, lockB: false };
const history: State[] = [];
let settings: Settings = store.get('settings', { header: 'LEARN DESIGN', number: 1, format: '4:5' as Format });
let series: Pair[] = store.getArr<Pair>('series').filter((p) => isHex(p?.a) && isHex(p?.b));
let filterStyle: Style | null = null;
let filterFamily: Family | null = null;
let codeTab: 'md' | 'json' | 'css' | 'tw' | 'tokens' = 'md';

// ---------- Katalog (statische Shards, 1000 Combos je Datei) ----------
const shards = new Map<number, Row[]>();
const shardCount = Math.ceil(CATALOG_SIZE / 1000);
const recent: number[] = [];

async function loadShard(s: number): Promise<Row[] | null> {
  if (shards.has(s)) return shards.get(s)!;
  try {
    const res = await fetch(shardUrl(BASE, s * 1000 + 1));
    if (!res.ok) return null;
    const rows = (await res.json()).combos as Row[];
    shards.set(s, rows);
    return rows;
  } catch { return null; }
}

const rowToPair = (r: Row): Pair => ({ id: r[0], a: r[1], aName: r[2], b: r[3], bName: r[4], style: r[5] });
const matches = (r: Row) => (!filterStyle || r[5] === filterStyle) && (!filterFamily || r[6] === filterFamily);

async function randomCatalogPair(): Promise<Pair | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const pool: Row[] = [];
    for (const rows of shards.values()) for (const r of rows) if (matches(r) && !recent.includes(r[0])) pool.push(r);
    // Genug Auswahl vorhanden? Sonst weiteren zufälligen Shard laden.
    if (pool.length > 0 && (pool.length > 20 || attempt > 0)) {
      if (shards.size < 4) void loadShard(Math.floor(Math.random() * shardCount));
      return rowToPair(pool[Math.floor(Math.random() * pool.length)]);
    }
    const rows = await loadShard(Math.floor(Math.random() * shardCount));
    if (!rows) return null;
  }
  return null;
}

async function pairById(id: number): Promise<Pair> {
  const rows = await loadShard(Math.floor((id - 1) / 1000));
  const r = rows?.find((x) => x[0] === id);
  if (r) return rowToPair(r);
  const c = comboById(id); // Offline: lokal berechnen
  return { id, a: c.a, b: c.b, style: c.style, aName: await nameOf(c.a), bName: await nameOf(c.b) };
}

// ---------- Farbnamen (lazy) ----------
let nameIdx: Promise<NameIndex> | null = null;
function nameOf(hex: string): Promise<string> {
  nameIdx ??= fetch(`${BASE}names.txt`).then((r) => r.text()).then(buildIndex);
  return nameIdx.then((idx) => nearestName(idx, hex)).catch(() => hex);
}

// ---------- Aktionen ----------
function push(next: State) {
  history.push(state);
  if (history.length > 60) history.shift();
  state = next;
  if (state.id) { recent.push(state.id); if (recent.length > 200) recent.shift(); }
  render();
}

async function generate() {
  const btn = $('#gen');
  btn.setAttribute('aria-busy', 'true');
  try {
    if (state.lockA || state.lockB) {
      const fixed = state.lockA ? state.a : state.b;
      const rng = rngFromSeed((Math.random() * 2 ** 32) >>> 0);
      const other = partnerFor(fixed, rng, filterStyle);
      const otherName = await nameOf(other);
      push(state.lockA
        ? { ...state, b: other, bName: otherName, id: undefined, style: undefined }
        : { ...state, a: other, aName: otherName, id: undefined, style: undefined });
      return;
    }
    let p = await randomCatalogPair();
    if (!p) {
      // Offline: IDs lokal berechnen, bis eine zum Filter passt
      toast(T.offline);
      let id = 1 + Math.floor(Math.random() * CATALOG_SIZE);
      for (let i = 0; i < 300; i++) {
        const c = comboById(id);
        if ((!filterStyle || c.style === filterStyle) && (!filterFamily || familyOf(c.a, c.b) === filterFamily)) break;
        id = 1 + Math.floor(Math.random() * CATALOG_SIZE);
      }
      const c = comboById(id);
      p = { id, a: c.a, b: c.b, style: c.style, aName: await nameOf(c.a), bName: await nameOf(c.b) };
    }
    push({ ...p, lockA: false, lockB: false });
  } finally { btn.removeAttribute('aria-busy'); }
}

function undo() {
  const prev = history.pop();
  if (prev) { state = prev; render(); }
}

function swap() {
  push({ ...state, a: state.b, b: state.a, aName: state.bName, bName: state.aName, lockA: state.lockB, lockB: state.lockA, id: undefined });
}

async function setHex(slot: 'a' | 'b', raw: string) {
  const v = raw.trim().startsWith('#') ? raw.trim() : '#' + raw.trim();
  const rgb = hexToRgb(v);
  if (!rgb) return;
  const hex = v.length === 4 ? '#' + v.slice(1).split('').map((c) => c + c).join('').toUpperCase() : v.toUpperCase();
  if (hex === state[slot]) return;
  const name = await nameOf(hex);
  push({ ...state, [slot]: hex, [slot + 'Name']: name, id: undefined, style: undefined } as State);
}

// ---------- Darstellung ----------
const cardData = (p: Pair, number = settings.number): CardData => ({
  a: p.a, b: p.b, aName: p.aName, bName: p.bName, number, header: settings.header, id: p.id,
});

function render() {
  const root = document.documentElement;
  root.style.setProperty('--a', state.a);
  root.style.setProperty('--b', state.b);
  const aLighter = relLuminance(state.a) >= relLuminance(state.b);
  root.style.setProperty('--hi', aLighter ? state.a : state.b);
  root.style.setProperty('--lo', aLighter ? state.b : state.a);

  const canvas = $<HTMLCanvasElement>('#card');
  renderToCanvas(canvas, settings.format, cardData(state));
  canvas.setAttribute('aria-label', `${state.aName} ${state.a} / ${state.bName} ${state.b}`);
  canvas.style.aspectRatio = `${FORMATS[settings.format][0]} / ${FORMATS[settings.format][1]}`;

  $('#combo-id').textContent = state.id ? `#${state.id.toLocaleString(lang)}` : T.custom;
  $('#combo-style').textContent = state.style ? ` · ${T.styles[state.style]}` : '';

  for (const slot of ['a', 'b'] as const) {
    const row = $(`.color-row[data-slot="${slot}"]`);
    const hex = state[slot];
    $<HTMLInputElement>('input[type=color]', row).value = hex.toLowerCase();
    $('.swatch', row).style.background = hex;
    const name = $<HTMLInputElement>('.name', row), hx = $<HTMLInputElement>('.hex', row);
    if (document.activeElement !== name) name.value = slot === 'a' ? state.aName : state.bName;
    if (document.activeElement !== hx) hx.value = hex;
    name.setAttribute('aria-label', slot === 'a' ? T.nameA : T.nameB);
    hx.setAttribute('aria-label', slot === 'a' ? T.hexA : T.hexB);
    const locked = slot === 'a' ? state.lockA : state.lockB;
    const lk = $('.lock', row);
    lk.innerHTML = icon(locked ? 'lock' : 'unlock');
    lk.setAttribute('aria-pressed', String(locked));
    lk.setAttribute('aria-label', locked ? T.unlock : T.lock);
    lk.title = locked ? T.unlock : T.lock;
  }

  const ratio = wcagRatio(state.a, state.b);
  $('#wcag').textContent = `${ratio.toFixed(2)} : 1`;
  const lvl = $('#wcag-level');
  lvl.textContent = `WCAG ${wcagLevel(ratio)}`;
  lvl.dataset.level = wcagLevel(ratio).replace(' ', '-');
  $('#apca').textContent = `Lc ${Math.abs(apcaLc(state.b, state.a)).toFixed(0)} / ${Math.abs(apcaLc(state.a, state.b)).toFixed(0)}`;

  const kinds: (CvdKind | 'normal')[] = ['normal', 'protan', 'deutan', 'tritan'];
  $('#cvd').innerHTML = kinds.map((k) => {
    const a = k === 'normal' ? state.a : simulateCvd(state.a, k);
    const b = k === 'normal' ? state.b : simulateCvd(state.b, k);
    return `<div class="cvd-tile" style="background:${a};color:${b}"><b>Aa</b><span>${T.cvdNames[k]}</span></div>`;
  }).join('');

  $('#num').textContent = String(settings.number).padStart(2, '0');
  $$('#formats button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.fmt === settings.format)));
  $$('#styles button').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.v || null) === filterStyle)));
  $$('#families button').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.v || null) === filterFamily)));
  $<HTMLButtonElement>('#undo').disabled = history.length === 0;

  renderCode();
  renderSeries();
  const sl = $<HTMLAnchorElement>('#shard-link');
  if (state.id) { sl.href = shardUrl(BASE, state.id); sl.textContent = shardUrl('/', state.id); sl.parentElement!.hidden = false; }
  else sl.parentElement!.hidden = true;

  const url = permalink(location.pathname + location.search, state);
  if (location.hash !== url.slice(url.indexOf('#'))) history_replace(url);
  document.title = `${state.aName} × ${state.bName} – Combo Studio`;
}

const history_replace = (url: string) => { try { window.history.replaceState(null, '', url); } catch { /* file:// */ } };

function codeText(): string {
  switch (codeTab) {
    case 'md': return toMarkdown(BASE, state);
    case 'json': return toJson(BASE, state);
    case 'css': return toCss(state);
    case 'tw': return toTailwind(state);
    case 'tokens': return toTokens(state);
  }
}

function renderCode() {
  $('#code').textContent = codeText();
  $$('#code-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === codeTab)));
}

function renderSeries() {
  $('#series-count').textContent = series.length ? String(series.length) : '';
  $('#series-empty').hidden = series.length > 0;
  $('#series-actions').hidden = series.length === 0;
  $('#series').innerHTML = series.map((p, i) => `
    <li>
      <button class="thumb" type="button" data-i="${i}" aria-label="${esc(p.aName)} / ${esc(p.bName)}">
        <span style="background:${p.a};color:${p.b}">${String(i + 1).padStart(2, '0')}</span>
        <span style="background:${p.b}"></span>
      </button>
      <button class="rm" type="button" data-rm="${i}" aria-label="${T.remove}">${icon('x')}</button>
    </li>`).join('');
}

function applyLang() {
  T = LANGS[lang];
  document.documentElement.lang = lang;
  $$('[data-t]').forEach((el) => { const v = T[el.dataset.t as keyof Strings]; if (typeof v === 'string') el.textContent = v; });
  $$('[data-label]').forEach((el) => { const v = T[el.dataset.label as keyof Strings] as string; el.setAttribute('aria-label', v); el.title = v; });
  $('#lang').textContent = lang === 'de' ? 'EN' : 'DE';
  $('#lang').setAttribute('aria-label', lang === 'de' ? 'English' : 'Deutsch');

  $('#styles').innerHTML = [`<button class="chip" type="button" data-v="">${T.all}</button>`,
    ...STYLES.map((s) => `<button class="chip" type="button" data-v="${s}">${T.styles[s]}</button>`)].join('');
  const famColor: Record<Family, string> = {
    red: '#E5213C', orange: '#FF6A13', yellow: '#FFC400', lime: '#B6F000', green: '#2BCB4B', teal: '#0FA38E', cyan: '#21D4EC',
    blue: '#2F6BFF', indigo: '#4B3BD6', violet: '#8E3BE0', magenta: '#D62EC4', pink: '#FF4F9A', neutral: '#9A9A9A',
  };
  $('#families').innerHTML = [`<button class="chip" type="button" data-v="">${T.all}</button>`,
    ...FAMILIES.map((f) => `<button class="chip fam" type="button" data-v="${f}"><i style="background:${famColor[f]}"></i>${T.families[f]}</button>`)].join('');
  $('#code-tabs').innerHTML = ([['md', 'Prompt'], ['json', 'JSON'], ['css', 'CSS'], ['tw', 'Tailwind'], ['tokens', 'Tokens']] as const)
    .map(([k, l]) => `<button class="tab" role="tab" type="button" data-tab="${k}">${l}</button>`).join('');
  $('#formats').innerHTML = (Object.keys(FORMATS) as Format[])
    .map((f) => `<button class="seg-btn" role="radio" type="button" data-fmt="${f}">${f}</button>`).join('');
  render();
}

// ---------- Hilfen ----------
let toastTimer = 0;
function toast(msg: string) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('show'), 1800);
}

async function copy(text: string, label = T.copied) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  toast(label);
}

const saveSettings = () => store.set('settings', settings);
const saveSeries = () => store.set('series', series);
const seriesCards = () => series.map((p, i) => cardData(p, i + 1));

// ---------- Ereignisse ----------
function wire() {
  $$('[data-icon]').forEach((el) => (el.outerHTML = icon(el.dataset.icon as IconName)));
  $('#gen').addEventListener('click', generate);
  $('#undo').addEventListener('click', undo);
  $('#swap').addEventListener('click', swap);
  $('#lang').addEventListener('click', () => { lang = lang === 'de' ? 'en' : 'de'; try { localStorage.setItem('lang', lang); } catch { /* */ } applyLang(); });

  for (const slot of ['a', 'b'] as const) {
    const row = $(`.color-row[data-slot="${slot}"]`);
    $<HTMLInputElement>('input[type=color]', row).addEventListener('change', (e) => setHex(slot, (e.target as HTMLInputElement).value));
    const hx = $<HTMLInputElement>('.hex', row);
    hx.addEventListener('change', () => setHex(slot, hx.value));
    hx.addEventListener('keydown', (e) => { if (e.key === 'Enter') hx.blur(); });
    const nm = $<HTMLInputElement>('.name', row);
    nm.addEventListener('input', () => {
      state = { ...state, [slot + 'Name']: nm.value.trim() || state[slot] } as State;
      renderToCanvas($<HTMLCanvasElement>('#card'), settings.format, cardData(state));
      renderCode();
    });
    $('.lock', row).addEventListener('click', () => {
      state = slot === 'a' ? { ...state, lockA: !state.lockA, lockB: false } : { ...state, lockB: !state.lockB, lockA: false };
      render();
    });
    $('.copy-hex', row).addEventListener('click', () => copy(state[slot], `${state[slot]} ${T.copied.toLowerCase()}`));
  }

  $('#styles').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!b) return;
    filterStyle = (b.dataset.v || null) as Style | null; render(); void generate();
  });
  $('#families').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!b) return;
    filterFamily = (b.dataset.v || null) as Family | null; render(); void generate();
  });
  $('#code-tabs').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!b) return;
    codeTab = b.dataset.tab as typeof codeTab; renderCode();
  });
  $('#code-copy').addEventListener('click', () => copy(codeText()));
  $('#ai').addEventListener('click', () => copy(toMarkdown(BASE, state), `${T.copied} – ${T.forAi}`));
  $('#link').addEventListener('click', () => copy(permalink(BASE, state)));
  $('#png').addEventListener('click', async () => download(await cardBlob(settings.format, cardData(state)), fileName(cardData(state), 'png')));
  $('#share').addEventListener('click', async () => {
    const d = cardData(state);
    const file = new File([await cardBlob(settings.format, d)], fileName(d, 'png'), { type: 'image/png' });
    const data = { files: [file], title: `${state.aName} × ${state.bName}`, text: `${state.aName} ${state.a} × ${state.bName} ${state.b}\n${permalink(BASE, state)}` };
    if (navigator.canShare?.(data)) { try { await navigator.share(data); } catch { /* abgebrochen */ } }
    else download(file, file.name);
  });

  $<HTMLInputElement>('#set-header').value = settings.header;
  $('#set-header').addEventListener('input', (e) => { settings.header = (e.target as HTMLInputElement).value; saveSettings(); render(); });
  $('#num-minus').addEventListener('click', () => { settings.number = Math.max(1, settings.number - 1); saveSettings(); render(); });
  $('#num-plus').addEventListener('click', () => { settings.number = Math.min(99, settings.number + 1); saveSettings(); render(); });
  $('#formats').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!b) return;
    settings.format = b.dataset.fmt as Format; saveSettings(); render();
  });

  $('#add').addEventListener('click', () => {
    series.push({ a: state.a, b: state.b, aName: state.aName, bName: state.bName, id: state.id, style: state.style });
    saveSeries(); settings.number = Math.min(99, series.length + 1); saveSettings(); render();
    toast(`${T.series}: ${series.length}`);
  });
  $('#series').addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const rm = el.closest<HTMLButtonElement>('[data-rm]');
    if (rm) { series.splice(Number(rm.dataset.rm), 1); saveSeries(); renderSeries(); return; }
    const th = el.closest<HTMLButtonElement>('[data-i]');
    if (th) { const p = series[Number(th.dataset.i)]; push({ ...p, lockA: false, lockB: false }); }
  });
  $('#clear').addEventListener('click', () => { series = []; saveSeries(); renderSeries(); });
  $('#zip').addEventListener('click', async () => download(await zipCards(settings.format, seriesCards()), 'combo-series.zip'));
  const vbtn = $<HTMLButtonElement>('#video');
  if (!videoMime()) vbtn.hidden = true;
  vbtn.addEventListener('click', async () => {
    vbtn.disabled = true;
    const label = vbtn.lastElementChild!;
    try {
      const blob = await recordVideo(settings.format, seriesCards(), (p) => (label.textContent = `${Math.round(p * 100)} %`));
      download(blob, `combo-series.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`);
    } finally { vbtn.disabled = false; label.textContent = T.video; }
  });

  // Tastatur: Leertaste/→ = neu, ← = zurück (nicht in Eingabefeldern)
  document.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space' || e.key === 'ArrowRight') { if ((e.target as HTMLElement).tagName === 'BUTTON' && e.code === 'Space') return; e.preventDefault(); void generate(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); undo(); }
  });

  // Wischen auf der Karte: links = neu, rechts = zurück
  const canvas = $('#card');
  let sx = 0, sy = 0;
  canvas.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
  canvas.addEventListener('pointerup', (e) => {
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) dx < 0 ? void generate() : undo();
  });

  window.addEventListener('hashchange', () => void fromHash());
}

async function fromHash(raw = location.hash): Promise<boolean> {
  const h = decodeURIComponent(raw.slice(1));
  const id = /^\d{1,7}$/.test(h) ? Number(h) : 0;
  if (id >= 1 && id <= CATALOG_SIZE) {
    if (state.id !== id) push({ ...(await pairById(id)), lockA: false, lockB: false });
    return true;
  }
  const m = /^#?([0-9a-f]{6})-#?([0-9a-f]{6})$/i.exec(h);
  if (m) {
    const a = '#' + m[1].toUpperCase(), b = '#' + m[2].toUpperCase();
    if (a !== state.a || b !== state.b) push({ a, b, aName: await nameOf(a), bName: await nameOf(b), lockA: false, lockB: false });
    return true;
  }
  return false;
}

async function init() {
  const startHash = location.hash; // vor dem ersten render() sichern, das den Hash überschreibt
  wire();
  applyLang();
  await fontsReady();
  render();
  if (!(await fromHash(startHash))) await generate();
  history.length = 0;
  render();
  if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

void init();
