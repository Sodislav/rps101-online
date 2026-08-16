'use strict';

const assert = require('node:assert/strict');
const { GESTURES, canonicalGesture, suggestGesture, outcome } = require('./lib/rules');

assert.equal(GESTURES.length, 101);
assert.equal(new Set(GESTURES).size, 101);
assert.equal(canonicalGesture(' dragon '), 'Dragon');
assert.equal(canonicalGesture('VIDEO-GAME'), 'Video Game');
assert.equal(canonicalGesture('hasufhiaofhaiosf'), null);
assert.equal(suggestGesture('dragdkon')?.gesture, 'Dragon');

// Gesture 1 beats the next 50, then loses to the following 50.
assert.equal(outcome('Dynamite', 'Tornado').winner, 1);
assert.equal(outcome('Dynamite', 'Cockroach').winner, 1);
assert.equal(outcome('Dynamite', 'Brain').winner, 2);
assert.equal(outcome('Dynamite', 'Helicopter').winner, 2);
assert.equal(outcome('Dragon', 'Diamond').winner, 1);
assert.equal(outcome('Dragon', 'Dynamite').winner, 1); // wrap-around check
assert.equal(outcome('Rock', 'Rock').winner, 0);

// Every gesture must beat exactly 50 and lose to exactly 50.
for (const a of GESTURES) {
  let wins = 0;
  let losses = 0;
  for (const b of GESTURES) {
    if (a === b) continue;
    const result = outcome(a, b);
    if (result.winner === 1) wins += 1;
    else losses += 1;
  }
  assert.equal(wins, 50, `${a} should have 50 wins`);
  assert.equal(losses, 50, `${a} should have 50 losses`);
}

console.log('All RPS-101 rule tests passed.');
