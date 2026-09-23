// Erzeugt public/names.txt (kompakt) aus color-name-list.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const list = JSON.parse(readFileSync('node_modules/color-name-list/dist/colornames.json', 'utf8'));
const good = (n) => n.length <= 16 && /^[A-Za-z][A-Za-z \-]*$/.test(n);
const out = list.filter((x) => good(x.name)).map((x) => `${x.name}|${x.hex.slice(1).toUpperCase()}`);
mkdirSync('public', { recursive: true });
writeFileSync('public/names.txt', out.join('\n') + '\n');
console.log('names', out.length);
