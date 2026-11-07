import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/game.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(
  source + '\nexport { makeGame, chooseBotTurnAction, botNatureIndexForTerrain };',
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText;
const exports = {};
runInNewContext(compiled, { exports, require: () => ({}) });
const { makeGame, chooseBotTurnAction, botNatureIndexForTerrain } = exports;

test('el bot tira el dado cuando todavía no tiene una acción territorial', () => {
  const game = { ...makeGame(() => 0.5, 2, false), current: 'red', roll: null };
  assert.equal(chooseBotTurnAction(game, 'red').kind, 'roll');
});

test('el bot entra al tablero en un terreno habilitado por el dado', () => {
  const base = makeGame(() => 0.5, 2, false);
  const roll = base.board[0][0];
  const game = { ...base, current: 'red', roll };
  const action = chooseBotTurnAction(game, 'red');
  assert.equal(action.kind, 'move');
  assert.equal(game.board[action.destination.row][action.destination.col], roll);
});

test('el bot prioriza alcanzar la Meta cuando el dado coincide', () => {
  const base = makeGame(() => 0.5, 2, false);
  const pieces = base.pieces.map(piece => piece.id === 'red-g1' ? { ...piece, status: 'board', position: { row: base.board.length - 1, col: 0 } } : piece);
  const game = { ...base, pieces, current: 'red', roll: base.goalTerrain };
  const action = chooseBotTurnAction(game, 'red');
  assert.equal(action.kind, 'goal');
  assert.equal(action.pieceId, 'red-g1');
});

test('un bot con un naipe fuerte desafía a un rival contiguo', () => {
  const base = makeGame(() => 0.5, 2, false);
  const pieces = base.pieces.map(piece => {
    if (piece.id === 'red-g1') return { ...piece, card: { id: 'valor-10-bot', rank: 10 }, status: 'board', position: { row: 0, col: 0 } };
    if (piece.id === 'blue-g1') return { ...piece, status: 'board', position: { row: 1, col: 0 } };
    return { ...piece, status: 'sacrificed', position: null };
  });
  const game = { ...base, pieces, current: 'red', roll: null, players: { ...base.players, red: { ...base.players.red, cards: [] } } };
  const action = chooseBotTurnAction(game, 'red');
  assert.equal(action.kind, 'challenge');
  assert.equal(action.pieceId, 'red-g1');
  assert.equal(`${action.target.row}-${action.target.col}`, '1-0');
});

test('la decisión de desafiar no consulta el naipe oculto del rival', () => {
  const base = makeGame(() => 0.5, 2, false);
  const makeScenario = rank => ({
    ...base,
    current: 'red',
    roll: null,
    players: { ...base.players, red: { ...base.players.red, cards: [] } },
    pieces: base.pieces.map(piece => {
      if (piece.id === 'red-g1') return { ...piece, card: { id: 'valor-10-bot', rank: 10 }, status: 'board', position: { row: 0, col: 0 } };
      if (piece.id === 'blue-g1') return { ...piece, card: { id: `valor-${rank}-oculta`, rank }, status: 'board', position: { row: 1, col: 0 } };
      return { ...piece, status: 'sacrificed', position: null };
    }),
  });
  assert.equal(JSON.stringify(chooseBotTurnAction(makeScenario(1), 'red')), JSON.stringify(chooseBotTurnAction(makeScenario(12), 'red')));
});

test('el bot compromete naturaleza sólo cuando coincide con su terreno', () => {
  const base = makeGame(() => 0.5, 2, false);
  const piece = { ...base.pieces.find(value => value.id === 'red-g1'), card: { id: 'valor-7-bot', rank: 7 }, status: 'board', position: { row: 0, col: 0 } };
  const terrain = base.board[0][0];
  const players = { ...base.players, red: { ...base.players.red, cards: [terrain, terrain === 'pampa' ? 'monte' : 'pampa'] } };
  const game = { ...base, players };
  assert.equal(botNatureIndexForTerrain(game, piece, piece.position), 0);
  assert.equal(botNatureIndexForTerrain({ ...game, players: { ...players, red: { ...players.red, cards: ['boleadora'] } } }, piece, piece.position), null);
});
