import { getStorage } from '../storage/index.js';
import { buildTree, deepMerge } from '../utils/tree.js';
import { notifyChange } from './notificationService.js';

export async function getSubtree(basePath) {
  const backend = getStorage();
  const docs = await backend.getByPrefix(basePath);

  if (docs.length === 0) {
    return null;
  }

  return buildTree(docs, basePath);
}

export async function patchNode(path, data) {
  const backend = getStorage();
  const existing = await backend.getByPath(path);

  let result;
  let operation;

  if (existing) {
    result = deepMerge(existing.data, data);
    await backend.upsert(path, result);
    operation = 'update';
  } else {
    await backend.upsert(path, data);
    result = data;
    operation = 'insert';
  }

  // Publish notification
  await notifyChange(operation, path, result);

  return result;
}

export async function putNode(path, data) {
  const backend = getStorage();
  const existing = await backend.getByPath(path);

  await backend.upsert(path, data);

  // Publish notification
  const operation = existing ? 'update' : 'insert';
  await notifyChange(operation, path, data);

  return data;
}

export async function deleteSubtree(basePath) {
  const backend = getStorage();

  // Get paths to delete for notifications
  const docs = await backend.getByPrefix(basePath);
  const count = await backend.deleteByPrefix(basePath);

  // Publish notifications for each deleted path
  for (const doc of docs) {
    await notifyChange('delete', doc.path);
  }

  return count;
}
