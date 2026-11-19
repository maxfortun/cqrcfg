export const TEMPLATE_NAME = '___template';

/**
 * Candidate template paths for a new config, nearest first:
 * `<newPath>/___template`, then `<parent>/___template` for each ancestor
 * up to (and including) the root segment, e.g. `/config/___template`.
 */
export function templateCandidates(newPath) {
  const segments = String(newPath || '').split('/').filter(Boolean);
  const candidates = [];
  for (let i = segments.length; i >= 1; i--) {
    candidates.push(`/${segments.slice(0, i).join('/')}/${TEMPLATE_NAME}`);
  }
  return candidates;
}
