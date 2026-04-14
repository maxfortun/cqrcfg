import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { cleanupMongo } from './setup.js';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE = 'cqrcfg_test';

describe('MongoDB Storage', async () => {
  let storage;

  before(async () => {
    const { MongoDBStorage } = await import('../src/storage/mongodb.js');
    storage = new MongoDBStorage({
      uri: MONGO_URI,
      database: DATABASE,
    });
    await storage.connect();
  });

  after(async () => {
    await storage.close();
  });

  beforeEach(async () => {
    await cleanupMongo(MONGO_URI, DATABASE);
  });

  it('should upsert and get by path', async () => {
    const path = '/config/app1/db';
    const data = { host: 'localhost', port: 5432 };

    await storage.upsert(path, data);
    const result = await storage.getByPath(path);

    assert.strictEqual(result.path, path);
    assert.deepStrictEqual(result.data, data);
  });

  it('should return null for non-existent path', async () => {
    const result = await storage.getByPath('/config/nonexistent');
    assert.strictEqual(result, null);
  });

  it('should get by prefix', async () => {
    await storage.upsert('/config/app1/db', { host: 'db.local' });
    await storage.upsert('/config/app1/cache', { host: 'cache.local' });
    await storage.upsert('/config/app2/db', { host: 'other.local' });

    const results = await storage.getByPrefix('/config/app1');

    assert.strictEqual(results.length, 2);
    const paths = results.map(r => r.path);
    assert.ok(paths.includes('/config/app1/db'));
    assert.ok(paths.includes('/config/app1/cache'));
  });

  it('should use boundary-safe prefix matching', async () => {
    await storage.upsert('/config/app1/db', { host: 'app1.local' });
    await storage.upsert('/config/app10/db', { host: 'app10.local' });

    const results = await storage.getByPrefix('/config/app1');

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].path, '/config/app1/db');
  });

  it('should delete by prefix', async () => {
    await storage.upsert('/config/app1/db', { host: 'localhost' });
    await storage.upsert('/config/app1/cache', { host: 'localhost' });
    await storage.upsert('/config/app2/db', { host: 'localhost' });

    const count = await storage.deleteByPrefix('/config/app1');

    assert.strictEqual(count, 2);

    const remaining = await storage.getByPrefix('/config');
    assert.strictEqual(remaining.length, 1);
    assert.strictEqual(remaining[0].path, '/config/app2/db');
  });

  it('should update existing document on upsert', async () => {
    const path = '/config/app1/db';

    await storage.upsert(path, { host: 'old-host', port: 5432 });
    await storage.upsert(path, { host: 'new-host', port: 5433 });

    const result = await storage.getByPath(path);
    assert.strictEqual(result.data.host, 'new-host');
    assert.strictEqual(result.data.port, 5433);

    // Should still be only one document
    const allDocs = await storage.getByPrefix('/config/app1');
    assert.strictEqual(allDocs.length, 1);
  });

  it('should handle deeply nested paths', async () => {
    const path = '/config/app1/services/api/database/connection';
    const data = { host: 'deep.local', pool: { min: 1, max: 10 } };

    await storage.upsert(path, data);
    const result = await storage.getByPath(path);

    assert.deepStrictEqual(result.data, data);
  });

  it('should include exact path match in prefix query', async () => {
    await storage.upsert('/config/app1', { name: 'App 1' });
    await storage.upsert('/config/app1/db', { host: 'localhost' });

    const results = await storage.getByPrefix('/config/app1');

    assert.strictEqual(results.length, 2);
  });
});
