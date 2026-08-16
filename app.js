'use strict';

const socket = io();

const $ = (id) => document.getElementById(id);
const els = {
  connectionBadge: $('connectionBadge'), lobby: $('lobby'), game: $('game'),
  playerName: $('playerName'), createRoom: $('createRoom'), roomCodeInput: $('roomCodeInput'),
  joinRoom: $('joinRoom'), lobbyError: $('lobbyError'), roomCode: $('roomCode'), copyCode: $('copyCode'),
  resetScore: $('resetScore'), leaveRoom: $('leaveRoom'), roundNumber: $('roundNumber'),
  player0: $('player0'), player1: $('player1'), turnStatus: $('turnStatus'),
  randomChoice: $('randomChoice'), toggleOptions: $('toggleOptions'), moveInput: $('moveInput'),
  lockMove: $('lockMove'), moveMessage: $('moveMessage'), optionsPanel: $('optionsPanel'),
  optionSearch: $('optionSearch'), optionsGrid: $('optionsGrid'), resultCard: $('resultCard'),
  resultRound: $('resultRound'), resultName0: $('resultName0'), resultMove0: $('resultMove0'),
  resultName1: $('resultName1'), resultMove1: $('resultMove1'), resultWinner: $('resultWinner'),
  resultText: $('resultText'), history: $('history')
};

let gestures = [];
let roomCode = null;
let selfSeat = null;
let currentRound = 1;
let currentState = null;
let historyEntries = [];

function normalize(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, ' ');
}

function levenshtein(a, b) {
  a = normalize(a);
  b = normalize(b);
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  const current = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }
  return previous[b.length];
}

function exactGesture(value) {
  const n = normalize(value);
  return gestures.find((g) => normalize(g) === n) ??
    (n === 'videogame' ? 'Video Game' : null);
}

function suggestionFor(value) {
  const n = normalize(value);
  if (!n || n.length <= 3) return null;
  let best = null;
  let distance = Infinity;
  let tied = false;
  for (const gesture of gestures) {
    const d = levenshtein(n, gesture);
    if (d < distance) {
      best = gesture;
      distance = d;
      tied = false;
    } else if (d === distance) {
      tied = true;
    }
  }
  const limit = n.length <= 5 ? 1 : n.length <= 8 ? 2 : 3;
  return !tied && distance <= limit ? best : null;
}

function setMessage(text = '', kind = '') {
  els.moveMessage.className = `message ${kind}`.trim();
  els.moveMessage.replaceChildren();
  if (text) els.moveMessage.append(document.createTextNode(text));
}

function showSuggestion(badValue, suggestion) {
  setMessage(`„${badValue}" není platná možnost.`, 'error-text');
  if (!suggestion) {
    els.moveMessage.append(document.createTextNode(' Otevři seznam 101 možností a vyber platnou.'));
    return;
  }
  els.moveMessage.append(document.createTextNode(' Myslel jsi '));
  const button = document.createElement('button');
  button.className = 'small suggestion';
  button.textContent = `${suggestion}?`;
  button.addEventListener('click', () => {
    els.moveInput.value = suggestion;
    selectOptionButton(suggestion);
    setMessage(`Opraveno na ${suggestion}. Teď můžeš volbu zamknout.`, 'success-text');
  });
  els.moveMessage.append(button);
}

function renderOptions(filter = '') {
  const query = normalize(filter);
  els.optionsGrid.replaceChildren();
  const current = exactGesture(els.moveInput.value);

  gestures
    .filter((gesture) => !query || normalize(gesture).includes(query))
    .forEach((gesture) => {
      const button = document.createElement('button');
      button.className = 'option-button';
      if (gesture === current) button.classList.add('selected');
      button.textContent = gesture;
      button.addEventListener('click', () => {
        els.moveInput.value = gesture;
        selectOptionButton(gesture);
        setMessage(`Vybráno: ${gesture}.`, 'success-text');
      });
      els.optionsGrid.append(button);
    });
}

function selectOptionButton(gesture) {
  for (const button of els.optionsGrid.querySelectorAll('button')) {
    button.classList.toggle('selected', button.textContent === gesture);
  }
}

