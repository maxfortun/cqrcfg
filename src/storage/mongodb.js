import { MongoClient } from 'mongodb';
import { StorageInterface } from './interface.js';

const COLLECTION = 'config';

export class MongoDBStorage extends StorageInterface {
  constructor(options) {
    super();
    this.uri = options.uri;
    this.database = options.database;
    this.client = null;
    this.db = null;
  }

  async connect() {
    if (this.db) return;

    this.client = new MongoClient(this.uri);
    await this.client.connect();

    this.db = this.client.db(this.database);

    // Create unique index on path
    await this.db.collection(COLLECTION).createIndex(
      { path: 1 },
      { unique: true }
    );

    console.log(`Connected to MongoDB: ${this.database}`);
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      console.log('Disconnected from MongoDB');
    }
  }

  async getByPrefix(pathPrefix) {
    const collection = this.db.collection(COLLECTION);
    const regex = new RegExp(`^${escapeRegex(pathPrefix)}($|/)`);

    return collection.find({ path: regex }).toArray();
  }

  async getByPath(path) {
    const collection = this.db.collection(COLLECTION);
    return collection.findOne({ path });
  }

  async upsert(path, data) {
    const collection = this.db.collection(COLLECTION);

    await collection.updateOne(
      { path },
      {
        $set: {
          path,
          data,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
  }

  async deleteByPrefix(pathPrefix) {
    const collection = this.db.collection(COLLECTION);
    const regex = new RegExp(`^${escapeRegex(pathPrefix)}($|/)`);

    const result = await collection.deleteMany({ path: regex });
    return result.deletedCount;
  }

}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
