/**
 * Storage interface definition.
 * All storage implementations must provide these methods.
 */

/**
 * @typedef {Object} ConfigDocument
 * @property {string} path - The config path
 * @property {Object} data - The config data
 * @property {Date} updatedAt - Last update timestamp
 */

/**
 * @typedef {Object} Storage
 * @property {function(): Promise<void>} connect - Initialize connection
 * @property {function(): Promise<void>} close - Close connection
 * @property {function(string): Promise<ConfigDocument[]>} getByPrefix - Get all docs matching path prefix
 * @property {function(string): Promise<ConfigDocument|null>} getByPath - Get single doc by exact path
 * @property {function(string, Object): Promise<void>} upsert - Insert or replace a document
 * @property {function(string): Promise<number>} deleteByPrefix - Delete all docs matching path prefix
 * @property {function(string): Promise<string[]>} listPaths - List all paths under a prefix
 * @property {function(RegExp): Promise<string[]>} searchPaths - Search paths matching a regex pattern
 */

export class StorageInterface {
  async connect() {
    throw new Error('Not implemented');
  }

  async close() {
    throw new Error('Not implemented');
  }

  async getByPrefix(pathPrefix) {
    throw new Error('Not implemented');
  }

  async getByPath(path) {
    throw new Error('Not implemented');
  }

  async upsert(path, data) {
    throw new Error('Not implemented');
  }

  async deleteByPrefix(pathPrefix) {
    throw new Error('Not implemented');
  }

  async listPaths(pathPrefix) {
    throw new Error('Not implemented');
  }

  async searchPaths(regex) {
    throw new Error('Not implemented');
  }
}
