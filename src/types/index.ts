export interface PosterItem {
  title: string;
  background: string;
  imageUrl?: string;
}

export interface TasteCardItem {
  title: string;
  rating: number;
  background: string;
}

export interface CategoryItem {
  name: string;
  h: number;
  s: number;
  l: number;
  titles: string[];
}

export interface SlideItem {
  t: string;
  r: string;
  y: string;
  q: string;
  g: string[];
  d: string;
  c: [string, string, string];
  h: number;
}

export type { MediaItem, CategoryDef as MediaCategory } from '../utils/mediaWorkerApi.ts';
