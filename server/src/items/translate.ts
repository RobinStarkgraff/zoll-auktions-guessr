import type { Item } from '../../../shared/types.ts';
import type { ItemProvider } from './provider.ts';

// Unofficial, keyless endpoint behind Google's Translate widgets. Undocumented and unsupported:
// it may rate-limit, block cloud IPs or change at any time, so every failure falls back to the original text.
const ENDPOINT = 'https://translate.googleapis.com/translate_a/single';

/** Joins the translated segments of a `dt=t` response: `[[["Hello", "Hallo", …], …], …]`. */
export function parseTranslation(body: unknown): string | null {
  if (!Array.isArray(body) || !Array.isArray(body[0])) return null;
  const parts = body[0].map((segment: unknown) => (Array.isArray(segment) ? segment[0] : null));
  if (parts.some((p) => typeof p !== 'string')) return null;
  return parts.join('');
}

export async function translate(text: string, to: string): Promise<string> {
  if (!text.trim()) return text;
  const params = new URLSearchParams({ client: 'gtx', sl: 'auto', tl: to, dt: 't', q: text });
  const res = await fetch(`${ENDPOINT}?${params}`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Google Translate → ${res.status}`);
  const translated = parseTranslation(await res.json());
  if (translated === null) throw new Error('Unexpected Google Translate response');
  if (!translated.trim()) throw new Error('Empty Google Translate response');
  return translated;
}

/** Each text falls back to the German original on its own, so a failed description keeps a translated title. */
async function translateItem(item: Item, to: string): Promise<Item> {
  const orOriginal = (field: 'title' | 'description') =>
    translate(item[field], to).catch((err: Error) => {
      console.warn(`Showing original ${field} of auction ${item.id}:`, err.message);
      return item[field];
    });
  const [title, description] = await Promise.all([orOriginal('title'), orOriginal('description')]);
  return { ...item, title, description };
}

/** Translates each item's title and description into `to` (e.g. "en"), keeping the original on failure. */
export function withTranslation(provider: ItemProvider, to: string): ItemProvider {
  return {
    async fetchItems(count) {
      const items = await provider.fetchItems(count);
      return Promise.all(items.map((item) => translateItem(item, to)));
    },
  };
}
