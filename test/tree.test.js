import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildTree, deepMerge } from '../src/utils/tree.js';

describe('buildTree', () => {
  it('should build tree from flat documents', () => {
    const docs = [
      { path: '/config/app1/db', data: { host: 'localhost', port: 5432 } },
      { path: '/config/app1/cache', data: { host: 'redis.local', port: 6379 } },
    ];

    const tree = buildTree(docs, '/config/app1');

    assert.deepStrictEqual(tree, {
      db: { host: 'localhost', port: 5432 },
      cache: { host: 'redis.local', port: 6379 },
    });
  });

  it('should handle deeply nested paths', () => {
    const docs = [
      { path: '/config/app1/services/api/db', data: { host: 'localhost' } },
      { path: '/config/app1/services/api/cache', data: { ttl: 3600 } },
      { path: '/config/app1/services/worker/queue', data: { name: 'jobs' } },
    ];

    const tree = buildTree(docs, '/config/app1');

    assert.deepStrictEqual(tree, {
      services: {
        api: {
          db: { host: 'localhost' },
          cache: { ttl: 3600 },
        },
        worker: {
          queue: { name: 'jobs' },
        },
      },
    });
  });

  it('should return data directly for exact path match', () => {
    const docs = [
      { path: '/config/app1/db', data: { host: 'localhost', port: 5432 } },
    ];

    const tree = buildTree(docs, '/config/app1/db');

    assert.deepStrictEqual(tree, { host: 'localhost', port: 5432 });
  });

  it('should handle single document', () => {
    const docs = [
      { path: '/config/app1', data: { name: 'My App', version: '1.0' } },
    ];

    const tree = buildTree(docs, '/config/app1');

    assert.deepStrictEqual(tree, { name: 'My App', version: '1.0' });
  });

  it('should return empty object for empty docs', () => {
    const tree = buildTree([], '/config/app1');
    assert.deepStrictEqual(tree, {});
  });

  it('should merge parent and child data', () => {
    const docs = [
      { path: '/config/app1', data: { name: 'App 1' } },
      { path: '/config/app1/db', data: { host: 'localhost' } },
    ];

    const tree = buildTree(docs, '/config/app1');

    assert.deepStrictEqual(tree, {
      name: 'App 1',
      db: { host: 'localhost' },
    });
  });
});

describe('deepMerge', () => {
  it('should merge flat objects', () => {
    const target = { a: 1, b: 2 };
    const source = { b: 3, c: 4 };

    const result = deepMerge(target, source);

    assert.deepStrictEqual(result, { a: 1, b: 3, c: 4 });
  });

  it('should merge nested objects', () => {
    const target = {
      db: { host: 'old', port: 5432 },
      cache: { enabled: true },
    };
    const source = {
      db: { host: 'new', ssl: true },
    };

    const result = deepMerge(target, source);

    assert.deepStrictEqual(result, {
      db: { host: 'new', port: 5432, ssl: true },
      cache: { enabled: true },
    });
  });

  it('should replace arrays', () => {
    const target = { items: [1, 2, 3] };
    const source = { items: [4, 5] };

    const result = deepMerge(target, source);

    assert.deepStrictEqual(result, { items: [4, 5] });
  });

  it('should handle null values', () => {
    const target = { a: 1, b: { c: 2 } };
    const source = { b: null };

    const result = deepMerge(target, source);

    assert.deepStrictEqual(result, { a: 1, b: null });
  });

  it('should not mutate original objects', () => {
    const target = { a: { b: 1 } };
    const source = { a: { c: 2 } };

    deepMerge(target, source);

    assert.deepStrictEqual(target, { a: { b: 1 } });
    assert.deepStrictEqual(source, { a: { c: 2 } });
  });

  it('should handle empty objects', () => {
    const result = deepMerge({}, { a: 1 });
    assert.deepStrictEqual(result, { a: 1 });
  });

  it('should deeply merge multiple levels', () => {
    const target = {
      level1: {
        level2: {
          level3: { a: 1, b: 2 },
        },
      },
    };
    const source = {
      level1: {
        level2: {
          level3: { b: 3, c: 4 },
        },
      },
    };

    const result = deepMerge(target, source);

    assert.deepStrictEqual(result, {
      level1: {
        level2: {
          level3: { a: 1, b: 3, c: 4 },
        },
      },
    });
  });
});
