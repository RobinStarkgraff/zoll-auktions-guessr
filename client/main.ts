import { io, type Socket } from 'socket.io-client';
import type { ClientToServer, PlayerView, RoomState, ServerToClient } from '../shared/types.ts';

const app = document.getElementById('app')!;
const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const fmt = (cents: number) => euro.format(cents / 100);

// Per-tab identity so a reload rejoins the same seat.
const storage = {
  get: (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } },
};
let playerId = storage.get('playerId') ?? crypto.randomUUID();
storage.set('playerId', playerId);

const socket: Socket<ServerToClient, ClientToServer> = io({ auth: { playerId } });
let state: RoomState | null = null;
let homeError = '';
let tick: number | undefined;
/** Picture shown in the gallery; kept across redraws of the same item. */
let gallery = { itemId: '', index: 0 };

socket.on('state', (s) => {
  state = s;
  render();
});

socket.on('connect', () => {
  // Rejoin after a reload or a dropped connection; a stale room is dropped silently.
  const code = storage.get('room');
  const name = storage.get('name');
  if (code && name) socket.emit('join', code, name, (res) => onJoined(res, true));
});

function onJoined(res: { code: string; playerId: string } | { error: string }, silent = false) {
  if ('error' in res) {
    storage.set('room', '');
    state = null;
    homeError = silent ? '' : res.error;
    render();
    return;
  }
  playerId = res.playerId;
  storage.set('room', res.code);
  history.replaceState(null, '', `?room=${res.code}`);
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function imageSrc(url: string): string {
  return url.startsWith('data:') ? url : `/api/image?url=${encodeURIComponent(url)}`;
}

function render() {
  clearInterval(tick);
  if (!state) return renderHome();
  const s = state;
  const isHost = s.hostId === playerId;
  const header = `
    <div class="topbar">
      <h1>Guess the Price</h1>
      <span class="muted">Raum <span class="code">${s.code}</span>${s.round ? ` · Runde ${s.round}/${s.totalRounds}` : ''}</span>
    </div>`;
  const body = {
    lobby: () => renderLobby(s, isHost),
    loading: () => `<div class="card"><p>Lade Auktionen…</p></div>`,
    guessing: () => renderGuessing(s),
    reveal: () => renderReveal(s, isHost),
    finished: () => renderFinished(s, isHost),
  }[s.phase]();
  // Keep a half-typed guess when another player's update redraws the page.
  const typing = document.getElementById('amount') as HTMLInputElement | null;
  const draft = typing?.value ?? '';
  const focused = document.activeElement === typing;
  app.innerHTML = header + body;
  const amount = document.getElementById('amount') as HTMLInputElement | null;
  if (amount) {
    amount.value = draft;
    if (focused || !draft) amount.focus();
  }
  bind(s);
}

function renderHome() {
  const params = new URLSearchParams(location.search);
  const code = params.get('room') ?? '';
  app.innerHTML = `
    <div class="topbar"><h1>Guess the Price</h1></div>
    <p class="muted lead">Errate den aktuellen Gebotspreis echter Zoll-Auktionen. 5 Runden, wer am nächsten liegt, bekommt die meisten Punkte.</p>
    <div class="cols-3">
      <div class="card">
        <h2>Dein Name</h2>
        <div class="row"><input id="name" maxlength="20" value="${esc(storage.get('name') ?? '')}" autocomplete="nickname"></div>
      </div>
      <div class="card">
        <h2>Raum beitreten</h2>
        <div class="row">
          <input id="code" maxlength="4" placeholder="CODE" value="${esc(code)}" style="text-transform:uppercase">
          <button id="join">Beitreten</button>
        </div>
      </div>
      <div class="card">
        <h2>Neues Spiel</h2>
        <button id="create">Raum erstellen</button>
      </div>
    </div>
    ${homeError ? `<p class="error">${esc(homeError)}</p>` : ''}`;
  const name = () => {
    const n = (document.getElementById('name') as HTMLInputElement).value.trim();
    if (!n) {
      homeError = 'Bitte gib einen Namen ein.';
      renderHome();
      return null;
    }
    storage.set('name', n);
    homeError = '';
    return n;
  };
  document.getElementById('create')!.onclick = () => {
    const n = name();
    if (n) socket.emit('create', n, (res) => onJoined(res));
  };
  document.getElementById('join')!.onclick = () => {
    const n = name();
    const c = (document.getElementById('code') as HTMLInputElement).value.trim().toUpperCase();
    if (n && c) socket.emit('join', c, n, (res) => onJoined(res));
  };
}

function playerList(players: PlayerView[], s: RoomState, extra: (p: PlayerView) => string = () => '') {
  return `<ul class="players">${players
    .map((p) => `<li><span>${esc(p.name)}${p.id === s.hostId ? ' <span class="tag">Host</span>' : ''}${p.id === playerId ? ' <span class="tag">(du)</span>' : ''}${p.connected ? '' : ' <span class="tag">offline</span>'}</span><span>${extra(p)}</span></li>`)
    .join('')}</ul>`;
}

function renderLobby(s: RoomState, isHost: boolean) {
  const link = `${location.origin}${location.pathname}?room=${s.code}`;
  return `
    <div class="cols-2">
      <div class="card">
        <h2>Spieler (${s.players.length})</h2>
        ${playerList(s.players, s)}
      </div>
      <div class="card">
        <h2>Einladen</h2>
        <p class="muted">Teile den Code <b class="code">${s.code}</b> oder den Link:<br><a href="${link}">${link}</a></p>
        ${s.error ? `<p class="error">${esc(s.error)}</p>` : ''}
        ${isHost ? `<button id="start">Spiel starten</button>` : `<p class="muted">Warte auf den Host…</p>`}
      </div>
    </div>`;
}

function renderGallery(item: NonNullable<RoomState['item']>) {
  if (gallery.itemId !== item.id) gallery = { itemId: item.id, index: 0 };
  const { images } = item;
  const current = images[gallery.index];
  if (images.length === 1) return `<img class="item-img" src="${esc(imageSrc(current.src))}" alt="">`;
  return `
    <div class="gallery">
      <div class="gallery-main">
        <img class="item-img" id="gallery-img" src="${esc(imageSrc(current.src))}" alt="">
        <button class="gallery-nav prev" id="gallery-prev" aria-label="Vorheriges Bild">‹</button>
        <button class="gallery-nav next" id="gallery-next" aria-label="Nächstes Bild">›</button>
        <span class="gallery-count" id="gallery-count">${gallery.index + 1} / ${images.length}</span>
      </div>
      <div class="thumbs" id="gallery-thumbs">${images
        .map((img, i) => `<button class="thumb${i === gallery.index ? ' active' : ''}" data-index="${i}" aria-label="Bild ${i + 1}"><img src="${esc(imageSrc(img.thumb))}" alt="" loading="lazy"></button>`)
        .join('')}</div>
    </div>`;
}

/** Switches pictures in place so typing a guess isn't interrupted. */
function bindGallery(item: NonNullable<RoomState['item']>) {
  const main = document.getElementById('gallery-img') as HTMLImageElement | null;
  if (!main) return;
  const count = document.getElementById('gallery-count')!;
  const thumbs = [...document.querySelectorAll<HTMLButtonElement>('#gallery-thumbs .thumb')];
  const show = (index: number) => {
    const n = item.images.length;
    gallery.index = ((index % n) + n) % n;
    main.src = imageSrc(item.images[gallery.index].src);
    count.textContent = `${gallery.index + 1} / ${n}`;
    thumbs.forEach((t, i) => t.classList.toggle('active', i === gallery.index));
    thumbs[gallery.index].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  };
  document.getElementById('gallery-prev')!.onclick = () => show(gallery.index - 1);
  document.getElementById('gallery-next')!.onclick = () => show(gallery.index + 1);
  thumbs.forEach((t) => (t.onclick = () => show(Number(t.dataset.index))));

  galleryKeys = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === 'ArrowLeft') show(gallery.index - 1);
    if (e.key === 'ArrowRight') show(gallery.index + 1);
  };
}

