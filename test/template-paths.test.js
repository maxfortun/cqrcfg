import { test } from 'node:test';
import assert from 'node:assert/strict';
import { templateCandidates } from '../ui/src/templatePaths.js';

test('nearest first, own path then ancestors to root', () => {
  assert.deepEqual(templateCandidates('/config/a/b'), [
    '/config/a/b/___template',
    '/config/a/___template',
    '/config/___template',
  ]);
});

test('root-level path', () => {
  assert.deepEqual(templateCandidates('/config/a'), ['/config/a/___template', '/config/___template']);
});

test('ignores trailing and duplicate slashes', () => {
  assert.deepEqual(templateCandidates('/config//a/'), ['/config/a/___template', '/config/___template']);
});
