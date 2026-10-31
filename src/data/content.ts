import { PosterItem, TasteCardItem, CategoryItem, SlideItem } from '../types/index.ts';

export const VID = 'https://raw.githubusercontent.com/mediaelement/mediaelement-files/master/big_buck_bunny.mp4';
export const T = [9, 13, 18, 24, 33, 40, 46];

export const VID2 = 'https://raw.githubusercontent.com/mediaelement/mediaelement-files/master/big_buck_bunny.mp4';
export const T2 = [9, 13, 18, 24, 33, 46];

export const POSTERS: PosterItem[] = [
  { title: 'THE LAST|OF US', background: 'linear-gradient(180deg,#d8a35a,#5b6a4a 48%,#1d2418)' },
  { title: 'THE|MANDALORIAN', background: 'linear-gradient(180deg,#e0923f,#8a4a1f 52%,#2a1a14)' },
  { title: 'LOKI', background: 'radial-gradient(circle at 50% 30%,#f2c75a,#3d6b45 55%,#102a1c)' },
  { title: 'THE|WITCHER', background: 'linear-gradient(180deg,#8696a0,#3d4a55 55%,#161c22)' },
  { title: 'WEDNESDAY', background: 'linear-gradient(180deg,#4a56a0,#1f2350 55%,#0b0d1f)' },
  { title: 'LA CASA|DE PAPEL', background: 'linear-gradient(180deg,#c3282a,#7a1210 55%,#2a0707)' },
];

export const CARDS: TasteCardItem[] = [
  {
    title: 'Fiesta',
    rating: 4.7,
    background: 'radial-gradient(circle at 50% 28%,#f6d2a8 0 13%,transparent 14%),linear-gradient(160deg,#f0a074,#b04a6e 60%,#5a2f66)',
  },
  {
    title: 'Skyward',
    rating: 4.6,
    background: 'radial-gradient(circle at 20% 22%,#ff6b6b 0 6%,transparent 6.5%),radial-gradient(circle at 70% 14%,#ffd34d 0 7%,transparent 7.5%),radial-gradient(circle at 82% 38%,#7be0ff 0 5%,transparent 5.5%),linear-gradient(180deg,#59b6f2,#9fe0a0 70%,#3f9a5a)',
  },
  {
    title: 'Luck',
    rating: 4.8,
    background: 'radial-gradient(70% 45% at 50% 0,#a6f56e,transparent),linear-gradient(180deg,#58d34a,#1f9a35 52%,#0b4a1c)',
  },
  {
    title: 'Sunset',
    rating: 4.5,
    background: 'radial-gradient(circle at 50% 18%,#ffc79a 0 11%,transparent 12%),linear-gradient(180deg,#f58bb0,#a96cc8 55%,#3d3f86)',
  },
  {
    title: 'Stargazer',
    rating: 4.9,
    background: 'radial-gradient(circle at 30% 20%,#fff 0 1%,transparent 1.5%),radial-gradient(circle at 74% 30%,#fff 0 .8%,transparent 1.2%),linear-gradient(180deg,#2b4a9a,#6a4fb0 60%,#c86a8a)',
  },
  {
    title: 'Meadow',
    rating: 4.4,
    background: 'linear-gradient(180deg,#f7d56a,#8fd37a 60%,#2f7a4a)',
  },
  {
    title: 'Lantern',
    rating: 4.6,
    background: 'linear-gradient(180deg,#ff9a6a,#c8446a 55%,#4a2a6a)',
  },
];

