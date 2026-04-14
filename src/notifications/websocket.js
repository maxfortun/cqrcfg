import { NotificationsInterface } from './interface.js';

/**
 * WebSocket notifications - manages in-process subscriptions for WebSocket clients.
 * This is the default that works without external dependencies.
 */
export class WebSocketNotifications extends NotificationsInterface {
  constructor() {
    super();
    this.subscriptions = new Map(); // pathPrefix -> Set<callback>
  }

  async connect() {
    console.log('WebSocket notifications initialized');
  }

  async close() {
    this.subscriptions.clear();
    console.log('WebSocket notifications closed');
  }

  async publish(path, event) {
    // Find all subscriptions that match this path
    for (const [prefix, callbacks] of this.subscriptions.entries()) {
      if (path === prefix || path.startsWith(prefix + '/')) {
        for (const callback of callbacks) {
          try {
            callback(event);
          } catch (error) {
            console.error('Error in subscription callback:', error);
          }
        }
      }
    }
  }

  async subscribe(pathPrefix, callback) {
    if (!this.subscriptions.has(pathPrefix)) {
      this.subscriptions.set(pathPrefix, new Set());
    }
    this.subscriptions.get(pathPrefix).add(callback);

    return {
      unsubscribe: () => {
        const callbacks = this.subscriptions.get(pathPrefix);
        if (callbacks) {
          callbacks.delete(callback);
          if (callbacks.size === 0) {
            this.subscriptions.delete(pathPrefix);
          }
        }
      },
    };
  }

  supportsSubscription() {
    return true;
  }
}
