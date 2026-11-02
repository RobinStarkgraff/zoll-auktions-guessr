import { describe, expect, it } from 'vitest';
import { parseTranslation } from './translate.ts';

describe('parseTranslation', () => {
  it('joins the translated segments', () => {
    const body = [
      [
        ['An excavator is auctioned.\n', 'Versteigert wird ein Kettenbagger.\n', null, null, 10],
        ['Year: 2015', 'Baujahr: 2015', null, null, 10],
      ],
      null,
      'de',
    ];
    expect(parseTranslation(body)).toBe('An excavator is auctioned.\nYear: 2015');
  });

  it('rejects unexpected shapes', () => {
    expect(parseTranslation(null)).toBeNull();
    expect(parseTranslation({ text: 'x' })).toBeNull();
    expect(parseTranslation([[[42]]])).toBeNull();
  });
});
