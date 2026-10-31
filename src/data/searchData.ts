import { grad } from './content.ts';

export interface SearchCatalogItem {
  t: string;
  g: string[];
  bg: string;
  type: 'Movie' | 'Series';
  y: number;
  r: string;
}

const X = ['Sci-Fi', 'Drama', 'Comedy', 'Romance', 'Thriller', 'Animation', 'Mystery'];

const FEAT: Array<[string, string, string]> = [
  ['Houses & Dragons', 'Fantasy', 'linear-gradient(180deg,#c08c36,#6b4a1c 52%,#1b1510)'],
  ['The Last of Us', 'Drama', 'linear-gradient(180deg,#d8a35a,#5b6a4a 48%,#1d2418)'],
  ['The Mandalorian', 'Sci-Fi', 'linear-gradient(180deg,#e0923f,#8a4a1f 52%,#2a1a14)'],
  ['Loki', 'Fantasy', 'radial-gradient(circle at 50% 30%,#f2c75a,#3d6b45 55%,#102a1c)'],
  ['The Witcher', 'Fantasy', 'linear-gradient(180deg,#8696a0,#3d4a55 55%,#161c22)'],
  ['Wednesday', 'Mystery', 'linear-gradient(180deg,#4a56a0,#1f2350 55%,#0b0d1f)'],
  ['La Casa de Papel', 'Thriller', 'linear-gradient(180deg,#c3282a,#7a1210 55%,#2a0707)'],
];

const SEARCH_CATS: Array<[string, number, number, number, string[]]> = [
  ['Horror', 350, 45, 32, ['The Hollow', 'Night Ward', 'Black Chapel', 'Salt & Bone', 'The Lantern', 'Dead Hour', 'Mother Moon']],
  ['Fantasy', 265, 48, 40, ['Ember Crown', 'The Last Glade', 'Moonspire', 'Wyrm Song', 'Ashen Realm', 'Elder Tales', 'Starforge']],
  ['Action', 18, 70, 40, ['Redline', 'Breakpoint', 'Iron Harbor', 'Nine Seconds', 'Cold Strike', 'Last Convoy', 'Zero Hour']],
  ['BL', 320, 58, 58, ['Sunday Letters', 'Blue Hour', 'Paper Stars', 'Seaside Duet', 'After Class', 'Love in Bloom', 'Moon Cafe']],
  ['Superhero', 215, 62, 44, ['Nova Guard', 'Captain Volt', 'The Sentinel', 'Skyfall Squad', 'Midnight Hero', 'Aegis', 'Rise of Titan']],
];

export const SEARCH_ITEMS: SearchCatalogItem[] = [];
let n = 0;
const addItem = (t: string, g: string[], bg: string) => {
  SEARCH_ITEMS.push({
    t,
    g,
    bg,
    type: n % 3 ? 'Movie' : 'Series',
    y: 2024 + (n % 7),
    r: (4.1 + ((n * 7) % 9) / 10).toFixed(1),
  });
  n++;
};

FEAT.forEach(([t, g, bg], i) => {
  addItem(
    t,
    [g, X[(i * 2 + 1) % 7]].filter((a, j, A) => A.indexOf(a) === j),
    bg
  );
});

SEARCH_CATS.forEach(([c, h, s, l, L]) => {
  L.forEach((t, i) => {
    addItem(t, [c, X[(n * 3) % 7]], grad(h, s, l, i));
  });
});

export const SEARCH_GENRES = ['Horror', 'Fantasy', 'Action', 'BL', 'Superhero', ...X];

export const GENRE_HUES: Record<string, number> = {
  Horror: 350,
  Fantasy: 265,
  Action: 18,
  BL: 320,
  Superhero: 215,
  'Sci-Fi': 195,
  Drama: 30,
  Comedy: 48,
  Romance: 340,
  Thriller: 0,
  Animation: 150,
  Mystery: 250,
};
