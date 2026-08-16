'use strict';

const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const express = require('express');
const { Server } = require('socket.io');
const {
  GESTURES,
  canonicalGesture,
  suggestGesture,
  outcome
} = require('./lib/rules');

const PORT = Number(process.env.PORT) || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 16 * 1024,
  perMessageDeflate: false
});

// Lightweight security headers. No external assets are needed except Socket.IO,
// which is served from this same origin.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' ws: wss:"
  );
  next();
});

app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html'],
  maxAge: '1h'
}));

app.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

const rooms = new Map();

function cleanName(value) {
  const name = String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!name || name.length > 24) return null;
  return name;
}

function generateRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 100; attempt += 1) {
    let code = '';
    for (let i = 0; i < 6; i += 1) {
      code += alphabet[crypto.randomInt(0, alphabet.length)];
    }
    if (!rooms.has(code)) return code;
  }
  throw new Error('Could not generate unique room code');
}

function cleanRoomCode(value) {
  const code = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z0-9]{6}$/.test(code) ? code : null;
}

function makeRoom(code, socket, playerName) {
  return {
    code,
    players: [{ socketId: socket.id, seat: 0, name: playerName }],
    scores: [0, 0],
    round: 1,
    choices: new Map(),
    createdAt: Date.now()
  };
}

function publicState(room) {
  return {
    code: room.code,
    round: room.round,
    players: room.players.map((player) => ({
      seat: player.seat,
      name: player.name,
      score: room.scores[player.seat],
      locked: room.choices.has(player.socketId)
    }))
  };
}

function broadcastState(room) {
  io.to(room.code).emit('roomState', publicState(room));
}

function getMembership(socket, roomCode) {
  const code = cleanRoomCode(roomCode);
  if (!code) return null;
  const room = rooms.get(code);
  if (!room) return null;
  const player = room.players.find((p) => p.socketId === socket.id);
  if (!player) return null;
  return { room, player };
}

function rateLimited(socket, key, minimumGapMs) {
  const now = Date.now();
  socket.data.lastEvents ??= Object.create(null);
  const previous = socket.data.lastEvents[key] ?? 0;
  socket.data.lastEvents[key] = now;
  return now - previous < minimumGapMs;
}

function leaveCurrentRoom(socket, reason = 'opponent-left') {
  const code = socket.data.roomCode;
  if (!code) return;

  const room = rooms.get(code);
  socket.leave(code);
  socket.data.roomCode = null;
  socket.data.seat = null;

  if (!room) return;

  rooms.delete(code);
  for (const player of room.players) {
    if (player.socketId === socket.id) continue;
    const other = io.sockets.sockets.get(player.socketId);
    if (other) {
      other.leave(code);
      other.data.roomCode = null;
      other.data.seat = null;
      other.emit('roomClosed', { reason });
    }
  }
}

