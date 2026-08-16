'use strict';

const crypto = require('node:crypto');

const EMOJIS = Object.freeze({
  'Dynamite': '🧨', 'Tornado': '🌪️', 'Quicksand': '⏳', 'Pit': '🕳️', 'Chain': '⛓️',
  'Gun': '🔫', 'Law': '⚖️', 'Whip': '🥏', 'Sword': '🗡️', 'Rock': '🪨',
  'Death': '💀', 'Wall': '🧱', 'Sun': '☀️', 'Camera': '📷', 'Fire': '🔥',
  'Chainsaw': '🪚', 'School': '🏫', 'Scissors': '✂️', 'Poison': '☠️', 'Cage': '🪤',
  'Axe': '🪓', 'Peace': '☮️', 'Computer': '💻', 'Castle': '🏰', 'Snake': '🐍',
  'Blood': '🩸', 'Porcupine': '🦔', 'Vulture': '🦅', 'Monkey': '🐒', 'King': '🤴',
  'Queen': '👸', 'Prince': '🤴', 'Princess': '👸', 'Police': '👮', 'Woman': '👩',
  'Baby': '👶', 'Man': '👨', 'Home': '🏠', 'Train': '🚆', 'Car': '🚗',
  'Noise': '🔊', 'Bicycle': '🚲', 'Tree': '🌳', 'Turnip': '🥬', 'Duck': '🦆',
  'Wolf': '🐺', 'Cat': '🐱', 'Bird': '🐦', 'Fish': '🐟', 'Spider': '🕷️',
  'Cockroach': '🪳', 'Brain': '🧠', 'Community': '👥', 'Cross': '✝️', 'Money': '💰',
  'Vampire': '🧛', 'Sponge': '🧽', 'Church': '⛪', 'Butter': '🧈', 'Book': '📘',
  'Paper': '📄', 'Cloud': '☁️', 'Airplane': '✈️', 'Moon': '🌙', 'Grass': '🌿',
  'Film': '🎞️', 'Toilet': '🚽', 'Air': '💨', 'Planet': '🪐', 'Guitar': '🎸',
  'Bowl': '🥣', 'Cup': '☕', 'Beer': '🍺', 'Rain': '🌧️', 'Water': '💧',
  'TV': '📺', 'Rainbow': '🌈', 'UFO': '🛸', 'Alien': '👽', 'Prayer': '🙏',
  'Mountain': '⛰️', 'Satan': '😈', 'Dragon': '🐉', 'Diamond': '💎', 'Platinum': '🥈',
  'Gold': '🥇', 'Devil': '👹', 'Fence': '🚧', 'Video Game': '🎮', 'Math': '➗',
  'Robot': '🤖', 'Heart': '❤️', 'Electricity': '⚡', 'Lightning': '🌩️', 'Medusa': '🐍',
  'Power': '🔋', 'Laser': '🔴', 'Nuke': '☢️', 'Sky': '🌌', 'Tank': '🛡️', 'Helicopter': '🚁'
});


const TYPE_GROUPS = {
  force: new Set(['Dynamite', 'Tornado', 'Quicksand', 'Fire', 'Poison', 'Noise', 'Cloud', 'Air', 'Rain', 'Water', 'Rainbow', 'Prayer', 'Electricity', 'Lightning', 'Power', 'Laser', 'Nuke', 'Sky', 'Sun']),
  weapon: new Set(['Chain', 'Gun', 'Whip', 'Sword', 'Chainsaw', 'Scissors', 'Axe']),
  structure: new Set(['Pit', 'Wall', 'School', 'Cage', 'Castle', 'Home', 'Tree', 'Church', 'Toilet', 'Fence', 'Mountain']),
  machine: new Set(['Camera', 'Computer', 'Train', 'Car', 'Bicycle', 'Airplane', 'TV', 'UFO', 'Video Game', 'Robot', 'Tank', 'Helicopter']),
  creature: new Set(['Snake', 'Porcupine', 'Vulture', 'Monkey', 'Duck', 'Wolf', 'Cat', 'Bird', 'Fish', 'Spider', 'Cockroach', 'Vampire', 'Alien', 'Dragon', 'Medusa']),
  person: new Set(['King', 'Queen', 'Prince', 'Princess', 'Police', 'Woman', 'Baby', 'Man', 'Devil', 'Satan']),
  social: new Set(['Law', 'Peace', 'Community', 'Cross', 'Money', 'Book', 'Paper', 'Film', 'Math', 'Heart']),
  object: new Set(['Rock', 'Blood', 'Brain', 'Sponge', 'Butter', 'Moon', 'Grass', 'Planet', 'Guitar', 'Bowl', 'Cup', 'Beer', 'Diamond', 'Platinum', 'Gold'])
};

