import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/game.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(
  source + '\nexport { resolveRetreatPositions };',
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText;
const exports = {};
runInNewContext(compiled, { exports, require: () => ({}) });
const { resolveRetreatPositions } = exports;

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

test('si el defensor rechaza, él retrocede y el atacante ocupa la casilla disputada', () => {
  const retreat = { pieceId: defenderId, attackerId, resolution: 'refusal' };
  const resolved = resolveRetreatPositions(game, duel, retreat, destination);
  assert.ok(resolved);
  assert.equal(piece(resolved, attackerId).position.row, target.row);
  assert.equal(piece(resolved, attackerId).position.col, target.col);
  assert.equal(piece(resolved, defenderId).position.row, destination.row);
  assert.equal(piece(resolved, defenderId).position.col, destination.col);
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
  const retreat = { pieceId: defenderId, attackerId, resolution: 'refusal' };
  const resolved = resolveRetreatPositions(entryGame, entryDuel, retreat, null);
  assert.ok(resolved);
  assert.equal(piece(resolved, attackerId).status, 'board');
  assert.equal(piece(resolved, attackerId).position.row, 0);
  assert.equal(piece(resolved, defenderId).status, 'camp');
  assert.equal(piece(resolved, defenderId).position, null);
});

test('si el atacante rechaza el duelo a muerte, sólo él retrocede', () => {
  const retreat = { pieceId: attackerId, attackerId, resolution: 'refusal' };
  const resolved = resolveRetreatPositions(game, { ...duel, phase: 'death-answer' }, retreat, { row: 0, col: 2 });
  assert.ok(resolved);
  assert.equal(piece(resolved, attackerId).position.row, 0);
  assert.equal(piece(resolved, defenderId).position.row, target.row);
  assert.equal(piece(resolved, defenderId).position.col, target.col);
});

test('en un duelo aceptado sólo retrocede el perdedor', () => {
  for (const loserId of [attackerId, defenderId]) {
    const retreat = { pieceId: loserId, attackerId, resolution: 'duel' };
    const resolved = resolveRetreatPositions(game, { ...duel, phase: 'outcome', outcome: { loserId } }, retreat, destination);
    assert.ok(resolved);
    assert.equal(piece(resolved, loserId).position.row, destination.row);
    assert.equal(piece(resolved, defenderId).position.row, loserId === defenderId ? destination.row : target.row);
    assert.equal(piece(resolved, attackerId).position.row, loserId === attackerId ? destination.row : target.row);
  }
});

test('una retirada con los roles invertidos se rechaza', () => {
  const wrongRetreat = { pieceId: attackerId, attackerId, resolution: 'refusal' };
  assert.equal(resolveRetreatPositions(game, duel, wrongRetreat, destination), null);
  const defenderRetreat = { pieceId: defenderId, attackerId, resolution: 'refusal' };
  assert.equal(resolveRetreatPositions({ ...game, current: 'red' }, duel, defenderRetreat, destination), null);
  assert.equal(resolveRetreatPositions(game, { ...duel, attackerId: defenderId, defenderId: attackerId }, defenderRetreat, destination), null);
});
