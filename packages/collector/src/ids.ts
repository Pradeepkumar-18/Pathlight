// Prefixed ULIDs (`data-model.md` §2): 48-bit millisecond time + 80 random bits, Crockford
// base32, 26 characters. Written in-house instead of adding a package (approved 2026-11-14).
import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeTime(ms: number): string {
  let value = ms;
  let out = '';
  for (let i = 0; i < 10; i += 1) {
    out = ALPHABET[value % 32] + out;
    value = Math.floor(value / 32);
  }
  return out;
}

function encodeRandom(): string {
  const bytes = randomBytes(16);
  let out = '';
  for (let i = 0; i < 16; i += 1) out += ALPHABET[(bytes[i] ?? 0) % 32];
  return out;
}

export function ulid(now: number = Date.now()): string {
  return encodeTime(now) + encodeRandom();
}

export const newSessionId = (now?: number): string => `ses_${ulid(now)}`;
export const newRequestId = (now?: number): string => `req_${ulid(now)}`;
export const newStepId = (now?: number): string => `stp_${ulid(now)}`;