const SPECIALS = Object.freeze({
  'Airplane|Dragon': 'Drak se vrhl do dogfightu, ale Airplane přineslo vyšší rychlost, vyšší letovou hladinu a nulovou trpělivost pro fantasy pravidla.',
  'Beer|Math': 'Math chtěla přesná čísla. Beer nabídla čtvrté kolo a tím zcela zrušila akademický standard dokazování.',
  'Toilet|Satan': 'Satan dorazil s velkým proslovem o věčném zatracení. Toilet zareagovala jediným spláchnutím a ukončila debatu překvapivě hygienicky.',
  'Nuke|Baby': 'Baby měla potenciál do budoucna. Nuke měla velmi odlišný názor na existenci budoucnosti jako takové.',
  'Sponge|Vampire': 'Vampire čekal krev, drama a gotickou atmosféru. Sponge jen tiše absorbovala celou situaci i s egem soupeře.',
  'Police|Monkey': 'Monkey zkusila chaos, křik a výmluvy. Police vytáhla protokol, pouta a velmi unavený výraz člověka ve službě.',
  'Law|Devil': 'Devil chtěl loophole. Law si vzala brýle, otevřela složku a loophole mu administrativně zavřela před nosem.',
  'Camera|Princess': 'Princess byla připravená na portrét. Camera ale zachytila každý detail včetně paniky, jakmile přišla skutečná akce.',
  'Video Game|Math': 'Math chtěla čistou logiku. Video Game jí vysvětlila, že damage scaling, crit chance a patch notes logiku pouze předstírají.',
  'Robot|Heart': 'Heart přišlo s emocemi. Robot přišel s výpočtem, firmware updatem a neeticky efektivní optimalizací výsledku.',
  'Tank|Helicopter': 'Helicopter měla výšku, eleganci a manévrovatelnost. Tank měl nepříjemně přesvědčivý argument zvaný „země-vzduch problém“.',
  'Helicopter|Tank': 'Tank se tvářil nezastavitelně, dokud Helicopter nepřipomněla, že útok shora je starý, jednoduchý a dost osobní.',
  'Dragon|Air': 'Dragon je děsivý jen do chvíle, než se ukáže, že Air je přesně médium, ve kterém musí spoléhat na aerodynamiku.',
  'Satan|Prayer': 'Prayer nevyhrála silou. Vyhrála tím, že celé scéně vtiskla nepříjemně závaznou morální atmosféru.',
  'Money|Community': 'Community přišla společně. Money přišla sama, ale bohužel sponzorovala úplně všechny kolem.',
  'Gun|Sword': 'Sword chtěl čestný duel. Gun přinesla modernitu, vzdálenost a velmi nečestnou efektivitu.',
  'Rock|Scissors': 'Klasika nikdy nezklame: Scissors to zkusily s respektem k tradici a Rock je s respektem k tradici naprosto zničil.',
  'Paper|Rock': 'Rock se spoléhal na reputaci. Paper ho bez emocí zabalila, označila a administrativně vyřídila.',
  'Scissors|Paper': 'Paper měla teorii, plán i poznámky. Scissors měly mnohem kratší, ostřejší a přesvědčivější prezentaci.',
  'Cup|Beer': 'Beer už slavila. Cup jen tiše připomněl, že bez nádoby je i největší frajer jen lepkavý problém na stole.',
  'Church|Vampire': 'Vampire se dostavil v plné gotické náladě. Church ho přivítala zvony, architekturou a velmi nevstřícnou symbolikou.',
  'Computer|Community': 'Community chtěla lidské rozhodnutí. Computer vytáhl tabulku, algoritmus a tichou hrozbu absolutní optimalizace.',
  'Moon|Tornado': 'Tornado dělalo velký bordel. Moon zůstala chladná, vzdálená a nepříjemně mimo dosah veškerého počasí.',
  'Butter|Chainsaw': 'Chainsaw očekávala tvrdý materiál a heroický moment. Butter se místo toho změnila v nechutně jednoduchý pracovní úkol.',
  'Power|Robot': 'Robot běžel na perfektní logice. Power mu jen připomněla, kdo platí celý jeho operační systém.'
});

