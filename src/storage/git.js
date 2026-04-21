import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdir, readFile, writeFile, rm, readdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'crypto';
import { StorageInterface, globToRegex, matchesFilter } from './interface.js';

const execFileAsync = promisify(execFile);

export class GitStorage extends StorageInterface {
  constructor(options) {
    super();
    this.remoteUrl = options.remoteUrl || '';
    this.localPath = options.localPath || '/tmp/cqrcfg-git';
    this.branch = options.branch || 'main';
    this.commitAuthor = options.commitAuthor || 'cqrcfg <cqrcfg@localhost>';
    this.pullInterval = options.pullInterval || 30000; // 30 seconds default

    // Encryption settings (optional)
    const encryption = options.encryption || {};
    this.encryptionSalt = encryption.salt || '';
    this.encryptionPassword = encryption.password || '';

    // Mutex for git operations
    this.operationQueue = Promise.resolve();
    this.lastPull = 0;
  }

  _isEncryptionEnabled() {
    return !!(this.encryptionSalt && this.encryptionPassword);
  }

  _encrypt(plaintext) {
    if (!this._isEncryptionEnabled()) return plaintext;

    const salt = Buffer.from(this.encryptionSalt, 'hex');
    const key = pbkdf2Sync(this.encryptionPassword, salt, 100000, 32, 'sha512');
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', key, iv);

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const result = Buffer.concat([Buffer.from('Salted__'), salt, iv, encrypted]);
    return result.toString('base64');
  }

  _decrypt(ciphertext) {
    if (!this._isEncryptionEnabled()) return ciphertext;

    try {
      const data = Buffer.from(ciphertext, 'base64');
      const prefix = data.subarray(0, 8).toString();
      if (prefix !== 'Salted__') {
        return ciphertext;
      }

      const salt = data.subarray(8, 16);
      const iv = data.subarray(16, 32);
      const encrypted = data.subarray(32);

      const key = pbkdf2Sync(this.encryptionPassword, salt, 100000, 32, 'sha512');
      const decipher = createDecipheriv('aes-256-cbc', key, iv);

      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    } catch {
      return ciphertext;
    }
  }

  _hasRemote() {
    return !!this.remoteUrl;
  }

  async connect() {
    await this._withLock(async () => {
      try {
        // Check if repo exists
        await stat(join(this.localPath, '.git'));
        console.log(`Git repo exists at ${this.localPath}`);

        if (this._hasRemote()) {
          // Fetch and reset to remote
          await this._git(['fetch', 'origin', this.branch]);
          await this._git(['reset', '--hard', `origin/${this.branch}`]);
        }
      } catch (err) {
        if (err.code === 'ENOENT') {
          if (this._hasRemote()) {
            // Clone the repo
            await mkdir(this.localPath, { recursive: true });
            await this._gitRaw(['clone', '--branch', this.branch, this.remoteUrl, this.localPath]);
            console.log(`Cloned git repo from ${this.remoteUrl}`);
          } else {
            // Initialize local repo without remote
            await mkdir(this.localPath, { recursive: true });
            await this._git(['init']);
            await this._git(['checkout', '-b', this.branch]);
            console.log(`Initialized local git repo at ${this.localPath}`);
          }
        } else {
          throw err;
        }
      }

      this.lastPull = Date.now();
      if (this._hasRemote()) {
        console.log(`Connected to git storage: ${this.remoteUrl}`);
      } else {
        console.log(`Connected to local git storage: ${this.localPath} (no remote)`);
      }
    });
  }

  async close() {
    // Nothing to close for git
    console.log('Disconnected from git storage');
  }

  async _git(args) {
    try {
      const { stdout } = await execFileAsync('git', args, {
        cwd: this.localPath,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      });
      return stdout.trim();
    } catch (err) {
      throw new Error(`Git command failed: git ${args.join(' ')}\n${err.stderr || err.message}`);
    }
  }

  async _gitRaw(args) {
    try {
      const { stdout } = await execFileAsync('git', args, {
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      });
      return stdout.trim();
    } catch (err) {
      throw new Error(`Git command failed: git ${args.join(' ')}\n${err.stderr || err.message}`);
    }
  }

  // Serialize git operations to avoid conflicts
  async _withLock(fn) {
    const ticket = this.operationQueue.then(() => fn()).catch(err => { throw err; });
    this.operationQueue = ticket.catch(() => {});
    return ticket;
  }

  async _pullIfNeeded() {
    if (!this._hasRemote()) return;

    const now = Date.now();
    if (now - this.lastPull < this.pullInterval) {
      return;
    }

    try {
      await this._git(['fetch', 'origin', this.branch]);
      await this._git(['reset', '--hard', `origin/${this.branch}`]);
      this.lastPull = now;
    } catch (err) {
      console.error('Git pull failed:', err.message);
    }
  }

