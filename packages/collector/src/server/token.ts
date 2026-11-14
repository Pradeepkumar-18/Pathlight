// The per-project token (`api-spec.md` §3, decision 0015): 32 random bytes, base64url, kept in
// `.pathlight-tracker/token` (0600) so saved links survive restarts. Deleting the file rotates it.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const TOKEN_FILE = 'token';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function loadOrCreateToken(storeDir: string): string {
  const file = path.join(storeDir, TOKEN_FILE);
  if (existsSync(file)) {
    const saved = readFileSync(file, 'utf8').trim();
    if (TOKEN_PATTERN.test(saved)) return saved;
  }
  mkdirSync(storeDir, { recursive: true, mode: 0o700 });
  const token = randomBytes(32).toString('base64url');
  writeFileSync(file, `${token}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);
  return token;
}

/** Constant-time comparison, so response timing never leaks how much of a guess was right. */
export function tokensMatch(expected: string, given: string | undefined): boolean {
  if (given === undefined) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}
