export const TOTAL_ROUNDS = 5;
export const GUESS_SECONDS = 45;

export interface ItemImage {
  src: string;
  thumb: string;
}

export interface Item {
  id: string;
  title: string;
  description: string;
  /** All gallery pictures, first one is the main picture. */
  images: ItemImage[];
  /** Current bid in euro cents at the time the item was fetched. */
  priceCents: number;
  url: string;
}

/** Item as shown to players while guessing — no price. */
export type PublicItem = Omit<Item, 'priceCents'>;

export interface PlayerView {
  id: string;
  name: string;
  score: number;
  totalOffCents: number;
  hasGuessed: boolean;
  connected: boolean;
}

export interface RoundResult {
  playerId: string;
  name: string;
  /** null when the player did not guess in time. */
  guessCents: number | null;
  offCents: number;
  rank: number | null;
  points: number;
}

export type Phase = 'lobby' | 'loading' | 'guessing' | 'reveal' | 'finished';

export interface RoomState {
  code: string;
  hostId: string;
  phase: Phase;
  round: number;
  totalRounds: number;
  players: PlayerView[];
  item: PublicItem | null;
  deadline: number | null;
  /** Present in the reveal and finished phases. */
  reveal: { priceCents: number; results: RoundResult[] } | null;
  /** Present in the finished phase, best first. */
  standings: PlayerView[] | null;
  error: string | null;
}

export interface ServerToClient {
  state: (state: RoomState) => void;
}

export interface ClientToServer {
  create: (name: string, cb: (res: { code: string; playerId: string } | { error: string }) => void) => void;
  join: (code: string, name: string, cb: (res: { code: string; playerId: string } | { error: string }) => void) => void;
  start: () => void;
  guess: (cents: number) => void;
  next: () => void;
}
