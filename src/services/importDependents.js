import { getStorage } from '../storage/index.js';
import { collectImportSources, hasImports, pathsRelated } from '../utils/imports.js';

/**
 * Find configs that (transitively) import any of the changed paths.
 * An importer depends on a path when one of its import sources equals, is an
 * ancestor of, or is a descendant of that path.
 *
 * Scans storage rather than keeping an in-memory index so the result is
 * correct on every instance regardless of how a change arrived.
 *
 * @param {string[]} changedPaths
 * @returns {Promise<string[]>} importer paths, excluding the changed paths
 */
export async function findDependents(changedPaths) {
  const docs = await getStorage().getByPrefix('/config');

  const importers = docs
    .filter((doc) => hasImports(doc.data))
    .map((doc) => ({ path: doc.path, sources: collectImportSources(doc.data) }))
    .filter((importer) => importer.sources.length > 0);

  if (importers.length === 0) return [];

  const changed = new Set(changedPaths);
  const affected = new Set();
  const queue = [...changedPaths];

  while (queue.length > 0) {
    const current = queue.shift();

    for (const importer of importers) {
      if (changed.has(importer.path) || affected.has(importer.path)) continue;
      if (importer.sources.some((source) => pathsRelated(source, current))) {
        affected.add(importer.path);
        queue.push(importer.path);
      }
    }
  }

  return [...affected];
}
