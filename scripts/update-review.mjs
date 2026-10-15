import { createHash } from 'node:crypto';
import { DataQualityError, updateIssues } from '../src/data-quality.mjs';
import { validateSnapshot } from '../src/snapshot.mjs';

// Retrieval timestamps change on every fetch; approval binds to the actual candidate
// and baseline instead. Sorting keys makes object serialization order immaterial.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export function changeFingerprint(previous, next) {
  const data = { previous: { updatedAt: previous.updatedAt, layers: previous.layers, quality: previous.quality },
    next: { modelVersion: next.modelVersion, populationYear: next.populationYear, layers: next.layers, quality: next.quality } };
  return createHash('sha256').update(JSON.stringify(canonical(data))).digest('hex');
}

export function reviewUpdate(previous, next, { token, reason, now = Date.now() } = {}) {
  validateSnapshot(next, now);
  if (next.populationYear < previous.populationYear) throw new Error('Vanemat rahvastikuaastat ei saa vastu võtta.');
  const issues = updateIssues(previous, next);
  const fingerprint = changeFingerprint(previous, next);
  if (token !== undefined && (token !== fingerprint || typeof reason !== 'string' || reason.trim().length < 10)) {
    throw new Error('Ülevaatuse tunnus ei vasta sellele andmeversioonile või sisuline põhjendus puudub.');
  }
  if (issues.length && !token) {
    const error = new DataQualityError(issues);
    error.review = { fingerprint, previousUpdatedAt: previous.updatedAt, candidateUpdatedAt: next.updatedAt, issues };
    throw error;
  }
  return token ? { ...next, changeReview: { fingerprint, previousUpdatedAt: previous.updatedAt,
    acceptedAt: new Date(now).toISOString(), reason: reason.trim(), issues } } : next;
}
