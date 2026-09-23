// Baut den statischen Katalog + Agenten-API nach public/api/v1 (deterministisch, aus derselben Engine wie die App).
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { CATALOG_SIZE, STYLES, comboById } from '../src/generator.ts';
import { buildIndex, nearestName } from '../src/names.ts';
import { FAMILIES, familyOf } from '../src/facets.ts';

const N = Number(process.env.CATALOG_SIZE ?? CATALOG_SIZE);
const SHARD = 1000;
const root = 'public/api/v1';
rmSync(root, { recursive: true, force: true });
mkdirSync(`${root}/combos`, { recursive: true });
mkdirSync(`${root}/facets`, { recursive: true });

const idx = buildIndex(readFileSync('public/names.txt', 'utf8'));
const facets = new Map<string, number[]>();
const t0 = Date.now();

for (let s = 0; s * SHARD < N; s++) {
  const rows: (string | number)[][] = [];
  for (let id = s * SHARD + 1; id <= Math.min(N, (s + 1) * SHARD); id++) {
    const c = comboById(id);
    const fam = familyOf(c.a, c.b);
    rows.push([id, c.a, nearestName(idx, c.a), c.b, nearestName(idx, c.b), c.style, fam]);
    const k = `${c.style}-${fam}`;
    (facets.get(k) ?? facets.set(k, []).get(k)!).push(id);
  }
  writeFileSync(`${root}/combos/${String(s).padStart(4, '0')}.json`,
    JSON.stringify({ fields: ['id', 'a', 'aName', 'b', 'bName', 'style', 'family'], combos: rows }));
  if (s % 100 === 0) console.log(`shard ${s} (${Date.now() - t0} ms)`);
}

const facetList: Record<string, number> = {};
for (const [k, ids] of facets) { writeFileSync(`${root}/facets/${k}.json`, JSON.stringify({ facet: k, count: ids.length, ids })); facetList[k] = ids.length; }

writeFileSync(`${root}/index.json`, JSON.stringify({
  name: 'Combo Studio catalog',
  version: 1,
  count: N,
  shardSize: SHARD,
  combosUrl: '/api/v1/combos/{shard}.json',
  shardFormula: 'shard = floor((id - 1) / 1000), zero-padded to 4 digits',
  fields: { a: 'color A (top card) hex', b: 'color B (bottom card) hex', style: STYLES, family: FAMILIES },
  facetsUrl: '/api/v1/facets/{style}-{family}.json',
  facets: facetList,
  guarantees: 'Every pair: WCAG 2.2 contrast >= 3:1 and |APCA Lc| >= 60 in both directions (large/display text).',
  license: 'Combos: CC0. Color names: meodai/color-name-list (MIT).',
}, null, 2));
console.log(`done ${N} combos in ${Date.now() - t0} ms`);
