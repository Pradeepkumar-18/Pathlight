// Short display text for a captured value (`data-model.md` §6), e.g.
// `User { id: 7, name: "Ravi", tier: undefined }`, `[2 items]`, `Map(2) { "a" => 1, … }`.
// Built only through the safe readers: making a preview never runs user code either.
import {
  binaryHead,
  className,
  dateText,
  functionName,
  isBinary,
  isDate,
  isError,
  isMap,
  isPromise,
  isProxy,
  isRegExp,
  isSet,
  isWeak,
  own,
  ownKeys,
  ownValue,
  regexpString,
  sizeOfMap,
  sizeOfSet,
  symbolString,
} from './safe';

/** Previews stay one short line; the inspector shows the rest from `children`. */
export const PREVIEW_LENGTH = 120;
const INLINE_STRING = 40;
const INLINE_ITEMS = 3;

export const REDACTED = '[REDACTED]';

export function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function errorSummary(error: object): string {
  const name = ownValue(error, 'name') ?? className(error) ?? 'Error';
  const message = ownValue(error, 'message');
  return `${typeof name === 'string' ? name : 'Error'}: ${typeof message === 'string' ? clip(message, INLINE_STRING * 2) : ''}`;
}

export function primitiveText(value: unknown, quoteStrings: boolean, max: number): string {
  switch (typeof value) {
    case 'string':
      return quoteStrings ? JSON.stringify(clip(value, max)) : clip(value, max);
    case 'bigint':
      return `${value}n`;
    case 'symbol':
      return symbolString(value);
    case 'undefined':
      return 'undefined';
    default:
      return String(value); // number, boolean, null: no user code involved
  }
}

/** A value inside another value's preview: one level only. */
export function inline(value: unknown, isSecret: (key: string) => boolean): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'function') return `[Function ${functionName(value) || '(anonymous)'}]`;
    return primitiveText(value, true, INLINE_STRING);
  }
  if (isProxy(value)) return 'Proxy';
  if (Array.isArray(value)) {
    const length = ownValue(value, 'length') as number;
    const items: string[] = [];
    for (let i = 0; i < Math.min(length, INLINE_ITEMS); i += 1) {
      const item: unknown = ownValue(value, String(i));
      items.push(item !== null && typeof item === 'object' ? '…' : inline(item, isSecret));
    }
    return `[${items.join(', ')}${length > INLINE_ITEMS ? ', …' : ''}]`;
  }
  return summary(value, isSecret, true);
}

/** The top-level preview of an object-like value. */
export function summary(value: object, isSecret: (key: string) => boolean, nested = false): string {
  if (isDate(value)) return dateText(value);
  if (isRegExp(value)) return regexpString(value);
  if (isError(value)) return errorSummary(value);
  if (isPromise(value)) return 'Promise';
  if (isWeak(value)) return className(value) ?? 'WeakMap';
  if (isBinary(value)) {
    const { bytes } = binaryHead(value, 0);
    return `<${className(value) ?? 'Buffer'} ${bytes} bytes>`;
  }
  if (isMap(value)) return `Map(${sizeOfMap(value)})${nested ? '' : ' {…}'}`;
  if (isSet(value)) return `Set(${sizeOfSet(value)})${nested ? '' : ' {…}'}`;
  if (Array.isArray(value)) {
    const length = ownValue(value, 'length') as number;
    return `[${length} ${length === 1 ? 'item' : 'items'}]`;
  }
  const name = className(value);
  const prefix = name && name !== 'Object' ? `${name} ` : '';
  if (nested) return `${prefix}{…}`;
  return `${prefix}${objectBody(value, isSecret)}`;
}

function objectBody(value: object, isSecret: (key: string) => boolean): string {
  const keys = ownKeys(value);
  if (keys.length === 0) return '{}';
  let text = '{ ';
  for (const [index, key] of keys.entries()) {
    const read = own(value, key);
    const shown = isSecret(key)
      ? REDACTED
      : read.kind === 'accessor'
        ? '[Getter]'
        : inline(read.kind === 'value' ? read.value : undefined, isSecret);
    const part = `${index > 0 ? ', ' : ''}${key}: ${shown}`;
    if (text.length + part.length > PREVIEW_LENGTH) return `${text}${index > 0 ? ', ' : ''}… }`;
    text += part;
  }
  return `${text} }`;
}
