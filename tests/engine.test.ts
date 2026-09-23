import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apcaLc, hexToOklch, oklchToHex, simulateCvd, wcagRatio } from '../src/color.ts';
import { comboById, partnerFor, passes, rngFromSeed, generate, STYLES } from '../src/generator.ts';
import { familyOf } from '../src/facets.ts';

test('WCAG-Kontrast: Referenzwerte', () => {
  assert.equal(wcagRatio('#000000', '#FFFFFF').toFixed(2), '21.00');
  assert.equal(wcagRatio('#777777', '#FFFFFF').toFixed(2), '4.48');
});

test('APCA: bekannte Referenz #888 auf #FFF ≈ Lc 63.1, #FFF auf #000 ≈ -107.9', () => {
  assert.ok(Math.abs(apcaLc('#888888', '#FFFFFF') - 63.06) < 0.1);
  assert.ok(Math.abs(apcaLc('#FFFFFF', '#000000') + 107.88) < 0.1);
});

test('OKLCH-Rundreise: höchstens 3 Stufen Abweichung pro Kanal (Gamut-Rand)', () => {
  const ch = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  for (const hex of ['#21F1A8', '#FD1843', '#3C1A47', '#FFBE0B', '#004741', '#808080']) {
    const back = ch(oklchToHex(hexToOklch(hex)));
    ch(hex).forEach((v, i) => assert.ok(Math.abs(v - back[i]) <= 3, `${hex} -> ${oklchToHex(hexToOklch(hex))}`));
  }
});

test('CVD-Simulation liefert gültige Hexwerte', () => {
  assert.match(simulateCvd('#FD1843', 'deutan'), /^#[0-9A-F]{6}$/);
});

test('Katalog ist deterministisch', () => {
  for (const id of [1, 7, 482913, 1000000]) assert.deepEqual(comboById(id), comboById(id));
});

test('5.000 Katalog-Combos bestehen alle das Qualitätstor', () => {
  for (let id = 1; id <= 5000; id++) {
    const c = comboById(id);
    assert.ok(passes(c.a, c.b), `#${id} ${c.a}/${c.b}`);
  }
});

test('Jeder Stil erzeugt gültige Combos', () => {
  const r = rngFromSeed(42);
  for (const st of STYLES) for (let i = 0; i < 200; i++) {
    const c = generate(r, st);
    assert.ok(passes(c.a, c.b));
  }
});

test('Partner zu gesperrter Farbe besteht das Tor', () => {
  const r = rngFromSeed(1);
  for (const hex of ['#21F1A8', '#FD1843', '#808080', '#000000', '#FFFFFF', '#3C1A47']) {
    const p = partnerFor(hex, r);
    assert.ok(passes(hex, p) || ['#141414', '#FAFAFA'].includes(p), `${hex}/${p}`);
  }
});

test('Farbfamilie', () => {
  assert.equal(familyOf('#21F1A8', '#171717'), 'teal');
  assert.equal(familyOf('#2BEE34', '#141414'), 'green');
  assert.equal(familyOf('#101010', '#F0F0F0'), 'neutral');
});
