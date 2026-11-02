import express from 'express';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import path from 'node:path';
import { Server } from 'socket.io';
import type { ClientToServer, ServerToClient } from '../../shared/types.ts';
import { createProvider } from './items/provider.ts';
import { Room } from './room.ts';

const PORT = Number(process.env.PORT ?? 3000);
const ROOM_TTL_MS = 10 * 60_000;

const provider = createProvider();
const app = express();
const http = createServer(app);
const io = new Server<ClientToServer, ServerToClient>(http);
const rooms = new Map<string, Room>();

// Proxy auction images so players' browsers don't hit referer/hotlink checks.
app.get('/api/image', async (req, res) => {
  const url = String(req.query.url ?? '');
  if (!/^https:\/\/(www\.)?zoll-auktion\.de\//.test(url)) {
    res.status(400).end();
    return;
  }
  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    res.status(upstream.status).type(upstream.headers.get('content-type') ?? 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.status(502).end();
  }
});

if (process.env.NODE_ENV === 'production') {
  const dist = path.resolve('dist');
  app.use(express.static(dist));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

function newCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code: string;
  do {
    code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function cleanName(name: unknown): string {
  return String(name ?? '').trim().slice(0, 20) || 'Player';
}

function broadcast(room: Room): void {
  io.to(room.code).emit('state', room.state());
}

io.on('connection', (socket) => {
  // Clients keep their id across reloads so they can rejoin a running game.
  const playerId = String(socket.handshake.auth.playerId || randomUUID());
  let room: Room | null = null;

  const enter = (r: Room) => {
    room = r;
    socket.join(r.code);
    broadcast(r);
  };

  socket.on('create', (name, cb) => {
    if (room) return cb({ error: 'Already in a room' });
    const r = new Room(newCode(), playerId, cleanName(name), provider, broadcast);
    rooms.set(r.code, r);
    cb({ code: r.code, playerId });
    enter(r);
  });

  socket.on('join', (code, name, cb) => {
    if (room) return cb({ error: 'Already in a room' });
    const r = rooms.get(String(code).toUpperCase());
    if (!r) return cb({ error: 'Room not found' });
    const error = r.join(playerId, cleanName(name));
    if (error) return cb({ error });
    cb({ code: r.code, playerId });
    enter(r);
  });

  socket.on('start', () => void room?.start(playerId));
  socket.on('guess', (cents) => room?.guess(playerId, Number(cents)));
  socket.on('next', () => room?.next(playerId));

  socket.on('disconnect', () => {
    const r = room;
    if (!r) return;
    r.disconnect(playerId);
    if (r.isEmpty) {
      setTimeout(() => {
        if (r.isEmpty && rooms.get(r.code) === r) {
          r.dispose();
          rooms.delete(r.code);
        }
      }, ROOM_TTL_MS);
    }
  });
});

http.listen(PORT, () => {
  console.log(`Guess the price running on http://localhost:${PORT} (items: ${process.env.ITEM_SOURCE ?? 'zoll'}, translate: ${process.env.TRANSLATE_TO ?? 'en'})`);
});
