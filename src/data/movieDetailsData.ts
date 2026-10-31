export type EpisodeData = [string, number, number]; // [title, durationMinutes, progressRatio]

export const SEASONS_DATA: EpisodeData[][] = [
  [
    ['The Iron Throne Rises', 58, 1],
    ['Blood and Embers', 54, 1],
    ['The Winter Pact', 61, 1],
    ['A Crown of Ash', 57, 0.62],
    ['Fire Over Harrow', 55, 0],
    ['The Broken Oath', 59, 0],
    ['Wings in the Dark', 62, 0],
    ['The Long Night', 64, 0],
  ],
  [
    ['Ashes of Kings', 56, 0],
    ['The Green Council', 53, 0],
    ['Sealed in Flame', 60, 0],
    ['The Hollow Court', 58, 0],
    ['Storm Over Dorne', 57, 0],
    ['Heirs of Smoke', 63, 0],
  ],
  [
    ['Embers Remain', 55, 0],
    ['The Silent Keep', 59, 0],
    ['Dragonglass', 61, 0],
    ['The Last Council', 56, 0],
    ['Dawn of Dragons', 60, 0],
    ['Crowns Fall', 66, 0],
  ],
];

export const EPISODE_DESCRIPTIONS = [
  'Lorem ipsum dolor sit amet consectetur. Pulvinar et amet nibh nunc aenean pulvinar etiam.',
  'Quis aliquet metus pellentesque aliquam potenti id. Et ultrices bibendum consequat elit.',
  'Vestibulum donec sit a. Lorem ipsum dolor sit amet consectetur pulvinar et amet nibh nunc.',
  'Et ultrices bibendum consequat elit vestibulum donec. Quis aliquet metus pellentesque.',
];

export const SIMILAR_POSTERS: Array<[string, string]> = [
  ['THE LAST|OF US', 'linear-gradient(180deg,#d8a35a,#5b6a4a 48%,#1d2418)'],
  ['THE|MANDALORIAN', 'linear-gradient(180deg,#e0923f,#8a4a1f 52%,#2a1a14)'],
  ['LOKI', 'radial-gradient(circle at 50% 30%,#f2c75a,#3d6b45 55%,#102a1c)'],
  ['THE|WITCHER', 'linear-gradient(180deg,#8696a0,#3d4a55 55%,#161c22)'],
  ['WEDNESDAY', 'linear-gradient(180deg,#4a56a0,#1f2350 55%,#0b0d1f)'],
  ['LA CASA|DE PAPEL', 'linear-gradient(180deg,#c3282a,#7a1210 55%,#2a0707)'],
];
