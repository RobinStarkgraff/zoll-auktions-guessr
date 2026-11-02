# Deploying Guess the Price

The game needs a running Node server (Socket.IO rooms, Zoll-Auktion scraping, the `/api/image` proxy),
so GitHub Pages won't work. The code stays on GitHub; [Render](https://render.com) builds and runs it
from there. Option B is a no-hosting alternative for a single evening.

## Option A: Render (permanent link)

### 1. Push the code to GitHub

Create an empty repository on GitHub (private is fine), then:

```sh
git add -A
git commit -m "Add Guess the Price"
git remote add origin git@github.com:<you>/guess-the-price.git
git push -u origin master
```

### 2. Create the service from the Blueprint

1. Sign in at [dashboard.render.com](https://dashboard.render.com) with your GitHub account.
2. Click **New → Blueprint**.
3. Connect the repository (grant Render access to it if it isn't listed) and pick the branch you pushed.
4. Render reads `render.yaml` and shows one web service, `guess-the-price`. Click **Apply**.
5. Wait for the first build (a few minutes). The log should end with
   `Guess the price running on http://localhost:10000 (items: zoll, translate: en)`.

The game is now live at `https://guess-the-price-xxxx.onrender.com` (the exact URL is shown on the service page).

### 3. Play

Open the URL, create a room, and send your friends the room link or the 4-letter code.

### Updating

Every push to the connected branch redeploys automatically (`autoDeploy: true`).
A redeploy restarts the server, so don't push during a game.

### Things to know

- **Cold starts.** On the free plan the service sleeps after 15 minutes without traffic.
  The first visit afterwards takes 30–60 s. Open the link yourself a minute before you play.
- **Rooms are in memory.** A restart or redeploy ends all running games. Keep it on one instance.
- **Live items may get blocked.** Zoll-Auktion might rate-limit or block cloud IP addresses.
  If rounds show no items, go to the service → **Environment**, set `ITEM_SOURCE` to `mock`, and save
  (Render restarts with the built-in sample items).
- **Translation may stop working.** Auction texts are translated through Google's unofficial, keyless
  Translate endpoint, which can rate-limit or block cloud IPs without notice. Items then show in German;
  the game keeps working. Set `TRANSLATE_TO` to `off` to skip translation entirely.
- **Node version.** The project needs Node ≥ 22.12 (Vitest 5 requires it). Render uses Node 22 via `NODE_VERSION`.

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| Build fails in `npm ci` with `ERESOLVE` or a fetch error | `package-lock.json` must resolve from `registry.npmjs.org`. If it was regenerated against a private registry, run `sed -i -E 's#https://artifacts\.innogames\.de(:443)?/artifactory/api/npm/innogames-npm/#https://registry.npmjs.org/#g' package-lock.json` (on macOS: `sed -i ''`) and commit. |
| `vite: not found` during build | `NODE_ENV=production` was set in the Render environment, which skips devDependencies. Remove it. |
| Page loads but "connecting…" never finishes | Check the service logs. Usually the server crashed or is still waking up. |

## Option B: Run it on your machine + a tunnel (one evening)

Requires Node ≥ 22.12 locally.

```sh
npm install
npm run build
npm start                                      # server on http://localhost:3000
```

In a second terminal, expose it with [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/)
(no account needed):

```sh
cloudflared tunnel --url http://localhost:3000
```

It prints a `https://<random>.trycloudflare.com` URL. Share that with your friends.
The game works only while both commands are running, and the URL changes each time.
