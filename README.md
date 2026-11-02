# Guess the Price

Multiplayer party game: players see a real item from [Zoll-Auktion](https://www.zoll-auktion.de/auktion/index.php)
(picture, title, description) and guess its current bid. Five rounds per game.

## Rules

- Each round, guesses are ranked by how far they are from the current bid. Equal distances share a rank.
- Points per round: `N − rank + 1`, where N is the number of players (with 4 players: 4, 3, 2, 1).
- No guess before the 45 s timer runs out: 0 points, and the full price counts as the distance.
- After 5 rounds, most points wins. Tiebreaker: smallest total distance across all rounds.

## Running

```sh
npm install
npm run dev        # server on :3000, client on http://localhost:5173, live Zoll-Auktion items
npm run dev:mock   # same, with built-in sample items (no network needed)
npm test
npm run build && npm start   # production: one server on :3000 serving the built client
```

Requires Node ≥ 22.12.

To play online with friends, see [DEPLOY.md](DEPLOY.md) (Render, or a local server + tunnel).

The host creates a room and shares the 4-letter code or link; others join with a nickname.

## Item source

`ITEM_SOURCE=zoll` (default) scrapes `server/src/items/zoll.ts`; `ITEM_SOURCE=mock` uses `server/src/items/mock.ts`.
Titles and descriptions are translated into `TRANSLATE_TO` (default `en`, `off` disables it) through
Google's unofficial, keyless Translate endpoint (`server/src/items/translate.ts`). It is undocumented and may
rate-limit or break at any time; on failure the German original is shown.
Auction images are served through `/api/image` so browsers don't run into hotlink protection.

In the devcontainer, `www.zoll-auktion.de` and `translate.googleapis.com` must be on the firewall allowlist (`make dev-allow-domain`).
