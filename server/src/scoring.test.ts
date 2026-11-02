import { describe, expect, it } from 'vitest';
import { compareStandings, scoreRound } from './scoring.ts';

const g = (playerId: string, guessCents: number | null) => ({ playerId, name: playerId, guessCents });

describe('scoreRound', () => {
  it('gives N − rank + 1 points by distance', () => {
    const r = scoreRound(10_000, [g('a', 5_000), g('b', 9_000), g('c', 20_000), g('d', 10_500)]);
    expect(r.map((x) => [x.playerId, x.rank, x.points])).toEqual([
      ['d', 1, 4],
      ['b', 2, 3],
      ['a', 3, 2],
      ['c', 4, 1],
    ]);
  });

  it('lets equal distances share a rank', () => {
    const r = scoreRound(100, [g('a', 90), g('b', 110), g('c', 50)]);
    expect(r.map((x) => [x.playerId, x.rank, x.points])).toEqual([
      ['a', 1, 3],
      ['b', 1, 3],
      ['c', 3, 1],
    ]);
  });

  it('gives missing guesses 0 points and the full price as distance', () => {
    const r = scoreRound(2_500, [g('a', null), g('b', 1_000)]);
    expect(r.find((x) => x.playerId === 'a')).toMatchObject({ rank: null, points: 0, offCents: 2_500 });
    expect(r.find((x) => x.playerId === 'b')).toMatchObject({ rank: 1, points: 2, offCents: 1_500 });
  });
});

describe('compareStandings', () => {
  it('sorts by score, then by smaller total distance', () => {
    const list = [
      { id: 'a', score: 10, totalOffCents: 500 },
      { id: 'b', score: 12, totalOffCents: 9_000 },
      { id: 'c', score: 10, totalOffCents: 200 },
    ];
    expect(list.sort(compareStandings).map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });
});
