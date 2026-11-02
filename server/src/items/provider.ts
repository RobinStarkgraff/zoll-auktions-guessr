import type { Item } from '../../../shared/types.ts';
import { mockProvider } from './mock.ts';
import { withTranslation } from './translate.ts';
import { zollProvider } from './zoll.ts';

export interface ItemProvider {
  /** Returns `count` distinct random items with a known price. */
  fetchItems(count: number): Promise<Item[]>;
}

export function createProvider(
  source = process.env.ITEM_SOURCE ?? 'zoll',
  translateTo = process.env.TRANSLATE_TO ?? 'en',
): ItemProvider {
  const providers: Record<string, ItemProvider> = { mock: mockProvider, zoll: zollProvider };
  const provider = providers[source];
  if (!provider) throw new Error(`Unknown ITEM_SOURCE "${source}" (expected "zoll" or "mock")`);
  return translateTo && translateTo !== 'off' ? withTranslation(provider, translateTo) : provider;
}

export function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
