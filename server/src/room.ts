import type { Item, Phase, PlayerView, RoomState, RoundResult } from '../../shared/types.ts';
import { GUESS_SECONDS, TOTAL_ROUNDS } from '../../shared/types.ts';
import type { ItemProvider } from './items/provider.ts';
import { compareStandings, scoreRound } from './scoring.ts';

interface Player {
  id: string;
  name: string;
  score: number;
  totalOffCents: number;
  connected: boolean;
  guessCents: number | null;
}

export class Room {
  readonly players = new Map<string, Player>();
  hostId: string;
  private phase: Phase = 'lobby';
  private round = 0;
  private items: Item[] = [];
  private deadline: number | null = null;
  private timer: NodeJS.Timeout | null = null;
  private reveal: RoomState['reveal'] = null;
  private error: string | null = null;

  constructor(
    readonly code: string,
    hostId: string,
    hostName: string,
    private readonly provider: ItemProvider,
    private readonly onChange: (room: Room) => void,
  ) {
    this.hostId = hostId;
    this.addPlayer(hostId, hostName);
  }

  get isEmpty(): boolean {
    return [...this.players.values()].every((p) => !p.connected);
  }

  /** New players can only join in the lobby; known players can always reconnect. */
  join(id: string, name: string): string | null {
    const existing = this.players.get(id);
    if (existing) {
      existing.connected = true;
      this.changed();
      return null;
    }
    if (this.phase !== 'lobby') return 'This game has already started';
    if (this.players.size >= 12) return 'Room is full';
    this.addPlayer(id, name);
    this.changed();
    return null;
  }

  disconnect(id: string): void {
    const p = this.players.get(id);
    if (!p) return;
    if (this.phase === 'lobby') this.players.delete(id);
    else p.connected = false;
    if (id === this.hostId) {
      const next = [...this.players.values()].find((x) => x.connected);
      if (next) this.hostId = next.id;
    }
    this.maybeEndRound();
    this.changed();
  }

  async start(by: string): Promise<void> {
    if (by !== this.hostId || (this.phase !== 'lobby' && this.phase !== 'finished')) return;
    for (const [id, p] of this.players) {
      if (!p.connected) this.players.delete(id);
      p.score = 0;
      p.totalOffCents = 0;
    }
    this.round = 0;
    this.reveal = null;
    this.error = null;
    this.phase = 'loading';
    this.changed();
    try {
      this.items = await this.provider.fetchItems(TOTAL_ROUNDS);
    } catch (err) {
      console.error('Fetching items failed:', err);
      this.error = `Could not load auction items: ${(err as Error).message}`;
      this.phase = 'lobby';
      this.changed();
      return;
    }
    this.beginRound();
  }

  guess(by: string, cents: number): void {
    const p = this.players.get(by);
    if (this.phase !== 'guessing' || !p || p.guessCents !== null) return;
    if (!Number.isSafeInteger(cents) || cents < 0) return;
    p.guessCents = cents;
    this.maybeEndRound();
    this.changed();
  }

  next(by: string): void {
    if (by !== this.hostId || this.phase !== 'reveal') return;
    if (this.round >= TOTAL_ROUNDS) {
      this.phase = 'finished';
      this.changed();
    } else {
      this.beginRound();
    }
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  state(): RoomState {
    const players = [...this.players.values()].map(toView);
    const item = this.items[this.round - 1];
    return {
      code: this.code,
      hostId: this.hostId,
      phase: this.phase,
      round: this.round,
      totalRounds: TOTAL_ROUNDS,
      players,
      item: item && this.phase !== 'lobby' ? withoutPrice(item) : null,
      deadline: this.deadline,
      reveal: this.reveal,
      standings: this.phase === 'finished' ? [...players].sort(compareStandings) : null,
      error: this.error,
    };
  }

  private addPlayer(id: string, name: string): void {
    this.players.set(id, { id, name, score: 0, totalOffCents: 0, connected: true, guessCents: null });
  }

  private beginRound(): void {
    this.round++;
    this.reveal = null;
    for (const p of this.players.values()) p.guessCents = null;
    this.phase = 'guessing';
    this.deadline = Date.now() + GUESS_SECONDS * 1000;
    this.timer = setTimeout(() => this.endRound(), GUESS_SECONDS * 1000);
    this.changed();
  }

  private maybeEndRound(): void {
    if (this.phase !== 'guessing') return;
    const active = [...this.players.values()].filter((p) => p.connected);
    if (active.length > 0 && active.every((p) => p.guessCents !== null)) this.endRound();
  }

  private endRound(): void {
    if (this.phase !== 'guessing') return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.deadline = null;
    const priceCents = this.items[this.round - 1].priceCents;
    const results: RoundResult[] = scoreRound(
      priceCents,
      [...this.players.values()].map((p) => ({ playerId: p.id, name: p.name, guessCents: p.guessCents })),
    );
    for (const r of results) {
      const p = this.players.get(r.playerId)!;
      p.score += r.points;
      p.totalOffCents += r.offCents;
    }
    this.reveal = { priceCents, results };
    this.phase = 'reveal';
    this.changed();
  }

  private changed(): void {
    this.onChange(this);
  }
}

function toView(p: Player): PlayerView {
  return {
    id: p.id,
    name: p.name,
    score: p.score,
    totalOffCents: p.totalOffCents,
    hasGuessed: p.guessCents !== null,
    connected: p.connected,
  };
}

function withoutPrice({ priceCents: _, ...rest }: Item) {
  return rest;
}
