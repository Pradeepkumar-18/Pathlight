// Opaque pagination cursors (`api-spec.md` §9): base64url JSON holding the sort, a hash of the
// filters and the last row's sort key and ID. A cursor only works with the same sort and filters.
import { createHash } from 'node:crypto';

export interface CursorPosition {
  /** The last row's sort key (a number for every sort the API offers). */
  key: number;
  id: string;
}

interface CursorBody extends CursorPosition {
  sort: string;
  filters: string;
}

/** The API maps this to `400 INVALID_CURSOR`. */
export class InvalidCursorError extends Error {
  readonly code = 'INVALID_CURSOR';
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCursorError';
  }
}

/** Stable fingerprint of the filters, independent of key order. */
export function filtersHash(filters: object): string {
  const sorted = JSON.stringify(filters, Object.keys(filters).sort());
  return createHash('sha256').update(sorted).digest('base64url').slice(0, 16);
}

export function encodeCursor(sort: string, filters: object, position: CursorPosition): string {
  const body: CursorBody = {
    sort,
    filters: filtersHash(filters),
    key: position.key,
    id: position.id,
  };
  return Buffer.from(JSON.stringify(body)).toString('base64url');
}

export function decodeCursor(cursor: string, sort: string, filters: object): CursorPosition {
  let body: unknown;
  try {
    body = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new InvalidCursorError('The cursor is malformed.');
  }
  const candidate = body as Partial<CursorBody> | null;
  if (
    typeof candidate !== 'object' ||
    candidate === null ||
    typeof candidate.key !== 'number' ||
    typeof candidate.id !== 'string' ||
    typeof candidate.sort !== 'string' ||
    typeof candidate.filters !== 'string'
  ) {
    throw new InvalidCursorError('The cursor is malformed.');
  }
  if (candidate.sort !== sort || candidate.filters !== filtersHash(filters)) {
    throw new InvalidCursorError('The cursor belongs to another sort order or other filters.');
  }
  return { key: candidate.key, id: candidate.id };
}
