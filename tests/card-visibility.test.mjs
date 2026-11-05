import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/game.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(
  source + '\nexport { isTrucoCardVisible };',
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText;
const exports = {};
runInNewContext(compiled, { exports, require: () => ({}) });
const { isTrucoCardVisible } = exports;

test('el naipe del rival sigue oculto aun cuando le toca jugar', () => {
  const rival = { owner: 'red', revealed: false };
  assert.equal(isTrucoCardVisible(rival, 'blue'), false);
  assert.equal(isTrucoCardVisible({ ...rival, owner: 'blue' }, 'blue'), true);
});

test('un naipe que fue revelado en un duelo no vuelve a mostrarse en el tablero rival', () => {
  const rival = { owner: 'red', revealed: true };
  assert.equal(isTrucoCardVisible(rival, 'blue'), false);
  assert.equal(isTrucoCardVisible(rival, 'red'), true);
});
