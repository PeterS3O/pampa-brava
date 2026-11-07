import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/game.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(
  source + '\nexport { resolveRefusalPositions, resolveRetreatPositions, availableRetreatPaths, isForcedCampRetreat, duelNeighbors, attackTargetsForPiece };',
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText;
const exports = {};
runInNewContext(compiled, { exports, require: () => ({}) });
const { resolveRefusalPositions, resolveRetreatPositions, availableRetreatPaths, isForcedCampRetreat, duelNeighbors, attackTargetsForPiece } = exports;

const attackerId = 'blue-g1';
const defenderId = 'red-g1';
const from = { row: 2, col: 2 };
const target = { row: 3, col: 2 };
const destination = { row: 2, col: 3 };
const game = {
  current: 'blue',
  pieces: [
    { id: attackerId, owner: 'blue', status: 'board', position: from },
    { id: defenderId, owner: 'red', status: 'board', position: target },
  ],
};
const duel = { attackerId, defenderId, from, target, phase: 'defender' };
const piece = (state, id) => state.pieces.find(value => value.id === id);

test('si el defensor rechaza, ambos gauchos intercambian posiciones', () => {
  const resolved = resolveRefusalPositions(game, duel);
  assert.ok(resolved);
  assert.equal(piece(resolved, attackerId).position.row, target.row);
  assert.equal(piece(resolved, attackerId).position.col, target.col);
  assert.equal(piece(resolved, defenderId).position.row, from.row);
  assert.equal(piece(resolved, defenderId).position.col, from.col);
  assert.equal(piece(game, attackerId).position.row, from.row);
});

test('si el defensor rechaza una entrada desde el campamento, vuelve al campamento', () => {
  const entryTarget = { row: 0, col: 2 };
  const entryGame = {
    current: 'blue',
    pieces: [
      { id: attackerId, owner: 'blue', status: 'camp', position: null },
      { id: defenderId, owner: 'red', status: 'board', position: entryTarget },
    ],
  };
  const entryDuel = { attackerId, defenderId, from: null, target: entryTarget, phase: 'defender' };
  const resolved = resolveRefusalPositions(entryGame, entryDuel);
  assert.ok(resolved);
  assert.equal(piece(resolved, attackerId).status, 'board');
  assert.equal(piece(resolved, attackerId).position.row, 0);
  assert.equal(piece(resolved, defenderId).status, 'camp');
  assert.equal(piece(resolved, defenderId).position, null);
});

test('rechazar un redoble ya no usa la retirada antigua de una fila', () => {
  const retreat = { pieceId: attackerId, attackerId, resolution: 'refusal' };
  const resolved = resolveRetreatPositions(game, { ...duel, phase: 'redouble-answer' }, retreat, { row: 0, col: 2 });
  assert.equal(resolved, null);
});

test('en un duelo aceptado sólo retrocede el perdedor', () => {
  for (const loserId of [attackerId, defenderId]) {
    const retreat = { pieceId: loserId, attackerId, resolution: 'duel', paths: [[destination]] };
    const resolved = resolveRetreatPositions(game, { ...duel, phase: 'outcome', outcome: { loserId } }, retreat, destination);
    assert.ok(resolved);
    assert.equal(piece(resolved, loserId).position.row, destination.row);
    assert.equal(piece(resolved, defenderId).position.row, loserId === defenderId ? destination.row : target.row);
    assert.equal(piece(resolved, attackerId).position.row, loserId === attackerId ? destination.row : target.row);
  }
});

test('el defensor derrotado puede retirarse por la casilla que deja libre el atacante', () => {
  const paths = availableRetreatPaths(target, 2, game.pieces.filter(value => value.id !== attackerId), defenderId);
  const pathThroughAttackerOrigin = paths.find(path => path[0]?.row === from.row && path[0]?.col === from.col);
  assert.ok(pathThroughAttackerOrigin);

  const destinationAfterCrossing = pathThroughAttackerOrigin.at(-1);
  const retreat = { pieceId: defenderId, attackerId, resolution: 'duel', paths: [pathThroughAttackerOrigin] };
  const outcomeDuel = { ...duel, phase: 'outcome', outcome: { loserId: defenderId } };
  const resolved = resolveRetreatPositions(game, outcomeDuel, retreat, destinationAfterCrossing);
  assert.ok(resolved);
  assert.equal(piece(resolved, attackerId).position.row, target.row);
  assert.equal(piece(resolved, attackerId).position.col, target.col);
  assert.equal(piece(resolved, defenderId).position.row, destinationAfterCrossing.row);
  assert.equal(piece(resolved, defenderId).position.col, destinationAfterCrossing.col);
});

test('cada paso de retirada baja una fila y nunca es horizontal', () => {
  const paths = availableRetreatPaths({ row: 5, col: 1 }, 3, [], defenderId);
  assert.ok(paths.length > 0);
  for (const path of paths) {
    let previous = { row: 5, col: 1 };
    for (const cell of path) {
      if (!cell) continue;
      assert.equal(cell.row, previous.row - 1);
      previous = cell;
    }
  }
});

test('la retirada nunca puede dejar al perdedor en la misma casilla', () => {
  const retreat = { pieceId: defenderId, attackerId, resolution: 'duel', paths: [[target], [destination]] };
  const resolved = resolveRetreatPositions(game, { ...duel, phase: 'outcome', outcome: { loserId: defenderId } }, retreat, target);
  assert.equal(resolved, null);
});

test('la retirada sólo acepta destinos ofrecidos y desocupados', () => {
  const retreat = { pieceId: defenderId, attackerId, resolution: 'duel', paths: [[destination]] };
  const outcomeDuel = { ...duel, phase: 'outcome', outcome: { loserId: defenderId } };
  assert.equal(resolveRetreatPositions(game, outcomeDuel, retreat, { row: 0, col: 0 }), null);

  const occupiedGame = { ...game, pieces: [...game.pieces, { id: 'blue-g2', owner: 'blue', status: 'board', position: destination }] };
  assert.equal(resolveRetreatPositions(occupiedGame, outcomeDuel, retreat, destination), null);
});

test('si debe retroceder dos desde la fila 2, vuelve al campamento sin trabar el duelo', () => {
  const lowFrom = { row: 0, col: 1 };
  const lowTarget = { row: 1, col: 1 };
  const lowGame = {
    current: 'blue',
    pieces: [
      { id: attackerId, owner: 'blue', status: 'board', position: lowFrom },
      { id: defenderId, owner: 'red', status: 'board', position: lowTarget },
    ],
  };
  const paths = availableRetreatPaths(lowTarget, 2, lowGame.pieces, defenderId);
  assert.ok(isForcedCampRetreat(paths));

  const lowDuel = { attackerId, defenderId, from: lowFrom, target: lowTarget, phase: 'outcome', outcome: { loserId: defenderId } };
  const retreat = { pieceId: defenderId, attackerId, resolution: 'duel', paths };
  const resolved = resolveRetreatPositions(lowGame, lowDuel, retreat, null);
  assert.ok(resolved);
  assert.equal(piece(resolved, defenderId).status, 'camp');
  assert.equal(piece(resolved, defenderId).position, null);
  assert.equal(piece(resolved, attackerId).position.row, lowTarget.row);
  assert.equal(piece(resolved, attackerId).position.col, lowTarget.col);
});

test('un intercambio por rechazo con los roles invertidos se rechaza', () => {
  assert.equal(resolveRefusalPositions({ ...game, current: 'red' }, duel), null);
  assert.equal(resolveRefusalPositions(game, { ...duel, attackerId: defenderId, defenderId: attackerId }), null);
});

test('un gaucho no puede desafiar hacia una fila anterior', () => {
  const board = Array.from({ length: 7 }, (_, row) => Array.from({ length: 8 - row }, () => 'pampa'));
  const origin = { row: 3, col: 2 };
  const targets = duelNeighbors(origin, board);
  assert.ok(targets.length > 0);
  assert.ok(targets.every(target => target.row >= origin.row));
  assert.ok(targets.some(target => target.row === origin.row));
  assert.ok(targets.some(target => target.row === origin.row + 1));
});

test('desde el campamento puede desafiar cualquier rival de la primera fila', () => {
  const board = Array.from({ length: 7 }, (_, row) => Array.from({ length: 8 - row }, () => 'pampa'));
  const attacker = { id: attackerId, owner: 'blue', status: 'camp', position: null };
  const rivals = [
    { id: 'red-g2', owner: 'red', status: 'board', position: { row: 0, col: 1 } },
    { id: 'red-g3', owner: 'red', status: 'board', position: { row: 0, col: 6 } },
    { id: 'red-g4', owner: 'red', status: 'board', position: { row: 1, col: 1 } },
  ];
  const targets = attackTargetsForPiece(attacker, [attacker, ...rivals], board);
  assert.deepEqual(targets.map(target => `${target.row}-${target.col}`), ['0-1', '0-6']);
});

test('las rutas de retirada sólo bajan, nunca van hacia un costado', () => {
  for (let row = 1; row < 7; row += 1) {
    for (let col = 0; col < 8 - row; col += 1) {
      for (const steps of [2, 3, 4]) {
        for (const path of availableRetreatPaths({ row, col }, steps, [], 'x')) {
          let prev = { row, col };
          for (const cell of path) {
            if (!cell) break;
            assert.equal(cell.row, prev.row - 1, 'cada paso baja exactamente una fila');
            assert.ok(cell.col === prev.col || cell.col === prev.col + 1, 'sólo los dos casilleros de abajo');
            prev = cell;
          }
        }
      }
    }
  }
});

test('una casilla lateral o no iluminada es rechazada y no modifica la partida', () => {
  const loserId = defenderId;
  const paths = availableRetreatPaths(target, 2, game.pieces.filter(value => value.id !== attackerId), loserId);
  const retreat = { pieceId: loserId, attackerId, resolution: 'duel', paths };
  const outcomeDuel = { ...duel, phase: 'outcome', outcome: { loserId } };
  for (const lateral of [{ row: 3, col: 1 }, { row: 3, col: 3 }, { row: 2, col: 2 }, { row: 1, col: 0 }]) {
    assert.equal(resolveRetreatPositions(game, outcomeDuel, retreat, lateral), null);
  }
  assert.equal(piece(game, loserId).position.row, target.row);
});

test('no se puede retirar a una casilla ocupada aunque haya estado iluminada', () => {
  const blocker = { id: 'blue-g2', owner: 'blue', status: 'board', position: { row: 1, col: 2 } };
  const crowded = { ...game, pieces: [...game.pieces, blocker] };
  const retreat = { pieceId: defenderId, attackerId, resolution: 'duel', paths: [[{ row: 2, col: 2 }, { row: 1, col: 2 }]] };
  assert.equal(resolveRetreatPositions(crowded, { ...duel, phase: 'outcome', outcome: { loserId: defenderId } }, retreat, { row: 1, col: 2 }), null);
});

test('si la retirada supera la primera fila, el perdedor vuelve al campamento', () => {
  const paths = availableRetreatPaths({ row: 1, col: 2 }, 2, [], defenderId);
  assert.ok(isForcedCampRetreat(paths));
  const blockedAll = availableRetreatPaths({ row: 3, col: 0 }, 1, [
    { id: 'b1', owner: 'blue', status: 'board', position: { row: 2, col: 0 } },
    { id: 'b2', owner: 'blue', status: 'board', position: { row: 2, col: 1 } },
  ], 'red-g1');
  assert.ok(isForcedCampRetreat(blockedAll));
});
