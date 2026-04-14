/**
 * Notifications interface definition.
 * All notification implementations must provide these methods.
 */

/**
 * @typedef {Object} ConfigChangeEvent
 * @property {string} operation - 'insert', 'update', or 'delete'
 * @property {string} path - The config path that changed
 * @property {Object} [data] - The new data (not present for deletes)
 * @property {string} timestamp - ISO timestamp of the change
 */

export class NotificationsInterface {
  /**
   * Initialize the notification connection
   */
  async connect() {
    throw new Error('Not implemented');
  }

  /**
   * Close the notification connection
   */
  async close() {
    throw new Error('Not implemented');
  }

  /**
   * Publish a config change event
   * @param {string} path - The config path that changed
   * @param {ConfigChangeEvent} event - The change event
   */
  async publish(path, event) {
    throw new Error('Not implemented');
  }

  /**
   * Subscribe to config changes for a path prefix
   * @param {string} pathPrefix - The path prefix to subscribe to
   * @param {function(ConfigChangeEvent): void} callback - Called when events arrive
   * @returns {Object} Subscription handle with unsubscribe() method
   */
  async subscribe(pathPrefix, callback) {
    throw new Error('Not implemented');
  }

  /**
   * Check if this notification system supports subscriptions
   * @returns {boolean}
   */
  supportsSubscription() {
    return true;
  }
}