function playerPanel(panel, player) {
  const name = panel.querySelector('.player-name');
  const score = panel.querySelector('.score');
  const lock = panel.querySelector('.lock-state');

  if (!player) {
    name.textContent = 'Čeká se…';
    score.textContent = '0';
    lock.textContent = 'offline';
    lock.classList.remove('locked');
    panel.classList.remove('self');
    return;
  }

  name.textContent = `${player.name}${player.seat === selfSeat ? ' (ty)' : ''}`;
  score.textContent = String(player.score);
  lock.textContent = player.locked ? '🔒 locked' : 'vybírá';
  lock.classList.toggle('locked', player.locked);
  panel.classList.toggle('self', player.seat === selfSeat);
}

function updateGameState(state) {
  currentState = state;
  currentRound = state.round;
  els.roundNumber.textContent = String(state.round);
  playerPanel(els.player0, state.players.find((p) => p.seat === 0));
  playerPanel(els.player1, state.players.find((p) => p.seat === 1));

  const self = state.players.find((p) => p.seat === selfSeat);
  const hasOpponent = state.players.length === 2;
  const locked = Boolean(self?.locked);

  els.moveInput.disabled = !hasOpponent || locked;
  els.lockMove.disabled = !hasOpponent || locked;
  els.randomChoice.disabled = !hasOpponent || locked;

  if (!hasOpponent) {
    els.turnStatus.textContent = 'Čeká se na druhého hráče. Pošli mu kód místnosti.';
  } else if (locked) {
    els.turnStatus.textContent = 'Tvoje volba je zamčená. Soupeř ji nevidí.';
  } else {
    els.turnStatus.textContent = 'Vyber jednu ze 101 možností a zamkni ji.';
  }
}

function enterRoom(code, seat) {
  roomCode = code;
  selfSeat = seat;
  els.roomCode.textContent = code;
  els.lobby.classList.add('hidden');
  els.game.classList.remove('hidden');
  els.resultCard.classList.add('hidden');
  historyEntries = [];
  renderHistory();
  setMessage();
}

function resetToLobby(message = '') {
  roomCode = null;
  selfSeat = null;
  currentState = null;
  els.game.classList.add('hidden');
  els.lobby.classList.remove('hidden');
  els.lobbyError.textContent = message;
}

function renderHistory() {
  els.history.replaceChildren();
  if (!historyEntries.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'Zatím žádná krev.';
    els.history.append(p);
    return;
  }

  for (const entry of historyEntries) {
    const row = document.createElement('div');
    row.className = 'history-row';

    const round = document.createElement('span');
    round.className = 'history-round';
    round.textContent = `#${entry.round}`;

    const left = document.createElement('span');
    left.textContent = `${entry.moves[0].name}: ${entry.moves[0].move}`;

    const right = document.createElement('span');
    right.textContent = `${entry.moves[1].name}: ${entry.moves[1].move}`;

    const winner = document.createElement('span');
    winner.className = 'history-winner';
    winner.textContent = entry.winnerName ? `🏆 ${entry.winnerName}` : 'remíza';

    row.append(round, left, right, winner);
    els.history.append(row);
  }
}

socket.on('connect', () => {
  els.connectionBadge.textContent = '● online';
  els.connectionBadge.className = 'badge online';
});

socket.on('disconnect', () => {
  els.connectionBadge.textContent = '● offline';
  els.connectionBadge.className = 'badge offline';
});

socket.on('hello', (payload) => {
  gestures = Array.isArray(payload?.gestures) ? payload.gestures : [];
  renderOptions();
});

socket.on('roomState', (state) => {
  if (!roomCode || state.code !== roomCode) return;
  updateGameState(state);
});

socket.on('roundResult', (result) => {
  els.resultCard.classList.remove('hidden');
  els.resultRound.textContent = String(result.round);
  els.resultName0.textContent = result.moves[0].name;
  els.resultMove0.textContent = result.moves[0].move;
  els.resultName1.textContent = result.moves[1].name;
  els.resultMove1.textContent = result.moves[1].move;
  els.resultWinner.textContent = result.winnerName ? `🏆 ${result.winnerName} vyhrává kolo` : '🤝 Remíza';
  els.resultText.textContent = result.text;

  historyEntries.unshift(result);
  historyEntries = historyEntries.slice(0, 30);
  renderHistory();

  els.moveInput.value = '';
  selectOptionButton(null);
  setMessage('Nové kolo je připravené.');
});