let galleryKeys: ((e: KeyboardEvent) => void) | null = null;
document.addEventListener('keydown', (e) => galleryKeys?.(e));

function renderGuessing(s: RoomState) {
  const item = s.item!;
  const me = s.players.find((p) => p.id === playerId);
  return `
    <div class="stage">
      <div class="card stage-media">${renderGallery(item)}</div>
      <aside class="stage-side">
        <div class="card">
          <div class="topbar"><h2>Dein Tipp</h2><span class="timer" id="timer"></span></div>
          ${me?.hasGuessed
            ? `<p>Tipp abgegeben. Warte auf die anderen…</p>`
            : `<form id="guess" class="row"><input id="amount" placeholder="z. B. 149,99" autofocus><span>€</span><button>Tippen</button></form>`}
          <div class="side-players">${playerList(s.players, s, (p) => (p.hasGuessed ? '✓' : '…'))}</div>
        </div>
        <div class="card item-info">
          <h2>${esc(item.title)}</h2>
          <p class="description">${esc(item.description)}</p>
        </div>
      </aside>
    </div>`;
}

function renderReveal(s: RoomState, isHost: boolean) {
  const { priceCents, results } = s.reveal!;
  const last = s.round >= s.totalRounds;
  return `
    <div class="stage">
      <div class="card stage-media">${renderGallery(s.item!)}</div>
      <aside class="stage-side">
        <div class="card">
          <p class="muted">${esc(s.item!.title)} · <a href="${esc(s.item!.url)}" target="_blank" rel="noopener">Zur Auktion</a></p>
          <p>Aktuelles Gebot: <span class="price">${fmt(priceCents)}</span></p>
          <table>
            <thead><tr><th>#</th><th>Spieler</th><th class="num">Tipp</th><th class="num">Daneben</th><th class="num">Punkte</th></tr></thead>
            <tbody>${results
              .map((r) => `<tr><td>${r.rank ?? '–'}</td><td>${esc(r.name)}</td><td class="num">${r.guessCents === null ? 'kein Tipp' : fmt(r.guessCents)}</td><td class="num">${fmt(r.offCents)}</td><td class="num">+${r.points}</td></tr>`)
              .join('')}</tbody>
          </table>
          <div class="actions">
            ${isHost ? `<button id="next">${last ? 'Endergebnis' : 'Nächste Runde'}</button>` : `<p class="muted">Warte auf den Host…</p>`}
          </div>
        </div>
        ${scoreboard(s)}
      </aside>
    </div>`;
}