const FORCE_VERBS = ['rozmetá', 'převálcuje', 'smete', 'vymaže', 'zahltí'];
const WEAPON_VERBS = ['prosekne', 'rozstřílí', 'rozebere', 'umlčí', 'ukončí'];
const MACHINE_VERBS = ['přetlačí', 'přeskočí technologicky', 'přečíslí výkonem', 'rozloží efektivitou', 'zastíní hardwarem'];
const CREATURE_VERBS = ['přechytračí', 'roztrhá', 'uštve', 'převálcuje instinktem', 'uloví'];
const PERSON_VERBS = ['přesvědčí k porážce', 'zvládne s nepříjemným klidem', 'zruší autoritou', 'odepíše jedním rozhodnutím', 'přinutí kapitulovat'];
const STRUCTURE_VERBS = ['pohltí', 'zastaví', 'zadrží', 'přežije', 'uzemní'];
const SOCIAL_VERBS = ['přepíše pravidly', 'udusí argumentem', 'zneškodní významem', 'převálcuje symbolikou', 'překoná civilizačně'];
const OBJECT_VERBS = ['zostudí', 'překvapivě přehraje', 'znechutí', 'převrátí proti němu', 'dorazí absurdní praktičností'];

const OPENERS = [
  'Aréna na chvíli ztichla.',
  'Komentátoři tomu zpočátku nevěřili.',
  'Publikum čekalo chaos a dostalo něco mnohem horšího.',
  'Fyzika i zdravý rozum si vzaly krátkou dovolenou.',
  'Situace se zvrhla rychleji, než kdokoliv stačil napsat patch notes.'
];

const SECOND_BEATS = [
  'Soupeř zkusil plán B, ale ten byl stejně špatný jako plán A.',
  'Celé to působilo jako chyba v balancu, kterou by vývojáři měli nerfovat.',
  'Očití svědci se shodují, že to bylo zároveň logické i naprosto dementní.',
  'Nikdo přesně neví proč to fungovalo, ale výsledek je právně i emocionálně platný.',
  'Vědecká obec už oznámila, že se tímto duelem nebude zabývat.'
];

const CLOSERS = [
  'Výsledek byl brutálně jednoznačný.',
  'Soupeř po této lekci přehodnocuje celý build.',
  'Na replay se bude koukat ještě dlouho, hlavně z terapeutických důvodů.',
  'Historici tomu budou říkat „zbytečně osobní incident“.',
  'Fair? Možná ne. Zábavné? Naprosto.'
];

function hashInt(value) {
  const hex = crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 12);
  return Number.parseInt(hex, 16);
}

function pick(arr, seed, offset = 0) {
  return arr[(seed + offset) % arr.length];
}

function gestureType(gesture) {
  for (const [type, set] of Object.entries(TYPE_GROUPS)) {
    if (set.has(gesture)) return type;
  }
  return 'object';
}

function emojiFor(gesture) {
  return EMOJIS[gesture] ?? '🎲';
}

