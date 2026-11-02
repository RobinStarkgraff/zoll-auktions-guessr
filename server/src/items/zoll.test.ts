import { describe, expect, it } from 'vitest';
import { parseEuroCents, parseItemPage, parseItemPaths, parsePageCount } from './zoll.ts';

// Trimmed-down markup mirroring www.zoll-auktion.de (checked 2026-10-28).
const ITEM_HTML = `<html><body>
<div id="auk_carousel" class="carousel lazy"><div class="carousel-inner">
  <div class="carousel-item active"><a href="#"><img src="/auktion/bilder/1_Bagger/galerie_large_986817_09aa724/986817_Bagger.jpg" alt=""></a></div>
  <div class="carousel-item"><img src="/gui/images/ajax-loader.gif" data-za-orgsrc="/auktion/bilder/1_Bagger/galerie_large_986817_x/986817_b.jpg" data-src="/auktion/bilder/1_Bagger/galerie_986817_x/986817_b.jpg"></div>
</div></div>
<div id="auktionsinfobox">
  <h4 id="ueberschrift_auktion">1 Kettenbagger Atlas 160 LC</h4>
  <span id="hoechstgebot" class="h4 font-weight-bold ">27.500,00&nbsp;EUR</span>
  <span id="anz_gebote_zahl">1</span> <span id="anz_gebote_text">Gebot</span>
  Minimalgebot: <span id="minimalgebot">27.600,00&nbsp;EUR</span>
</div>
<div id="gegenstandsbeschreibung"><p>Versteigert wird ein Kettenbagger.</p> <p>&nbsp;</p>
<p><strong>Technische Daten:</strong></p> <ul> <li>Baujahr: 2015</li> <li>Kraftstoff: Diesel</li> </ul></div>
</body></html>`;

describe('parseEuroCents', () => {
  it.each([
    ['27.500,00 EUR', 2_750_000],
    ['1.234,56 €', 123_456],
    ['12 EUR', 1_200],
    ['0,5 €', 50],
    ['no price', null],
  ])('%s → %s', (text, cents) => expect(parseEuroCents(text)).toBe(cents));
});

describe('parseItemPaths', () => {
  it('keeps unique item links only', () => {
    const html = `<a href="/auktion/produkt/1_A/1">a</a><a href="/auktion/produkt/1_A/1">a</a>
      <a href="/auktion/produkt/1_B/2/1/2">gallery</a><a href="/auktion/kategorie/X/3">cat</a><a href="/auktion/produkt/1_C/4">c</a>`;
    expect(parseItemPaths(html)).toEqual(['/auktion/produkt/1_A/1', '/auktion/produkt/1_C/4']);
  });
});

describe('parseItemPage', () => {
  it('reads title, current bid, all gallery images and description', () => {
    expect(parseItemPage(ITEM_HTML, '/auktion/produkt/1_Kettenbagger_Atlas_160_LC/986817')).toEqual({
      id: '986817',
      title: '1 Kettenbagger Atlas 160 LC',
      description: 'Versteigert wird ein Kettenbagger.\n\nTechnische Daten:\n• Baujahr: 2015\n• Kraftstoff: Diesel',
      images: [
        {
          src: 'https://www.zoll-auktion.de/auktion/bilder/1_Bagger/galerie_large_986817_09aa724/986817_Bagger.jpg',
          thumb: 'https://www.zoll-auktion.de/auktion/bilder/1_Bagger/galerie_986817_09aa724/986817_Bagger.jpg',
        },
        {
          src: 'https://www.zoll-auktion.de/auktion/bilder/1_Bagger/galerie_large_986817_x/986817_b.jpg',
          thumb: 'https://www.zoll-auktion.de/auktion/bilder/1_Bagger/galerie_986817_x/986817_b.jpg',
        },
      ],
      priceCents: 2_750_000,
      url: 'https://www.zoll-auktion.de/auktion/produkt/1_Kettenbagger_Atlas_160_LC/986817',
    });
  });

  it('returns null without a price', () => {
    expect(parseItemPage(ITEM_HTML.replace(/<span id="hoechstgebot".*?<\/span>/, ''), '/auktion/produkt/x/1')).toBeNull();
  });
});

describe('parsePageCount', () => {
  it('reads the highest pagination link', () => {
    const html = `<a href="?n0=search&amp;t=t1&amp;s=12&amp;pagination=2">2</a><a href="?n0=search&amp;pagination=196">196</a>`;
    expect(parsePageCount(html)).toBe(196);
    expect(parsePageCount('<p>no pages</p>')).toBe(1);
  });
});
