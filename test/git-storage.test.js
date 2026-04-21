import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { rm, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

describe('Git Storage (local mode)', async () => {
  let storage;
  let testDir;

  before(async () => {
    const { GitStorage } = await import('../src/storage/git.js');
    testDir = join(tmpdir(), `cqrcfg-git-test-${randomUUID()}`);
    storage = new GitStorage({
      localPath: testDir,
      branch: 'main',
    });
    await storage.connect();
  });

  after(async () => {
    await storage.close();
    await rm(testDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Clean up all config files between tests
    const paths = await storage.listPaths('/config');
    for (const path of paths) {
      await storage.deleteByPrefix(path);
    }
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

  it('should list paths under prefix', async () => {
    await storage.upsert('/config/app1/db', { host: 'db.local' });
    await storage.upsert('/config/app1/cache', { host: 'cache.local' });
    await storage.upsert('/config/app2/db', { host: 'other.local' });

    const paths = await storage.listPaths('/config/app1');

    assert.strictEqual(paths.length, 2);
    assert.ok(paths.includes('/config/app1/db'));
    assert.ok(paths.includes('/config/app1/cache'));
    assert.ok(!paths.includes('/config/app2/db'));
  });

  it('should return empty array for listPaths on non-existent prefix', async () => {
    const paths = await storage.listPaths('/config/nonexistent');
    assert.strictEqual(paths.length, 0);
  });

  it('should search paths with glob patterns', async () => {
    await storage.upsert('/config/app1/db', { host: 'db1.local' });
    await storage.upsert('/config/app2/db', { host: 'db2.local' });
    await storage.upsert('/config/app1/cache', { host: 'cache.local' });

    // Single wildcard
    const dbPaths = await storage.searchPaths('/config/*/db');
    assert.strictEqual(dbPaths.length, 2);
    assert.ok(dbPaths.includes('/config/app1/db'));
    assert.ok(dbPaths.includes('/config/app2/db'));

    // Question mark wildcard
    await storage.upsert('/config/app10/db', { host: 'db10.local' });
    const singleCharPaths = await storage.searchPaths('/config/app?/db');
    assert.strictEqual(singleCharPaths.length, 2);
    assert.ok(singleCharPaths.includes('/config/app1/db'));
    assert.ok(singleCharPaths.includes('/config/app2/db'));
    assert.ok(!singleCharPaths.includes('/config/app10/db'));
  });

  it('should filter by value with getByPathWithFilter', async () => {
    await storage.upsert('/config/app1/db', { host: 'localhost', port: 5432 });

    // Matching filter
    const match = await storage.getByPathWithFilter('/config/app1/db', { host: 'localhost' });
    assert.ok(match);
    assert.strictEqual(match.data.host, 'localhost');

    // Non-matching filter
    const noMatch = await storage.getByPathWithFilter('/config/app1/db', { host: 'remotehost' });
    assert.strictEqual(noMatch, null);

    // Numeric filter
    const numMatch = await storage.getByPathWithFilter('/config/app1/db', { port: '5432' });
    assert.ok(numMatch);
  });

  it('should handle concurrent operations', async () => {
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(storage.upsert(`/config/concurrent/key${i}`, { value: i }));
    }
    await Promise.all(promises);

    const results = await storage.getByPrefix('/config/concurrent');
    assert.strictEqual(results.length, 10);
  });
});

describe('Git Storage (with remote simulation)', async () => {
  let bareRepoDir;
  let storage1;
  let storage2;
  let testDir1;
  let testDir2;

  before(async () => {
    const { GitStorage } = await import('../src/storage/git.js');
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    // Create a bare repo to act as remote
    bareRepoDir = join(tmpdir(), `cqrcfg-git-bare-${randomUUID()}`);
    await mkdir(bareRepoDir, { recursive: true });
    await execFileAsync('git', ['init', '--bare', '--initial-branch=main'], { cwd: bareRepoDir });

    // Initialize with an empty commit so we have a main branch
    const initDir = join(tmpdir(), `cqrcfg-git-init-${randomUUID()}`);
    await execFileAsync('git', ['clone', bareRepoDir, initDir]);
    await execFileAsync('git', ['config', 'user.email', 'test@test.com'], { cwd: initDir });
    await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: initDir });
    await execFileAsync('git', ['checkout', '-b', 'main'], { cwd: initDir });
    await execFileAsync('git', ['commit', '--allow-empty', '-m', 'Initial commit'], { cwd: initDir });
    await execFileAsync('git', ['push', '-u', 'origin', 'main'], { cwd: initDir });
    await rm(initDir, { recursive: true, force: true });

    // Create two storage instances pointing to same remote
    testDir1 = join(tmpdir(), `cqrcfg-git-test1-${randomUUID()}`);
    testDir2 = join(tmpdir(), `cqrcfg-git-test2-${randomUUID()}`);

    storage1 = new GitStorage({
      remoteUrl: bareRepoDir,
      localPath: testDir1,
      branch: 'main',
      pullInterval: 0, // Always pull
    });

    storage2 = new GitStorage({
      remoteUrl: bareRepoDir,
      localPath: testDir2,
      branch: 'main',
      pullInterval: 0, // Always pull
    });

    await storage1.connect();
    await storage2.connect();
  });

  after(async () => {
    await storage1.close();
    await storage2.close();
    await rm(bareRepoDir, { recursive: true, force: true });
    await rm(testDir1, { recursive: true, force: true });
    await rm(testDir2, { recursive: true, force: true });
  });

  it('should sync changes between instances via remote', async () => {
    // Write from storage1 (commits and pushes to remote)
    await storage1.upsert('/config/shared/key1', { value: 'from-storage1' });

    // Force storage2 to pull by resetting lastPull
    storage2.lastPull = 0;

    // Read from storage2 (should pull and see the change)
    const result = await storage2.getByPath('/config/shared/key1');
    assert.ok(result);
    assert.strictEqual(result.data.value, 'from-storage1');
  });

  it('should handle concurrent writes to different keys', async () => {
    const promises = [
      storage1.upsert('/config/concurrent/from1', { source: 'storage1' }),
      storage2.upsert('/config/concurrent/from2', { source: 'storage2' }),
    ];

    await Promise.all(promises);

    // Force both to pull
    storage1.lastPull = 0;
    storage2.lastPull = 0;

    // Both should be visible from either storage after pull
    const result1 = await storage1.getByPath('/config/concurrent/from2');
    const result2 = await storage2.getByPath('/config/concurrent/from1');

    assert.ok(result1);
    assert.ok(result2);
    assert.strictEqual(result1.data.source, 'storage2');
    assert.strictEqual(result2.data.source, 'storage1');
  });
});
