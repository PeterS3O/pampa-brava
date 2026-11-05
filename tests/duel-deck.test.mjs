import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/game.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(
  source + '\nexport { makeDuelDeck, makeNatureDeck, takeNatureCard, replaceCardRefs, replacePlayedCards, boleadoraTargetsForPiece, resolveDuelCards, makeGame, canEnterByMovementDie, passTurn, completeActivation, resolveBoleadoraPositions, advanceDuelToReveal, makeRaiseRefusalOutcome, recordDuelStart, recordDuelResult, recordMovement };',
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText;
const exports = {};
runInNewContext(compiled, { exports, require: () => ({}) });
const { makeDuelDeck, makeNatureDeck, takeNatureCard, replaceCardRefs, replacePlayedCards, boleadoraTargetsForPiece, resolveDuelCards, makeGame, canEnterByMovementDie, passTurn, completeActivation, resolveBoleadoraPositions, advanceDuelToReveal, makeRaiseRefusalOutcome, recordDuelStart, recordDuelResult, recordMovement } = exports;

test('la baraja propia contiene cuatro cartas de cada valor del 1 al 12', () => {
  const deck = makeDuelDeck(() => 0.5);
  assert.equal(deck.length, 48);
  assert.equal(new Set(deck.map(card => card.id)).size, 48);
  for (let rank = 1; rank <= 12; rank += 1) {
    assert.equal(deck.filter(card => card.rank === rank).length, 4);
  }
});

test('la baraja de naturaleza prioriza los terrenos y conserva tres copias de cada especial', () => {
  const deck = makeNatureDeck(() => 0.5);
  assert.equal(deck.length, 30);
  assert.equal(deck.filter(card => card === 'pampa').length, 8);
  assert.equal(deck.filter(card => card === 'monte').length, 8);
  assert.equal(deck.filter(card => card === 'sierra').length, 8);
  assert.equal(deck.filter(card => card === 'cabalgata').length, 3);
  assert.equal(deck.filter(card => card === 'boleadora').length, 3);
});

test('el sacrificio sólo puede tomar una naturaleza que siga en la baraja', () => {
  const deck = ['pampa', 'boleadora'];
  const afterTaking = takeNatureCard(deck, 'boleadora');
  assert.deepEqual(Array.from(afterTaking), ['pampa']);
  assert.equal(takeNatureCard(afterTaking, 'boleadora'), null);
});

test('el duelo compara el valor: 12 vence a 1', () => {
  const result = resolveDuelCards(
    { id: 'a', card: { id: 'valor-12-1', rank: 12 } },
    { id: 'd', card: { id: 'valor-1-1', rank: 1 } },
    null,
    'pampa',
    false,
  );
  assert.equal(result.winner, 'attacker');
  assert.equal(result.attackerOrder, 12);
  assert.equal(result.defenderOrder, 1);
});

test('la carta de naturaleza potencia hasta 12 y nunca lo supera', () => {
  const result = resolveDuelCards(
    { id: 'a', card: { id: 'valor-11-1', rank: 11 } },
    { id: 'd', card: { id: 'valor-12-1', rank: 12 } },
    'monte',
    'monte',
    false,
  );
  assert.equal(result.natureBoost, 1);
  assert.equal(result.attackerOrder, 12);
  assert.equal(result.winner, 'tie');
});

test('en duelo a muerte el defensor también puede potenciar su carta con naturaleza', () => {
  const result = resolveDuelCards(
    { id: 'a', card: { id: 'valor-10-1', rank: 10 } },
    { id: 'd', card: { id: 'valor-9-1', rank: 9 } },
    null,
    'pampa',
    true,
    'monte',
    'monte',
  );
  assert.equal(result.defenderNatureBoost, 3);
  assert.equal(result.defenderOrder, 12);
  assert.equal(result.winner, 'defender');
  assert.equal(result.retreatSteps, 4);
});

test('los equipos mantienen una identidad visual coherente', () => {
  const game = makeGame(() => 0.5);
  assert.ok(game.pieces.filter(piece => piece.owner === 'blue').every(piece => piece.type === 'faconero'));
  assert.ok(game.pieces.filter(piece => piece.owner === 'red').every(piece => piece.type === 'payador'));
});

test('una partida de tres equipos reparte cuatro gauchos y una naturaleza a cada bando', () => {
  const game = makeGame(() => 0.5, 3);
  assert.equal(game.teams.join(','), 'blue,red,green');
  assert.equal(game.pieces.filter(piece => piece.owner === 'green').length, 4);
  assert.equal(game.pieces.length, 12);
  assert.equal(game.players.blue.cards.length, 1);
  assert.equal(game.players.red.cards.length, 1);
  assert.equal(game.players.green.cards.length, 1);
});

test('en tres jugadores el turno rota Azul, Rojo, Verde', () => {
  const game = makeGame(() => 0.5, 3);
  const red = passTurn({ ...game, current: 'blue' }, 'Fin del turno.');
  const green = passTurn(red, 'Fin del turno.');
  const blue = passTurn(green, 'Fin del turno.');
  assert.equal(red.current, 'red');
  assert.equal(green.current, 'green');
  assert.equal(blue.current, 'blue');
});

test('una partida de cuatro jugadores reparte dos cartas secretas por gaucho', () => {
  const game = makeGame(() => 0.5, 4);
  assert.equal(game.playerCount, 4);
  assert.equal(game.teams.join(','), 'blue,red');
  assert.equal(game.pieces.length, 8);
  assert.equal(game.trucoDeck.length, 32);
  assert.equal(game.currentSeat, 'c');
  assert.ok(game.pieces.filter(piece => piece.owner === 'blue').every(piece => piece.teamCards.a && piece.teamCards.c));
  assert.ok(game.pieces.filter(piece => piece.owner === 'red').every(piece => piece.teamCards.b && piece.teamCards.d));
  assert.ok(game.pieces.every(piece => piece.card === null));
});

test('en cuatro jugadores el turno rota A, B, C, D y vuelve a A', () => {
  const game = { ...makeGame(() => 0.5, 4), currentSeat: 'a', current: 'blue' };
  const b = passTurn(game, 'Fin del turno.');
  const c = passTurn(b, 'Fin del turno.');
  const d = passTurn(c, 'Fin del turno.');
  const a = passTurn(d, 'Fin del turno.');
  assert.deepEqual([b.currentSeat, c.currentSeat, d.currentSeat, a.currentSeat], ['b', 'c', 'd', 'a']);
  assert.deepEqual([b.current, c.current, d.current, a.current], ['red', 'blue', 'red', 'blue']);
});

test('un gaucho activado por A sigue ocupado para C hasta la próxima ronda azul', () => {
  const game = { ...makeGame(() => 0.5, 4), currentSeat: 'a', current: 'blue', activations: [] };
  const afterA = completeActivation(game, 'blue-g1');
  const b = passTurn(afterA, 'Fin del turno.');
  const c = passTurn(b, 'Fin del turno.');
  assert.deepEqual(Array.from(c.teamRoundActivations.blue), ['blue-g1']);
  const d = passTurn(c, 'Fin del turno.');
  const nextA = passTurn(d, 'Fin del turno.');
  assert.deepEqual(Array.from(nextA.teamRoundActivations.blue), []);
});

test('el mismo gaucho puede consumir las dos activaciones de un turno', () => {
  const game = { ...makeGame(() => 0.5, 4), currentSeat: 'a', current: 'blue', activations: [], teamRoundActivations: {} };
  const afterFirst = completeActivation(game, 'blue-g1');
  assert.deepEqual(Array.from(afterFirst.activations), ['blue-g1']);
  const afterSecond = completeActivation(afterFirst, 'blue-g1');
  assert.equal(afterSecond.currentSeat, 'b');
  assert.deepEqual(Array.from(afterSecond.activations), []);
  assert.deepEqual(Array.from(afterSecond.teamRoundActivations.blue), ['blue-g1']);
});

test('el reloj inicial de cada turno dura 45 segundos', () => {
  const before = Date.now();
  const game = makeGame(() => 0.5, 2);
  const duration = game.turnEndsAt - before;
  assert.ok(duration >= 44_900 && duration <= 45_100);
});

test('las estadísticas registran duelos, resultado y desplazamiento por gaucho', () => {
  const game = makeGame(() => 0.5, 2);
  const attackerId = 'blue-g1', defenderId = 'red-g1';
  const challenged = recordDuelStart(game, attackerId, defenderId);
  const resolved = recordDuelResult(challenged, attackerId, defenderId);
  const moved = recordMovement(resolved, attackerId, 2);
  assert.equal(moved.stats.duels, 1);
  assert.deepEqual(
    { ...moved.stats.pieces[attackerId] },
    { duels: 1, wins: 1, losses: 0, distance: 2 },
  );
  assert.deepEqual(
    { ...moved.stats.pieces[defenderId] },
    { duels: 1, wins: 0, losses: 1, distance: 0 },
  );
});

test('una partida nueva inicializa nombres y estadísticas compartidas', () => {
  const game = makeGame(() => 0.5, 3);
  assert.deepEqual({ ...game.participantNames }, {});
  assert.equal(game.endedAt, null);
  assert.equal(Object.keys(game.stats.pieces).length, game.pieces.length);
});

test('sólo se renueva la carta revelada del participante indicado', () => {
  const game = makeGame(() => 0.5, 4);
  const piece = game.pieces.find(candidate => candidate.id === 'blue-g1');
  const cardA = piece.teamCards.a;
  const cardC = piece.teamCards.c;
  const refreshed = replaceCardRefs(game, [{ pieceId: piece.id, seat: 'a' }], () => 0.5);
  const updated = refreshed.pieces.find(candidate => candidate.id === piece.id);
  assert.notEqual(updated.teamCards.a.id, cardA.id);
  assert.equal(updated.teamCards.c.id, cardC.id);
  assert.equal(updated.teamCardVersions.a, 2);
  assert.equal(updated.teamCardVersions.c, 1);
});

test('aceptar un nivel revela primero al atacante y deja oculta la defensa', () => {
  const duel = { stake: 'normal', death: false, attackerRevealed: false, phase: 'redouble-answer' };
  const advanced = advanceDuelToReveal(duel, 'redouble');
  assert.equal(advanced.stake, 'redouble');
  assert.equal(advanced.phase, 'defender-reveal');
  assert.equal(advanced.attackerRevealed, true);
  assert.equal(advanced.death, false);
});

test('rechazar el redoble hace perder el duelo normal y sólo renueva la carta ya revelada', () => {
  const game = makeGame(() => 0.5, 2);
  const duel = { attackerId: 'blue-g1', defenderId: 'red-g1', attackerRevealed: true };
  const outcome = makeRaiseRefusalOutcome(game, duel, 'attacker', 'normal', 'redouble');
  assert.equal(outcome.loserId, 'blue-g1');
  assert.equal(outcome.winner, 'defender');
  assert.equal(outcome.stake, 'normal');
  assert.equal(outcome.retreat, 2);
  assert.deepEqual(Array.from(outcome.replacementIds), ['blue-g1']);
});

test('rechazar la muerte hace perder el redoble y conserva toda carta que siga oculta', () => {
  const game = makeGame(() => 0.5, 2);
  const duel = { attackerId: 'blue-g1', defenderId: 'red-g1', attackerRevealed: false };
  const outcome = makeRaiseRefusalOutcome(game, duel, 'defender', 'redouble', 'death');
  assert.equal(outcome.loserId, 'red-g1');
  assert.equal(outcome.winner, 'attacker');
  assert.equal(outcome.stake, 'redouble');
  assert.equal(outcome.retreat, 3);
  assert.deepEqual(Array.from(outcome.replacementIds), []);
});

test('una derrota a muerte limita a una sola acción el próximo turno del equipo vencido', () => {
  const game = makeGame(() => 0.5, 2);
  const resolved = completeActivation({ ...game, current: 'blue', limitedTurn: 'blue', activations: [] }, 'blue-g1');
  assert.equal(resolved.current, 'red');
  assert.equal(resolved.limitedTurn, null);
});

test('la Pulpería aparece una vez en la franja media y se puede entrar sin coincidir con el dado', () => {
  const game = makeGame(() => 0.5);
  const pulperias = game.board.flatMap((row, rowIndex) => row.map((terrain, colIndex) => terrain === 'pulperia' ? { row: rowIndex, col: colIndex } : null).filter(Boolean));
  assert.equal(pulperias.length, 1);
  assert.ok(pulperias[0].row >= 2 && pulperias[0].row <= 4);
  assert.equal(canEnterByMovementDie(pulperias[0], game.board, 'pampa'), true);
  const regularCell = game.board.flatMap((row, rowIndex) => row.map((terrain, colIndex) => terrain === 'sierra' ? { row: rowIndex, col: colIndex } : null).filter(Boolean))[0];
  assert.equal(canEnterByMovementDie(regularCell, game.board, 'pampa'), false);
});

test('la Pulpería puede desactivarse al crear la partida', () => {
  const game = makeGame(() => 0.5, 2, false);
  assert.equal(game.pulperiaEnabled, false);
  assert.equal(game.board.flat().filter(terrain => terrain === 'pulperia').length, 0);
});

test('la boleadora desplaza al ganador hacia adelante y al perdedor hacia atrás', () => {
  const board = Array.from({ length: 7 }, (_, row) => Array.from({ length: 8 - row }, () => 'pampa'));
  const game = {
    board,
    pieces: [
      { id: 'blue-g1', owner: 'blue', status: 'board', position: { row: 1, col: 2 } },
      { id: 'red-g1', owner: 'red', status: 'board', position: { row: 4, col: 1 } },
    ],
  };
  const duel = { attackerId: 'blue-g1', defenderId: 'red-g1' };
  const moved = resolveBoleadoraPositions(game, duel, 'attacker', 2);
  const attacker = moved.pieces.find(piece => piece.id === 'blue-g1');
  const defender = moved.pieces.find(piece => piece.id === 'red-g1');
  assert.equal(attacker.position.row, 3);
  assert.equal(defender.position.row, 2);
});

test('al agotarse el mazo de duelo, mezcla los descartes y vuelve a repartir', () => {
  const game = {
    log: [],
    trucoDeck: [{ id: 'valor-8-1', rank: 8 }],
    trucoDiscard: [{ id: 'valor-1-1', rank: 1 }],
    pieces: [
      { id: 'a', card: { id: 'valor-2-1', rank: 2 }, cardVersion: 1, revealed: true },
      { id: 'd', card: { id: 'valor-3-1', rank: 3 }, cardVersion: 1, revealed: true },
    ],
  };
  const refreshed = replacePlayedCards(game, ['a', 'd'], () => 0.5);
  assert.equal(refreshed.trucoDiscard.length, 0);
  assert.equal(refreshed.trucoDeck.length, 2);
  assert.ok(refreshed.pieces.every(piece => piece.card));
  assert.ok(refreshed.log[0].includes('Se agotó la baraja'));
});

test('la boleadora habilita un desafío contra cualquier rival del tablero', () => {
  const attacker = { id: 'blue-g1', owner: 'blue', status: 'camp', position: null };
  const targets = boleadoraTargetsForPiece(attacker, [
    attacker,
    { id: 'red-g1', owner: 'red', status: 'board', position: { row: 0, col: 4 } },
    { id: 'red-g2', owner: 'red', status: 'board', position: { row: 6, col: 0 } },
    { id: 'blue-g2', owner: 'blue', status: 'board', position: { row: 1, col: 1 } },
  ]);
  assert.deepEqual(targets, [{ row: 0, col: 4 }, { row: 6, col: 0 }]);
});
