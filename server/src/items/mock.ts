import type { Item } from '../../../shared/types.ts';
import type { ItemProvider } from './provider.ts';
import { shuffle } from './provider.ts';

function placeholder(label: string, hue: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480">
<rect width="100%" height="100%" fill="hsl(${hue} 45% 55%)"/>
<text x="50%" y="50%" font-family="sans-serif" font-size="36" fill="#fff" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const ITEMS: Item[] = [
  ['Rolex Submariner (Replik, beschlagnahmt)', 'Armbanduhr, Edelstahl, ohne Box und Papiere. Funktion nicht geprüft.', 12_000],
  ['Konvolut 40 Paar Sneaker', 'Verschiedene Größen und Modelle, teilweise mit Gebrauchsspuren.', 41_550],
  ['Apple iPad Air 64 GB', 'Gerät lässt sich einschalten, iCloud-Sperre nicht geprüft.', 18_900],
  ['Ford Transit Kastenwagen', 'EZ 2014, ca. 210.000 km, TÜV abgelaufen, Schlüssel vorhanden.', 365_000],
  ['Goldmünze Krügerrand 1 oz', 'Feingold 999,9, aus Sicherstellung.', 238_000],
  ['Palette Bürostühle (12 Stück)', 'Drehstühle mit Armlehnen, Abholung nur vor Ort.', 7_500],
  ['Akkuschrauber-Set Makita', 'Zwei Akkus, Ladegerät, Koffer. Gebraucht.', 9_120],
  ['Designer-Handtasche (Fälschung? nein, Original)', 'Leder, Echtheitszertifikat liegt bei.', 54_000],
].map(([title, description, priceCents], i) => ({
  id: `mock-${i}`,
  title: title as string,
  description: description as string,
  priceCents: priceCents as number,
  images: [0, 1, 2].map((n) => {
    const src = placeholder(`Objekt ${i + 1} · Bild ${n + 1}`, (i * 47 + n * 25) % 360);
    return { src, thumb: src };
  }),
  url: 'https://www.zoll-auktion.de/auktion/index.php',
}));

export const mockProvider: ItemProvider = {
  async fetchItems(count) {
    return shuffle(ITEMS).slice(0, count);
  },
};
