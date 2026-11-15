// Redaction (`architecture.md` §8, §9): secret keys are recognised by name, and their values are
// replaced before they are ever read, so a secret never leaves the app. Keys are compared
// lower-cased with `-` and `_` removed, so `accessToken`, `x-api-key`, `set-cookie` and
// `Authorization` all match.
import { REDACTED } from './preview';

/** Matched anywhere in the key: long enough not to hide ordinary fields by accident. */
export const SECRET_WORDS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'authorization',
  'cookie',
  'apikey',
  'accesskey',
  'privatekey',
  'credential',
  'session',
  'jwt',
] as const;

/** Matched only as the whole key: as parts of words they hit `notPaid`, `shipping`, … */
export const SECRET_EXACT = ['otp', 'pin', 'cvv'] as const;

/** Bounded so a stream of distinct keys can't grow memory. */
const CACHE_LIMIT = 2000;

export function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[-_]/g, '');
}

export interface Redactor {
  isSecretKey: (key: string) => boolean;
  /** `https://x/cb?token=abc&page=2` → `https://x/cb?token=[REDACTED]&page=2`. */
  redactUrl: (url: string) => string;
}

/** `extraKeys` come from `PATHLIGHT_TRACKER_REDACT_KEYS` and match like the built-in words. */
export function createRedactor(extraKeys: readonly string[] = []): Redactor {
  const words = [...SECRET_WORDS, ...extraKeys.map(normaliseKey).filter((word) => word.length > 0)];
  const exact = new Set<string>(SECRET_EXACT);
  const cache = new Map<string, boolean>();

  function isSecretKey(key: string): boolean {
    const known = cache.get(key);
    if (known !== undefined) return known;
    const normalised = normaliseKey(key);
    const secret = exact.has(normalised) || words.some((word) => normalised.includes(word));
    if (cache.size >= CACHE_LIMIT) cache.clear();
    cache.set(key, secret);
    return secret;
  }

  function redactUrl(url: string): string {
    const query = url.indexOf('?');
    if (query === -1) return url;
    const hash = url.indexOf('#', query);
    const end = hash === -1 ? url.length : hash;
    const params = url
      .slice(query + 1, end)
      .split('&')
      .map((pair) => {
        const equals = pair.indexOf('=');
        const name = equals === -1 ? pair : pair.slice(0, equals);
        let decoded = name;
        try {
          decoded = decodeURIComponent(name);
        } catch {
          // Malformed escapes: match on the raw name.
        }
        return equals !== -1 && isSecretKey(decoded) ? `${name}=${REDACTED}` : pair;
      });
    return `${url.slice(0, query + 1)}${params.join('&')}${url.slice(end)}`;
  }

  return { isSecretKey, redactUrl };
}
