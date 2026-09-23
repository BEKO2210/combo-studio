// Lucide-Icons (ISC) als Inline-SVG.
import refresh from 'lucide-static/icons/refresh-cw.svg?raw';
import undo from 'lucide-static/icons/undo-2.svg?raw';
import swap from 'lucide-static/icons/arrow-left-right.svg?raw';
import lock from 'lucide-static/icons/lock.svg?raw';
import unlock from 'lucide-static/icons/lock-open.svg?raw';
import copy from 'lucide-static/icons/copy.svg?raw';
import download from 'lucide-static/icons/download.svg?raw';
import share from 'lucide-static/icons/share-2.svg?raw';
import link from 'lucide-static/icons/link.svg?raw';
import sparkles from 'lucide-static/icons/sparkles.svg?raw';
import plus from 'lucide-static/icons/plus.svg?raw';
import minus from 'lucide-static/icons/minus.svg?raw';
import trash from 'lucide-static/icons/trash-2.svg?raw';
import film from 'lucide-static/icons/film.svg?raw';
import archive from 'lucide-static/icons/archive.svg?raw';
import x from 'lucide-static/icons/x.svg?raw';

const raw = { refresh, undo, swap, lock, unlock, copy, download, share, link, sparkles, plus, minus, trash, film, archive, x };
export type IconName = keyof typeof raw;

export const icon = (n: IconName) =>
  raw[n].replace(/<!--.*?-->/s, '').replace('<svg', '<svg aria-hidden="true" focusable="false"').replace(/\s+/g, ' ').trim();