io.on('connection', (socket) => {
  socket.emit('hello', {
    gestures: GESTURES,
    socketId: socket.id
  });

  socket.on('createRoom', (payload, ack = () => {}) => {
    if (rateLimited(socket, 'createRoom', 500)) {
      return ack({ ok: false, error: 'Zkus to znovu za okamžik.' });
    }
    if (socket.data.roomCode) {
      return ack({ ok: false, error: 'Už jsi v místnosti.' });
    }

    const playerName = cleanName(payload?.playerName);
    if (!playerName) {
      return ack({ ok: false, error: 'Jméno musí mít 1–24 znaků.' });
    }

    const code = generateRoomCode();
    const room = makeRoom(code, socket, playerName);
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.seat = 0;

    ack({ ok: true, code, seat: 0 });
    broadcastState(room);
  });

  socket.on('joinRoom', (payload, ack = () => {}) => {
    if (rateLimited(socket, 'joinRoom', 300)) {
      return ack({ ok: false, error: 'Zkus to znovu za okamžik.' });
    }
    if (socket.data.roomCode) {
      return ack({ ok: false, error: 'Už jsi v místnosti.' });
    }

    const playerName = cleanName(payload?.playerName);
    const code = cleanRoomCode(payload?.roomCode);
    if (!playerName) {
      return ack({ ok: false, error: 'Jméno musí mít 1–24 znaků.' });
    }
    if (!code) {
      return ack({ ok: false, error: 'Kód místnosti musí mít 6 znaků.' });
    }

    const room = rooms.get(code);
    if (!room) {
      return ack({ ok: false, error: 'Místnost neexistuje.' });
    }
    if (room.players.length >= 2) {
      return ack({ ok: false, error: 'Místnost je plná.' });
    }

    const seat = 1;
    room.players.push({ socketId: socket.id, seat, name: playerName });
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.seat = seat;

    ack({ ok: true, code, seat });
    broadcastState(room);
  });

  socket.on('submitMove', (payload, ack = () => {}) => {
    if (rateLimited(socket, 'submitMove', 120)) {
      return ack({ ok: false, error: 'Příliš rychlé odesílání.' });
    }

    const membership = getMembership(socket, payload?.roomCode);
    if (!membership) {
      return ack({ ok: false, error: 'Nejsi v této místnosti.' });
    }

    const { room, player } = membership;
    if (room.players.length !== 2) {
      return ack({ ok: false, error: 'Čeká se na druhého hráče.' });
    }

    if (!Number.isInteger(payload?.round) || payload.round !== room.round) {
      return ack({ ok: false, error: 'Tohle kolo už není aktuální.' });
    }

    if (room.choices.has(socket.id)) {
      return ack({ ok: false, error: 'Volbu už máš uzamčenou.' });
    }

    const move = canonicalGesture(payload?.move);
    if (!move) {
      const suggestion = suggestGesture(payload?.move);
      return ack({
        ok: false,
        error: 'Neznámá možnost. Vyber jednu ze 101 platných voleb.',
        suggestion: suggestion?.gesture ?? null
      });
    }

    room.choices.set(socket.id, move);
    ack({ ok: true, move });
    broadcastState(room); // only publishes locked=true, never the move

    if (room.choices.size !== 2) return;

    const p0 = room.players.find((p) => p.seat === 0);
    const p1 = room.players.find((p) => p.seat === 1);
    const move0 = room.choices.get(p0.socketId);
    const move1 = room.choices.get(p1.socketId);
    const result = outcome(move0, move1);

    let winnerSeat = null;
    if (result.winner === 1) winnerSeat = 0;
    if (result.winner === 2) winnerSeat = 1;
    if (winnerSeat !== null) room.scores[winnerSeat] += 1;

    const finishedRound = room.round;
    const resultPayload = {
      round: finishedRound,
      moves: [
        { seat: 0, name: p0.name, move: move0 },
        { seat: 1, name: p1.name, move: move1 }
      ],
      winnerSeat,
      winnerName: winnerSeat === null ? null : room.players.find((p) => p.seat === winnerSeat).name,
      text: result.text,
      scores: [...room.scores]
    };

    // Prepare the next round before emitting the result. A client still has to
    // submit the new round number, preventing a stale/spam event from becoming
    // an accidental choice for the next round.
    room.choices.clear();
    room.round += 1;

    io.to(room.code).emit('roundResult', resultPayload);
    broadcastState(room);
  });

  socket.on('resetScore', (payload, ack = () => {}) => {
    if (rateLimited(socket, 'resetScore', 500)) {
      return ack({ ok: false, error: 'Zkus to znovu za okamžik.' });
    }
    const membership = getMembership(socket, payload?.roomCode);
    if (!membership) return ack({ ok: false, error: 'Nejsi v této místnosti.' });

    const { room } = membership;
    room.scores = [0, 0];
    room.choices.clear();
    room.round += 1;
    ack({ ok: true });
    io.to(room.code).emit('scoreReset');
    broadcastState(room);
  });

  socket.on('leaveRoom', (_payload, ack = () => {}) => {
    leaveCurrentRoom(socket, 'opponent-left');
    ack({ ok: true });
  });

  socket.on('disconnect', () => {
    leaveCurrentRoom(socket, 'opponent-disconnected');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`RPS-101 online running on http://localhost:${PORT}`);
});
