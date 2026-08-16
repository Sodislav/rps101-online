'use strict';

// Canonical RPS-101 order by David C. Lovelace.
// In this circular ordering every gesture beats the following 50 gestures
// and loses to the previous 50 gestures.
const GESTURES = Object.freeze([
  'Dynamite', 'Tornado', 'Quicksand', 'Pit', 'Chain', 'Gun', 'Law', 'Whip',
  'Sword', 'Rock', 'Death', 'Wall', 'Sun', 'Camera', 'Fire', 'Chainsaw',
  'School', 'Scissors', 'Poison', 'Cage', 'Axe', 'Peace', 'Computer',
  'Castle', 'Snake', 'Blood', 'Porcupine', 'Vulture', 'Monkey', 'King',
  'Queen', 'Prince', 'Princess', 'Police', 'Woman', 'Baby', 'Man', 'Home',
  'Train', 'Car', 'Noise', 'Bicycle', 'Tree', 'Turnip', 'Duck', 'Wolf',
  'Cat', 'Bird', 'Fish', 'Spider', 'Cockroach', 'Brain', 'Community', 'Cross',
  'Money', 'Vampire', 'Sponge', 'Church', 'Butter', 'Book', 'Paper', 'Cloud',
  'Airplane', 'Moon', 'Grass', 'Film', 'Toilet', 'Air', 'Planet', 'Guitar',
  'Bowl', 'Cup', 'Beer', 'Rain', 'Water', 'TV', 'Rainbow', 'UFO', 'Alien',
  'Prayer', 'Mountain', 'Satan', 'Dragon', 'Diamond', 'Platinum', 'Gold',
  'Devil', 'Fence', 'Video Game', 'Math', 'Robot', 'Heart', 'Electricity',
  'Lightning', 'Medusa', 'Power', 'Laser', 'Nuke', 'Sky', 'Tank', 'Helicopter'
]);

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

const aliases = new Map([
  ['videogame', 'Video Game'],
  ['video game', 'Video Game'],
  ['tv', 'TV'],
  ['ufo', 'UFO']
]);

const normalizedGestureMap = new Map(
  GESTURES.map((gesture) => [normalize(gesture), gesture])
);

function canonicalGesture(value) {
  const normalized = normalize(value);
  if (!normalized) return null;
  return normalizedGestureMap.get(normalized) ?? aliases.get(normalized) ?? null;
}

function levenshtein(a, b) {
  a = normalize(a);
  b = normalize(b);
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  const current = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }
  return previous[b.length];
}

function maxSuggestionDistance(input) {
  const length = normalize(input).length;
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  if (length <= 8) return 2;
  return 3;
}

function suggestGesture(value) {
  const input = normalize(value);
  if (!input) return null;

  let best = null;
  let bestDistance = Infinity;
  let tied = false;

  for (const gesture of GESTURES) {
    const target = normalize(gesture);
    const distance = levenshtein(input, target);
    if (distance < bestDistance) {
      best = gesture;
      bestDistance = distance;
      tied = false;
    } else if (distance === bestDistance) {
      tied = true;
    }
  }

  if (tied || bestDistance > maxSuggestionDistance(input)) return null;
  return { gesture: best, distance: bestDistance };
}

function outcome(aValue, bValue) {
  const a = canonicalGesture(aValue);
  const b = canonicalGesture(bValue);

  if (!a || !b) {
    throw new Error('outcome() received a non-canonical gesture');
  }

  if (a === b) {
    return { winner: 0, loser: 0, a, b, text: `${a} vs ${b}: tie.` };
  }

  const aIndex = GESTURES.indexOf(a);
  const bIndex = GESTURES.indexOf(b);
  const forwardDistance = (bIndex - aIndex + GESTURES.length) % GESTURES.length;
  const aWins = forwardDistance >= 1 && forwardDistance <= 50;

  const winner = aWins ? 1 : 2;
  const winnerGesture = aWins ? a : b;
  const loserGesture = aWins ? b : a;

  return {
    winner,
    loser: winner === 1 ? 2 : 1,
    a,
    b,
    text: `${winnerGesture} beats ${loserGesture}.`
  };
}

module.exports = {
  GESTURES,
  normalize,
  canonicalGesture,
  suggestGesture,
  levenshtein,
  outcome
};