export const CATS: CategoryItem[] = [
  {
    name: 'Horror',
    h: 350,
    s: 45,
    l: 32,
    titles: ['THE|HOLLOW', 'NIGHT|WARD', 'BLACK|CHAPEL', 'SALT &|BONE', 'THE|LANTERN', 'DEAD|HOUR', 'MOTHER|MOON'],
  },
  {
    name: 'Fantasy',
    h: 265,
    s: 48,
    l: 40,
    titles: ['EMBER|CROWN', 'THE LAST|GLADE', 'MOONSPIRE', 'WYRM|SONG', 'ASHEN|REALM', 'ELDER|TALES', 'STARFORGE'],
  },
  {
    name: 'Action',
    h: 18,
    s: 70,
    l: 40,
    titles: ['REDLINE', 'BREAK|POINT', 'IRON|HARBOR', 'NINE|SECONDS', 'COLD|STRIKE', 'LAST|CONVOY', 'ZERO|HOUR'],
  },
  {
    name: 'BL',
    h: 320,
    s: 58,
    l: 58,
    titles: ['SUNDAY|LETTERS', 'BLUE|HOUR', 'PAPER|STARS', 'SEASIDE|DUET', 'AFTER|CLASS', 'LOVE IN|BLOOM', 'MOON|CAFE'],
  },
  {
    name: 'Superhero',
    h: 215,
    s: 62,
    l: 44,
    titles: ['NOVA|GUARD', 'CAPTAIN|VOLT', 'THE|SENTINEL', 'SKYFALL|SQUAD', 'MIDNIGHT|HERO', 'AEGIS', 'RISE OF|TITAN'],
  },
];

export const grad = (h: number, s: number, l: number, i: number) => {
  const a = (h + i * 22) % 360;
  const c = (a + 25) % 360;
  return `linear-gradient(180deg,hsl(${a} ${s}% ${l}%),hsl(${c} ${Math.round(s * 0.85)}% 20%) 52%,hsl(${c} 40% 7%))`;
};

export const INTERESTS = [
  'Horror',
  'Fantasy',
  'Action',
  'BL',
  'Superhero',
  'Sci-Fi',
  'Drama',
  'Comedy',
  'Romance',
  'Thriller',
  'Animation',
  'Mystery',
  'Crime',
  'Adventure',
  'Documentary',
  'Anime',
];

export const SLIDES: SlideItem[] = [
  {
    t: 'HOUSES & DRAGONS',
    r: 'TV-MA',
    y: '2029',
    q: 'HDR',
    g: ['Sci-Fi', 'Fantasy'],
    d: 'Lorem ipsum dolor sit amet consectetur. Pulvinar et amet nibh nunc aenean pulvinar etiam. Quis aliquet metus pellentesque aliquam potenti id. Et ultrices bibendum consequat elit vestibulum donec sit a.',
    c: ['#c08c36', '#6b4a1c', '#3a2412'],
    h: 0,
  },
  {
    t: 'THE LAST OF US',
    r: 'TV-MA',
    y: '2027',
    q: '4K',
    g: ['Drama', 'Thriller'],
    d: 'Lorem ipsum dolor sit amet consectetur. Sed ut perspiciatis unde omnis iste natus error sit voluptatem. Totam rem aperiam eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta.',
    c: ['#86a35e', '#3d4f2a', '#1b2a14'],
    h: 110,
  },
  {
    t: 'THE MANDALORIAN',
    r: 'TV-14',
    y: '2028',
    q: 'HDR10',
    g: ['Sci-Fi', 'Adventure'],
    d: 'Lorem ipsum dolor sit amet consectetur. Neque porro quisquam est qui dolorem ipsum quia dolor sit amet. Ut enim ad minima veniam quis nostrum exercitationem ullam corporis suscipit laboriosam nisi.',
    c: ['#dc8c46', '#7a3f1a', '#33180c'],
    h: 25,
  },
  {
    t: 'LOKI',
    r: 'TV-14',
    y: '2026',
    q: 'Dolby',
    g: ['Fantasy', 'Action'],
    d: 'Lorem ipsum dolor sit amet consectetur. At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias.',
    c: ['#cdb44c', '#4a6b3a', '#12301f'],
    h: 135,
  },
  {
    t: 'WEDNESDAY',
    r: 'TV-MA',
    y: '2030',
    q: '4K',
    g: ['Mystery', 'Comedy'],
    d: 'Lorem ipsum dolor sit amet consectetur. Nam libero tempore cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus omnis voluptas assumenda est.',
    c: ['#6e7ed4', '#2a3470', '#111638'],
    h: 240,
  },
];
