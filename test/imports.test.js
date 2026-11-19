import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { createTestToken, startJwksServer, stopJwksServer, cleanupMongo } from './setup.js';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE = 'cqrcfg_test_imports';

process.env.STORAGE_TYPE = 'mongodb';
process.env.MONGODB_URI = MONGO_URI;
process.env.MONGODB_DATABASE = DATABASE;
process.env.NOTIFICATIONS_TYPE = 'websocket';
process.env.IMPORT_MAX_DEPTH = '10';

describe('Config imports', async () => {
  let fastify;
  let token;
  let limitedToken;
  let subscribeToChanges;

  const auth = (t = token) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' });
  const authNoBody = (t = token) => ({ Authorization: `Bearer ${t}` });

  async function put(path, payload) {
    const res = await fastify.inject({ method: 'PUT', url: `/config${path}`, headers: auth(), payload });
    assert.strictEqual(res.statusCode, 200, res.body);
  }

  async function get(path, t = token) {
    const res = await fastify.inject({ method: 'GET', url: `/config${path}`, headers: auth(t) });
    return { status: res.statusCode, body: JSON.parse(res.body) };
  }

  before(async () => {
    process.env.OIDC_JWKS_URIS = await startJwksServer();

    const { initStorage } = await import('../src/storage/index.js');
    const { initNotifications } = await import('../src/notifications/index.js');
    ({ subscribeToChanges } = await import('../src/services/notificationService.js'));
    const configRoutes = (await import('../src/routes/config.js')).default;

    await initStorage();
    await initNotifications();

    fastify = Fastify({ logger: false });
    await fastify.register(websocket);
    await fastify.register(configRoutes, { prefix: '/config' });

    token = await createTestToken({
      cqrcfg_acl: [{ path: '/config', allow: ['read', 'write'] }],
    });
    // Can read /config/app but not /config/secret
    limitedToken = await createTestToken({
      cqrcfg_acl: [{ path: '/config/app', allow: ['read', 'write'] }],
    });
  });

  after(async () => {
    await fastify.close();
    await stopJwksServer();
    const { closeStorage } = await import('../src/storage/index.js');
    const { closeNotifications } = await import('../src/notifications/index.js');
    await closeNotifications();
    await closeStorage();
  });

  beforeEach(async () => {
    await cleanupMongo(MONGO_URI, DATABASE);
    const { invalidateCacheForPath } = await import('../src/services/configService.js');
    for (const p of ['/config/app', '/config/app/main', '/config/shared', '/config/shared/db']) {
      invalidateCacheForPath(p);
    }
  });

  it('imports the whole source and removes the tag', async () => {
    await put('/shared/db', { host: 'db.local', port: 5432 });
    await put('/app/main', { name: 'main', ___import: { source: 'shared/db' } });

    const { status, body } = await get('/app/main');
    assert.strictEqual(status, 200);
    assert.deepStrictEqual(body, { name: 'main', host: 'db.local', port: 5432 });
  });

  it('accepts /config-prefixed and leading-slash sources', async () => {
    await put('/shared/db', { host: 'db.local' });
    await put('/app/a', { ___import: { source: '/config/shared/db' } });
    await put('/app/b', { ___import: { source: '/shared/db' } });

    assert.deepStrictEqual((await get('/app/a')).body, { host: 'db.local' });
    assert.deepStrictEqual((await get('/app/b')).body, { host: 'db.local' });
  });

  it('resolves imports nested three levels deep', async () => {
    await put('/shared/l3', { c: 3 });
    await put('/shared/l2', { b: 2, ___import: { source: 'shared/l3' } });
    await put('/shared/l1', { a: 1, ___import: { source: 'shared/l2' } });
    await put('/app/main', { root: true, ___import: { source: 'shared/l1' } });

    const { body } = await get('/app/main');
    assert.deepStrictEqual(body, { root: true, a: 1, b: 2, c: 3 });
  });

  it('resolves imports at a nested level of the document', async () => {
    await put('/shared/db', { host: 'db.local' });
    await put('/app/main', { database: { port: 1, ___import: { source: 'shared/db' } } });

    const { body } = await get('/app/main');
    assert.deepStrictEqual(body, { database: { port: 1, host: 'db.local' } });
  });

  it('priority keep leaves existing keys unchanged', async () => {
    await put('/shared/db', { host: 'imported', extra: 'x' });
    await put('/app/main', { host: 'mine', ___import: { source: 'shared/db', priority: 'keep' } });

    assert.deepStrictEqual((await get('/app/main')).body, { host: 'mine', extra: 'x' });
  });

  it('priority overwrite replaces existing keys', async () => {
    await put('/shared/db', { host: 'imported', extra: 'x' });
    await put('/app/main', { host: 'mine', ___import: { source: 'shared/db', priority: 'overwrite' } });

    assert.deepStrictEqual((await get('/app/main')).body, { host: 'imported', extra: 'x' });
  });

  it('defaults to keep when priority is omitted', async () => {
    await put('/shared/db', { host: 'imported' });
    await put('/app/main', { host: 'mine', ___import: { source: 'shared/db' } });

    assert.strictEqual((await get('/app/main')).body.host, 'mine');
  });

  it('deep merges nested objects according to priority', async () => {
    await put('/shared/db', { pool: { min: 1, max: 10 }, tags: ['a'] });
    await put('/app/keep', { pool: { max: 99, idle: 5 }, tags: ['b'], ___import: { source: 'shared/db' } });
    await put('/app/over', {
      pool: { max: 99, idle: 5 },
      tags: ['b'],
      ___import: { source: 'shared/db', priority: 'overwrite' },
    });

    assert.deepStrictEqual((await get('/app/keep')).body, {
      pool: { min: 1, max: 99, idle: 5 },
      tags: ['b'],
    });
    assert.deepStrictEqual((await get('/app/over')).body, {
      pool: { min: 1, max: 10, idle: 5 },
      tags: ['a'],
    });
  });

  it('filter imports only the matching keys', async () => {
    await put('/shared/db', { host: 'db.local', port: 5432, nested: { user: 'u', pass: 'p' } });
    await put('/app/main', { ___import: { source: 'shared/db', filter: '$.host' } });
    await put('/app/nested', { ___import: { source: 'shared/db', filter: '$.nested' } });

    assert.deepStrictEqual((await get('/app/main')).body, { host: 'db.local' });
    assert.deepStrictEqual((await get('/app/nested')).body, { nested: { user: 'u', pass: 'p' } });
  });

  it('filter matching nothing imports nothing', async () => {
    await put('/shared/db', { host: 'db.local' });
    await put('/app/main', { a: 1, ___import: { source: 'shared/db', filter: '$.missing' } });

    assert.deepStrictEqual((await get('/app/main')).body, { a: 1 });
  });

  it('returns 422 for an invalid JSONPath filter', async () => {
    await put('/shared/db', { host: 'db.local' });
    await put('/app/main', { ___import: { source: 'shared/db', filter: '$[?(' } });

    const { status, body } = await get('/app/main');
    assert.strictEqual(status, 422);
    assert.strictEqual(body.code, 'INVALID_FILTER');
    assert.strictEqual(body.source, '/config/shared/db');
  });

  it('returns 422 for a circular import without hanging', async () => {
    await put('/app/a', { ___import: { source: 'app/b' } });
    await put('/app/b', { ___import: { source: 'app/a' } });

    const { status, body } = await get('/app/a');
    assert.strictEqual(status, 422);
    assert.strictEqual(body.code, 'CIRCULAR_IMPORT');
    assert.match(body.message, /\/config\/app\/a -> \/config\/app\/b -> \/config\/app\/a/);
  });

  it('returns 422 for a self import', async () => {
    await put('/app/a', { ___import: { source: 'app/a' } });

    const { status, body } = await get('/app/a');
    assert.strictEqual(status, 422);
    assert.strictEqual(body.code, 'CIRCULAR_IMPORT');
  });

  it('returns 422 for a missing source', async () => {
    await put('/app/main', { ___import: { source: 'shared/nope' } });

    const { status, body } = await get('/app/main');
    assert.strictEqual(status, 422);
    assert.strictEqual(body.code, 'SOURCE_NOT_FOUND');
    assert.strictEqual(body.source, '/config/shared/nope');
    assert.strictEqual(body.importedFrom, '/config/app/main');
  });

  it('returns 422 for a malformed tag', async () => {
    await put('/app/nosource', { ___import: { priority: 'keep' } });
    await put('/app/badprio', { ___import: { source: 'shared/db', priority: 'sometimes' } });

    assert.strictEqual((await get('/app/nosource')).body.code, 'INVALID_IMPORT_TAG');
    assert.strictEqual((await get('/app/badprio')).body.code, 'INVALID_IMPORT_TAG');
  });

  it('returns 403 when the caller cannot read the imported source', async () => {
    await put('/secret/creds', { password: 'hunter2' });
    await put('/app/main', { name: 'main', ___import: { source: 'secret/creds' } });

    const limited = await get('/app/main', limitedToken);
    assert.strictEqual(limited.status, 403);
    assert.strictEqual(limited.body.code, 'FORBIDDEN_SOURCE');
    assert.strictEqual(limited.body.source, '/config/secret/creds');
    assert.ok(!JSON.stringify(limited.body).includes('hunter2'));

    // Full-access caller resolves fine
    const full = await get('/app/main');
    assert.strictEqual(full.status, 200);
    assert.strictEqual(full.body.password, 'hunter2');
  });

  it('checks permissions on sources of nested imports too', async () => {
    await put('/secret/creds', { password: 'hunter2' });
    await put('/app/mid', { ___import: { source: 'secret/creds' } });
    await put('/app/main', { ___import: { source: 'app/mid' } });

    const limited = await get('/app/main', limitedToken);
    assert.strictEqual(limited.status, 403);
  });

  it('keeps the raw ___import tag in storage and via raw=true', async () => {
    await put('/shared/db', { host: 'db.local' });
    const stored = { name: 'main', ___import: { source: 'shared/db', priority: 'overwrite' } };
    await put('/app/main', stored);

    await get('/app/main'); // resolved read must not alter storage

    const raw = await fastify.inject({
      method: 'GET', url: '/config/app/main?raw=true', headers: auth(),
    });
    assert.strictEqual(raw.statusCode, 200);
    assert.deepStrictEqual(JSON.parse(raw.body), stored);

    const { getStorage } = await import('../src/storage/index.js');
    const doc = await getStorage().getByPath('/config/app/main');
    assert.deepStrictEqual(doc.data, stored);
  });

  it('raw=true is not treated as a key-value filter', async () => {
    await put('/app/main', { a: 1 });
    const res = await fastify.inject({ method: 'GET', url: '/config/app/main?raw=true', headers: auth() });
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(JSON.parse(res.body), { a: 1 });
  });

  it('resolves imports for subtree reads containing importing documents', async () => {
    await put('/shared/db', { host: 'db.local' });
    await put('/app/main', { ___import: { source: 'shared/db' } });

    const { body } = await get('/app');
    assert.deepStrictEqual(body, { main: { host: 'db.local' } });
  });

  it('reflects a change to an imported config on the next read (cache enabled)', async () => {
    await put('/shared/db', { host: 'one' });
    await put('/app/main', { ___import: { source: 'shared/db' } });

    assert.strictEqual((await get('/app/main')).body.host, 'one');
    await put('/shared/db', { host: 'two' });
    assert.strictEqual((await get('/app/main')).body.host, 'two');
  });

  it('does not mutate cached trees when resolving', async () => {
    await put('/shared/db', { pool: { max: 10 } });
    await put('/app/main', { pool: { min: 1 }, ___import: { source: 'shared/db', priority: 'overwrite' } });

    await get('/app/main');
    await get('/app/main');
    assert.deepStrictEqual((await get('/shared/db')).body, { pool: { max: 10 } });
  });

  it('returns configs without imports exactly as stored', async () => {
    const data = { a: 1, nested: { b: [1, 2, 3] } };
    await put('/app/plain', data);
    assert.deepStrictEqual((await get('/app/plain')).body, data);
  });

  it('copying with ?from= keeps the raw import tag', async () => {
    await put('/shared/db', { host: 'db.local' });
    const stored = { ___import: { source: 'shared/db' } };
    await put('/app/main', stored);

    const res = await fastify.inject({
      method: 'PUT', url: '/config/app/copy?from=/app/main', headers: authNoBody(),
    });
    assert.strictEqual(res.statusCode, 200, res.body);

    const raw = await fastify.inject({ method: 'GET', url: '/config/app/copy?raw=true', headers: auth() });
    assert.deepStrictEqual(JSON.parse(raw.body), stored);
  });

  it('notifies importers (including transitive ones) when a source changes', async () => {
    await put('/shared/base', { v: 1 });
    await put('/shared/mid', { ___import: { source: 'shared/base' } });
    await put('/app/main', { ___import: { source: 'shared/mid' } });
    await put('/app/unrelated', { x: 1 });

    const events = [];
    const sub = await subscribeToChanges('/config', (e) => events.push(e));

    await put('/shared/base', { v: 2 });
    await new Promise((r) => setTimeout(r, 100));
    sub.unsubscribe();

    const paths = events.map((e) => e.path);
    assert.ok(paths.includes('/config/shared/base'));
    assert.ok(paths.includes('/config/shared/mid'));
    assert.ok(paths.includes('/config/app/main'));
    assert.ok(!paths.includes('/config/app/unrelated'));
  });

  it('notifies importers when a source is deleted', async () => {
    await put('/shared/db', { host: 'x' });
    await put('/app/main', { ___import: { source: 'shared/db' } });

    const events = [];
    const sub = await subscribeToChanges('/config', (e) => events.push(e));

    const res = await fastify.inject({ method: 'DELETE', url: '/config/shared/db', headers: authNoBody() });
    assert.strictEqual(res.statusCode, 200);
    await new Promise((r) => setTimeout(r, 100));
    sub.unsubscribe();

    assert.ok(events.some((e) => e.path === '/config/app/main' && e.operation === 'update'));
  });
});
