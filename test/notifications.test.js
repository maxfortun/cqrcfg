import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { waitForKafka, cleanupMongo } from './setup.js';

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const KAFKA_TOPIC = 'cqrcfg-test-changes';

describe('WebSocket Notifications', async () => {
  let notifications;

  before(async () => {
    const { WebSocketNotifications } = await import('../src/notifications/websocket.js');
    notifications = new WebSocketNotifications();
    await notifications.connect();
  });

  after(async () => {
    await notifications.close();
  });

  it('should publish and receive messages', async () => {
    const received = [];
    const path = '/config/app1';

    // Subscribe - returns object with unsubscribe method
    const subscription = await notifications.subscribe(path, (message) => {
      received.push(message);
    });

    // Publish
    await notifications.publish(path, { operation: 'update', data: { test: true } });

    // Wait a bit for message delivery
    await new Promise(r => setTimeout(r, 50));

    assert.strictEqual(received.length, 1);
    assert.strictEqual(received[0].operation, 'update');
    assert.strictEqual(received[0].data.test, true);

    subscription.unsubscribe();
  });

  it('should only deliver messages to matching subscribers', async () => {
    const app1Messages = [];
    const app2Messages = [];

    const sub1 = await notifications.subscribe('/config/app1', (msg) => app1Messages.push(msg));
    const sub2 = await notifications.subscribe('/config/app2', (msg) => app2Messages.push(msg));

    await notifications.publish('/config/app1', { value: 1 });
    await notifications.publish('/config/app2', { value: 2 });

    await new Promise(r => setTimeout(r, 50));

    assert.strictEqual(app1Messages.length, 1);
    assert.strictEqual(app1Messages[0].value, 1);

    assert.strictEqual(app2Messages.length, 1);
    assert.strictEqual(app2Messages[0].value, 2);

    sub1.unsubscribe();
    sub2.unsubscribe();
  });

  it('should deliver to parent path subscribers', async () => {
    const received = [];

    const subscription = await notifications.subscribe('/config/app1', (msg) => received.push(msg));

    // Publish to child path
    await notifications.publish('/config/app1/db', { host: 'localhost' });

    await new Promise(r => setTimeout(r, 50));

    assert.strictEqual(received.length, 1);

    subscription.unsubscribe();
  });

  it('should stop delivering after unsubscribe', async () => {
    const received = [];
    const path = '/config/app1';

    const subscription = await notifications.subscribe(path, (msg) => received.push(msg));

    await notifications.publish(path, { value: 1 });
    await new Promise(r => setTimeout(r, 50));

    subscription.unsubscribe();

    await notifications.publish(path, { value: 2 });
    await new Promise(r => setTimeout(r, 50));

    assert.strictEqual(received.length, 1);
  });
});

describe('Kafka Notifications', async () => {
  let notifications;

  before(async () => {
    await waitForKafka(KAFKA_BROKERS);

    const { KafkaNotifications } = await import('../src/notifications/kafka.js');
    notifications = new KafkaNotifications({
      brokers: KAFKA_BROKERS,
      topic: KAFKA_TOPIC,
      clientId: 'cqrcfg-test',
      groupId: `cqrcfg-test-${Date.now()}`, // Unique group for each test run
    });
    await notifications.connect();
  });

  after(async () => {
    if (notifications) {
      await notifications.close();
    }
  });

  it('should publish messages to Kafka', async () => {
    // This test verifies publishing doesn't throw
    await notifications.publish('/config/app1', {
      operation: 'update',
      data: { test: true },
    });

    // If we get here without error, publishing works
    assert.ok(true);
  });

  it('should handle multiple rapid publishes', async () => {
    const promises = [];

    for (let i = 0; i < 10; i++) {
      promises.push(
        notifications.publish(`/config/app${i}`, {
          operation: 'update',
          index: i,
        })
      );
    }

    await Promise.all(promises);
    assert.ok(true);
  });
});