socket.on('scoreReset', () => {
  historyEntries = [];
  renderHistory();
  els.resultCard.classList.add('hidden');
  setMessage('Skóre bylo resetováno.');
});

socket.on('roomClosed', ({ reason }) => {
  const text = reason === 'opponent-disconnected'
    ? 'Soupeř se odpojil. Místnost byla uzavřena.'
    : 'Soupeř opustil místnost. Místnost byla uzavřena.';
  resetToLobby(text);
});

els.createRoom.addEventListener('click', () => {
  els.lobbyError.textContent = '';
  socket.emit('createRoom', { playerName: els.playerName.value }, (response) => {
    if (!response?.ok) {
      els.lobbyError.textContent = response?.error ?? 'Nepodařilo se vytvořit místnost.';
      return;
    }
    enterRoom(response.code, response.seat);
  });
});

els.joinRoom.addEventListener('click', () => {
  els.lobbyError.textContent = '';
  socket.emit('joinRoom', {
    playerName: els.playerName.value,
    roomCode: els.roomCodeInput.value
  }, (response) => {
    if (!response?.ok) {
      els.lobbyError.textContent = response?.error ?? 'Nepodařilo se připojit.';
      return;
    }
    enterRoom(response.code, response.seat);
  });
});

els.roomCodeInput.addEventListener('input', () => {
  els.roomCodeInput.value = els.roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
});

els.roomCodeInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') els.joinRoom.click();
});

els.copyCode.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(roomCode);
    els.copyCode.textContent = 'Zkopírováno ✓';
    setTimeout(() => { els.copyCode.textContent = 'Kopírovat kód'; }, 1200);
  } catch {
    setMessage(`Kód místnosti: ${roomCode}`);
  }
});

els.toggleOptions.addEventListener('click', () => {
  const opening = els.optionsPanel.classList.contains('hidden');
  els.optionsPanel.classList.toggle('hidden');
  els.toggleOptions.textContent = opening ? 'Skrýt možnosti' : 'Zobrazit 101 možností';
  if (opening) {
    els.optionSearch.value = '';
    renderOptions();
  }
});

els.optionSearch.addEventListener('input', () => renderOptions(els.optionSearch.value));
els.moveInput.addEventListener('input', () => {
  selectOptionButton(exactGesture(els.moveInput.value));
  setMessage();
});
els.moveInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') els.lockMove.click();
});

els.randomChoice.addEventListener('click', () => {
  if (!gestures.length) return;
  const gesture = gestures[Math.floor(Math.random() * gestures.length)];
  els.moveInput.value = gesture;
  selectOptionButton(gesture);
  setMessage(`Náhoda vybrala: ${gesture}.`, 'success-text');
});

els.lockMove.addEventListener('click', () => {
  if (!roomCode || !currentState) return;
  const raw = els.moveInput.value;
  const exact = exactGesture(raw);

  if (!exact) {
    showSuggestion(raw, suggestionFor(raw));
    return;
  }

  socket.emit('submitMove', {
    roomCode,
    round: currentRound,
    move: exact
  }, (response) => {
    if (!response?.ok) {
      if (response?.suggestion) showSuggestion(raw, response.suggestion);
      else setMessage(response?.error ?? 'Volbu se nepodařilo odeslat.', 'error-text');
      return;
    }
    els.moveInput.value = response.move;
    setMessage(`🔒 ${response.move} je zamčený. Soupeř ho neuvidí.`, 'success-text');
  });
});

els.resetScore.addEventListener('click', () => {
  if (!roomCode) return;
  socket.emit('resetScore', { roomCode }, (response) => {
    if (!response?.ok) setMessage(response?.error ?? 'Reset se nepodařil.', 'error-text');
  });
});

els.leaveRoom.addEventListener('click', () => {
  socket.emit('leaveRoom', {}, () => resetToLobby('Opustil jsi místnost.'));
});
