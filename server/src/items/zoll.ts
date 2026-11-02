import * as cheerio from 'cheerio';
import type { Item, ItemImage } from '../../../shared/types.ts';
import type { ItemProvider } from './provider.ts';
import { shuffle } from './provider.ts';

const BASE = 'https://www.zoll-auktion.de';
const LIST_URL = `${BASE}/auktion/auktionsuebersicht.php?n0=search&t=t1&s=12&pagination=`;
const ITEM_PATH = /^\/auktion\/produkt\/[^/?#]+\/(\d+)$/;
const CACHE_MS = 30 * 60_000;
/** Random listing pages (10 auctions each) sampled per game. */
const LIST_PAGES = 3;
const MAX_DESCRIPTION = 1500;
const MAX_IMAGES = 30;
const PARALLEL = 5;

let pageCountCache: { at: number; pages: number } | null = null;

async function get(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'guess-the-price/0.1 (party game)', 'Accept-Language': 'de-DE' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}

/** Item page paths (e.g. /auktion/produkt/1_Kettenbagger/986817) linked from a listing page. */
export function parseItemPaths(html: string): string[] {
  const $ = cheerio.load(html);
  const paths = new Set<string>();
  $('a[href^="/auktion/produkt/"]').each((_, a) => {
    const href = $(a).attr('href')!;
    if (ITEM_PATH.test(href)) paths.add(href);
  });
  return [...paths];
}

/** Highest page number linked from the listing's pagination. */
export function parsePageCount(html: string): number {
  const pages = [...html.matchAll(/pagination=(\d+)/g)].map((m) => Number(m[1]));
  return Math.max(1, ...pages);
}

async function pageCount(): Promise<number> {
  if (pageCountCache && Date.now() - pageCountCache.at < CACHE_MS) return pageCountCache.pages;
  const pages = parsePageCount(await get(`${LIST_URL}1`));
  pageCountCache = { at: Date.now(), pages };
  return pages;
}

/** Item paths from a few random pages of the full auction listing. */
async function listItemPaths(): Promise<string[]> {
  const total = await pageCount();
  const pages = shuffle(Array.from({ length: total }, (_, i) => i + 1)).slice(0, LIST_PAGES);
  const lists = await Promise.all(pages.map(async (n) => parseItemPaths(await get(`${LIST_URL}${n}`))));
  const paths = [...new Set(lists.flat())];
  if (paths.length === 0) throw new Error('No auction links found on the Zoll-Auktion listing');
  return paths;
}

/** Parses German amounts like "1.234,56 EUR" into cents. */
export function parseEuroCents(text: string): number | null {
  const m = /(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*(?:€|EUR)/.exec(text.replace(/ /g, ' '));
  if (!m) return null;
  const euros = Number(m[1].replace(/\./g, ''));
  const cents = m[2] ? Number(m[2].padEnd(2, '0')) : 0;
  return euros * 100 + cents;
}

export function parseItemPage(html: string, path: string): Item | null {
  const $ = cheerio.load(html);
  const id = ITEM_PATH.exec(path)?.[1];
  const title = $('#ueberschrift_auktion').text().trim();
  const priceCents = parseEuroCents($('#hoechstgebot').text());

  // The first gallery image has a real src; the others are lazy-loaded with the large
  // version in data-za-orgsrc and the small one in data-src.
  const images: ItemImage[] = [];
  $('#auk_carousel .carousel-item img').each((_, el) => {
    const img = $(el);
    const real = (src?: string) => (src && !src.includes('ajax-loader') ? new URL(src, BASE).href : undefined);
    const src = real(img.attr('data-za-orgsrc')) ?? real(img.attr('src')) ?? real(img.attr('data-src'));
    if (!src || images.some((i) => i.src === src)) return;
    const thumb = real(img.attr('data-src')) ?? src.replace('/galerie_large_', '/galerie_');
    images.push({ src, thumb });
  });

  const description = $('#gegenstandsbeschreibung');
  description.find('br').replaceWith('\n');
  description.find('p, li').each((_, el) => {
    $(el).prepend($(el).is('li') ? '• ' : '').append('\n');
  });
  const text = description
    .text()
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n\n(?=• )/g, '\n')
    .trim();

  if (!id || !title || images.length === 0 || priceCents === null) return null;
  return {
    id,
    title,
    description: text.length > MAX_DESCRIPTION ? `${text.slice(0, MAX_DESCRIPTION).trimEnd()} …` : text,
    images: images.slice(0, MAX_IMAGES),
    priceCents,
    url: new URL(path, BASE).href,
  };
}

async function fetchItem(path: string): Promise<Item | null> {
  try {
    return parseItemPage(await get(new URL(path, BASE).href), path);
  } catch (err) {
    console.warn(`Skipping auction ${path}:`, (err as Error).message);
    return null;
  }
}

export const zollProvider: ItemProvider = {
  /** Picks random auctions; the price is the current bid, or the starting price if nobody bid yet. */
  async fetchItems(count) {
    const candidates = shuffle(await listItemPaths());
    const items: Item[] = [];
    for (let i = 0; i < candidates.length && items.length < count; i += PARALLEL) {
      const batch = await Promise.all(candidates.slice(i, i + PARALLEL).map(fetchItem));
      items.push(...batch.filter((item): item is Item => item !== null));
    }
    if (items.length < count) {
      throw new Error(`Only found ${items.length} of ${count} usable auctions`);
    }
    return items.slice(0, count);
  },
};