function verbFor(gesture, seed) {
  const type = gestureType(gesture);
  const bank = {
    force: FORCE_VERBS,
    weapon: WEAPON_VERBS,
    machine: MACHINE_VERBS,
    creature: CREATURE_VERBS,
    person: PERSON_VERBS,
    structure: STRUCTURE_VERBS,
    social: SOCIAL_VERBS,
    object: OBJECT_VERBS
  }[type] ?? OBJECT_VERBS;
  return pick(bank, seed);
}

function loserReaction(loser, seed) {
  const type = gestureType(loser);
  const reactions = {
    force: ['už nestačil změnit směr', 'zjistila, že čistá energie není plán', 'se rozplynula ve vlastním dramatu'],
    weapon: ['najednou působil podezřele zastarale', 'pochopil, že ostrost sama nestačí', 'skončil bez prostoru na druhý pokus'],
    machine: ['hardwarem nestačil ani psychicky', 'narazil na tvrdý skill issue', 'spolehlivě selhal v kritickém okamžiku'],
    creature: ['instinkt tentokrát opravdu nestačil', 'zjistil, že apex predator je velmi relativní pojem', 'odešel s poníženou evoluční linií'],
    person: ['to neustál ani rétoricky', 'prohrál důstojně jen v představách', 'přišel o autoritu i momentum'],
    structure: ['se ukázala být méně stabilní, než sliboval design', 'nepřežila test reality', 'nezvládla tlak situace ani symbolicky'],
    social: ['ztratil(a) debatu i důvod existovat', 'argumentoval(a) pozdě a slabě', 'tentokrát nenabídl(a) nic než trapné ticho'],
    object: ['dopadl(a) překvapivě neslavně', 'to prostě nezvládl(a) obhájit', 'byl(a) odeslán(a) do sběru bizarních porážek']
  };
  return pick(reactions[type] ?? reactions.object, seed, 1);
}

function titleFor(winner, loser, seed) {
  const templates = [
    `${emojiFor(winner)} ${winner} vítězí`,
    `${emojiFor(winner)} ${winner} má navrch`,
    `${emojiFor(winner)} ${winner} absolutně přehrává ${loser}`,
    `${emojiFor(winner)} ${winner} ukazuje třídu`,
    `${emojiFor(winner)} ${winner} bere kolo`
  ];
  return pick(templates, seed, 2);
}

function specialLine(winner, loser) {
  return SPECIALS[`${winner}|${loser}`] ?? null;
}

function tieDescription(a, b) {
  const seed = hashInt(`tie:${a}|${b}`);
  const open = pick(OPENERS, seed);
  const lines = [
    `${a} narazí na ${b} a svět na okamžik neví, jestli jde o duel, experiment nebo kolektivní halucinaci.`,
    `Obě strany zvolily ${a} a výsledkem je patová situace, která nepomáhá nikomu kromě diváků.`,
    `${a} se střetne se svou vlastní kopií a nikdo se nechce přiznat, kdo měl být ten agresivnější.`
  ];
  return {
    title: `${emojiFor(a)} Remíza`,
    headline: `${a} vs ${b}: remíza.`,
    description: `${open} ${pick(lines, seed, 1)} ${pick(CLOSERS, seed, 3)}`,
    winnerEmoji: emojiFor(a),
    loserEmoji: emojiFor(b)
  };
}

function battleFlavor(winner, loser) {
  const seed = hashInt(`${winner}|${loser}`);
  const open = pick(OPENERS, seed);
  const special = specialLine(winner, loser);
  const verb = verbFor(winner, seed);
  const reaction = loserReaction(loser, seed);
  const bridge = pick(SECOND_BEATS, seed, 1);
  const closer = pick(CLOSERS, seed, 2);

  const description = special ?? `${open} ${winner} ${verb} ${loser}; ${loser} ${reaction}. ${bridge} ${closer}`;

  return {
    title: titleFor(winner, loser, seed),
    headline: `${winner} ${verb} ${loser}.`,
    description,
    winnerEmoji: emojiFor(winner),
    loserEmoji: emojiFor(loser)
  };
}

module.exports = {
  emojiFor,
  battleFlavor,
  tieDescription
};