function scoreboard(s: RoomState, list = [...s.players].sort((a, b) => b.score - a.score || a.totalOffCents - b.totalOffCents)) {
  return `
    <div class="card">
      <h2>Punktestand</h2>
      <table>
        <thead><tr><th>#</th><th>Spieler</th><th class="num">Punkte</th><th class="num">Insgesamt daneben</th></tr></thead>
        <tbody>${list
          .map((p, i) => `<tr${i === 0 && s.phase === 'finished' ? ' class="winner"' : ''}><td>${i + 1}</td><td>${esc(p.name)}</td><td class="num">${p.score}</td><td class="num">${fmt(p.totalOffCents)}</td></tr>`)
          .join('')}</tbody>
      </table>
    </div>`;
}

function renderFinished(s: RoomState, isHost: boolean) {
  const winner = s.standings![0];
  return `
    <div class="cols-2 finish">
      <div class="card winner-card">
        <div class="trophy">🏆</div>
        <h2>${esc(winner.name)} gewinnt!</h2>
        <p class="muted">${winner.score} Punkte · insgesamt ${fmt(winner.totalOffCents)} daneben</p>
        <p class="muted small">Bei Punktgleichheit entscheidet, wer insgesamt weniger danebenlag.</p>
        ${isHost ? `<button id="start">Nochmal spielen</button>` : `<p class="muted">Warte auf den Host…</p>`}
      </div>
      ${scoreboard(s, s.standings!)}
    </div>`;
}

/** Accepts "1.234,56", "1234.56", "1234" and returns cents. */
function parseGuess(input: string): number | null {
  let v = input.replace(/[€\s]/g, '');
  if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.');
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

function bind(s: RoomState) {
  galleryKeys = null;
  if ((s.phase === 'guessing' || s.phase === 'reveal') && s.item) bindGallery(s.item);
  const on = (id: string, fn: () => void) => {
    const el = document.getElementById(id);
    if (el) el.onclick = fn;
  };
  on('start', () => socket.emit('start'));
  on('next', () => socket.emit('next'));

  const form = document.getElementById('guess') as HTMLFormElement | null;
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const cents = parseGuess((document.getElementById('amount') as HTMLInputElement).value);
      if (cents !== null) socket.emit('guess', cents);
    };
  }

  const timer = document.getElementById('timer');
  if (timer && s.deadline) {
    const update = () => {
      timer.textContent = `${Math.max(0, Math.ceil((s.deadline! - Date.now()) / 1000))} s`;
    };
    update();
    tick = window.setInterval(update, 250);
  }
}

render();
