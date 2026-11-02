import type { RoundResult } from '../../shared/types.ts';

export interface Guess {
  playerId: string;
  name: string;
  guessCents: number | null;
}

/**
 * Ranks guesses by distance to the price. Equal distances share a rank
 * (1, 2, 2, 4). Points are N − rank + 1 where N is the number of players
 * in the round. Players without a guess get no rank, 0 points, and count
 * as off by the full price for the tiebreaker.
 */
export function scoreRound(priceCents: number, guesses: Guess[]): RoundResult[] {
  const n = guesses.length;
  const results: RoundResult[] = guesses.map((g) => ({
    playerId: g.playerId,
    name: g.name,
    guessCents: g.guessCents,
    offCents: g.guessCents === null ? priceCents : Math.abs(g.guessCents - priceCents),
    rank: null,
    points: 0,
  }));

  const ranked = results
    .filter((r) => r.guessCents !== null)
    .sort((a, b) => a.offCents - b.offCents);
  ranked.forEach((r, i) => {
    const prev = ranked[i - 1];
    r.rank = prev && prev.offCents === r.offCents ? prev.rank! : i + 1;
    r.points = n - r.rank + 1;
  });

  const unranked = results.filter((r) => r.guessCents === null);
  return [...ranked, ...unranked];
}

export interface Standing {
  score: number;
  totalOffCents: number;
}

/** Most points wins; ties go to whoever was off by less in total. */
export function compareStandings(a: Standing, b: Standing): number {
  return b.score - a.score || a.totalOffCents - b.totalOffCents;
}