  async _commitAndPush(message) {
    // Stage all changes
    await this._git(['add', '-A']);

    // Check if there are changes to commit
    try {
      await this._git(['diff', '--cached', '--quiet']);
      return; // No changes
    } catch {
      // Has changes, continue
    }

    // Commit
    await this._git(['commit', '-m', message, '--author', this.commitAuthor]);

    // Skip push if no remote configured
    if (!this._hasRemote()) return;

    // Push with retry on conflict
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this._git(['push', 'origin', this.branch]);
        return;
      } catch (err) {
        if (attempt < 2 && err.message.includes('rejected')) {
          // Pull and rebase, then retry
          await this._git(['fetch', 'origin', this.branch]);
          await this._git(['rebase', `origin/${this.branch}`]);
        } else {
          throw err;
        }
      }
    }
  }

  _pathToFile(configPath) {
    // /config/app1/db -> config/app1/db.json
    const relativePath = configPath.startsWith('/') ? configPath.slice(1) : configPath;
    return join(this.localPath, relativePath + '.json');
  }

  _fileToPath(filePath) {
    // config/app1/db.json -> /config/app1/db
    const relative = filePath.replace(this.localPath, '').replace(/^\//, '');
    if (!relative.endsWith('.json')) return null;
    return '/' + relative.slice(0, -5);
  }

  async _readJsonFile(filePath) {
    try {
      const content = await readFile(filePath, 'utf8');
      const decrypted = this._decrypt(content.trim());
      return JSON.parse(decrypted);
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  async _writeJsonFile(filePath, data) {
    await mkdir(dirname(filePath), { recursive: true });
    const json = JSON.stringify(data, null, 2);
    const content = this._encrypt(json);
    await writeFile(filePath, content + '\n', 'utf8');
  }

  async _deleteFile(filePath) {
    try {
      await rm(filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  async _getAllFiles(dir, baseDir = dir) {
    const files = [];
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== '.git') {
            files.push(...await this._getAllFiles(fullPath, baseDir));
          }
        } else if (entry.name.endsWith('.json')) {
          files.push(fullPath);
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    return files;
  }

  async getByPrefix(pathPrefix) {
    return this._withLock(async () => {
      await this._pullIfNeeded();

      const results = [];
      const allFiles = await this._getAllFiles(this.localPath);

      for (const file of allFiles) {
        const configPath = this._fileToPath(file);
        if (!configPath) continue;

        // Check prefix match (boundary-safe)
        if (configPath !== pathPrefix && !configPath.startsWith(pathPrefix + '/')) {
          continue;
        }

        const content = await this._readJsonFile(file);
        if (content) {
          results.push({
            path: configPath,
            data: content.data,
            updatedAt: new Date(content.updatedAt),
          });
        }
      }

      return results;
    });
  }

  async getByPath(path) {
    return this._withLock(async () => {
      await this._pullIfNeeded();

      const filePath = this._pathToFile(path);
      const content = await this._readJsonFile(filePath);

      if (!content) return null;

      return {
        path,
        data: content.data,
        updatedAt: new Date(content.updatedAt),
      };
    });
  }

  async getByPathWithFilter(path, filters) {
    const doc = await this.getByPath(path);
    if (!doc) return null;

    if (!matchesFilter(doc.data, filters)) return null;

    return doc;
  }

  async upsert(path, data) {
    return this._withLock(async () => {
      await this._pullIfNeeded();

      const filePath = this._pathToFile(path);
      await this._writeJsonFile(filePath, {
        data,
        updatedAt: new Date().toISOString(),
      });

      await this._commitAndPush(`Update ${path}`);
    });
  }

  async deleteByPrefix(pathPrefix) {
    return this._withLock(async () => {
      await this._pullIfNeeded();

      const allFiles = await this._getAllFiles(this.localPath);
      let deletedCount = 0;

      for (const file of allFiles) {
        const configPath = this._fileToPath(file);
        if (!configPath) continue;

        if (configPath === pathPrefix || configPath.startsWith(pathPrefix + '/')) {
          await this._deleteFile(file);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        await this._commitAndPush(`Delete ${pathPrefix}`);
      }

      return deletedCount;
    });
  }

  async listPaths(pathPrefix) {
    return this._withLock(async () => {
      await this._pullIfNeeded();

      const allFiles = await this._getAllFiles(this.localPath);
      const paths = [];

      for (const file of allFiles) {
        const configPath = this._fileToPath(file);
        if (!configPath) continue;

        if (configPath === pathPrefix || configPath.startsWith(pathPrefix + '/')) {
          paths.push(configPath);
        }
      }

      return paths;
    });
  }

  async searchPaths(pattern) {
    return this._withLock(async () => {
      await this._pullIfNeeded();

      const regex = globToRegex(pattern);
      const allFiles = await this._getAllFiles(this.localPath);
      const paths = [];

      for (const file of allFiles) {
        const configPath = this._fileToPath(file);
        if (!configPath) continue;

        if (regex.test(configPath)) {
          paths.push(configPath);
        }
      }

      return paths;
    });
  }
}
