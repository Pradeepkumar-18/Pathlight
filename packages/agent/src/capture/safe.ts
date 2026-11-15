// Reading user values without running user code (`architecture.md` §9): only own data
// properties are read, never getters, proxies' traps, `toJSON` or custom `inspect` hooks.
// Built-in methods are called through the built-in prototypes, so a user subclass that
// overrides them is never invoked.
import { types } from 'node:util';

const mapSize = Object.getOwnPropertyDescriptor(Map.prototype, 'size')?.get;
const setSize = Object.getOwnPropertyDescriptor(Set.prototype, 'size')?.get;
const mapEntries = Map.prototype.entries;
const setValues = Set.prototype.values;
const dateTime = Date.prototype.getTime;
const dateIso = Date.prototype.toISOString;
const regexpText = RegExp.prototype.toString;
const symbolText = Symbol.prototype.toString;

export type Own =
  | { kind: 'value'; value: unknown }
  | { kind: 'accessor'; get: boolean; set: boolean }
  | { kind: 'missing' };

/** One own property, without triggering a getter. Never call this on a proxy. */
export function own(target: object, key: string | symbol): Own {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (!descriptor) return { kind: 'missing' };
  if ('value' in descriptor) return { kind: 'value', value: descriptor.value };
  return { kind: 'accessor', get: descriptor.get !== undefined, set: descriptor.set !== undefined };
}

export function ownValue(target: object, key: string | symbol): unknown {
  const read = own(target, key);
  return read.kind === 'value' ? read.value : undefined;
}

/** The class name from the prototype chain's `constructor`, if it is a plain data property. */
export function className(value: object): string | undefined {
  const prototype = Object.getPrototypeOf(value) as object | null;
  if (prototype === null) return undefined;
  const constructor = ownValue(prototype, 'constructor');
  if (typeof constructor !== 'function') return undefined;
  const name = ownValue(constructor, 'name');
  return typeof name === 'string' && name !== '' ? name : undefined;
}

export function functionName(value: object): string {
  const name = ownValue(value, 'name');
  return typeof name === 'string' ? name : '';
}

/** Own enumerable string keys, in insertion order (what `Object.keys` returns, trap-free). */
export function ownKeys(value: object): string[] {
  return Object.keys(value);
}

export function sizeOfMap(value: Map<unknown, unknown>): number {
  return (mapSize?.call(value) as number | undefined) ?? 0;
}

export function sizeOfSet(value: Set<unknown>): number {
  return (setSize?.call(value) as number | undefined) ?? 0;
}

/** Up to `limit` entries of a Map, through the built-in iterator. */
export function mapHead(value: Map<unknown, unknown>, limit: number): [unknown, unknown][] {
  const out: [unknown, unknown][] = [];
  const iterator = mapEntries.call(value);
  for (let next = iterator.next(); !next.done && out.length < limit; next = iterator.next())
    out.push(next.value);
  return out;
}

export function setHead(value: Set<unknown>, limit: number): unknown[] {
  const out: unknown[] = [];
  const iterator = setValues.call(value);
  for (let next = iterator.next(); !next.done && out.length < limit; next = iterator.next())
    out.push(next.value);
  return out;
}

export function dateText(value: Date): string {
  return Number.isNaN(dateTime.call(value)) ? 'Invalid Date' : dateIso.call(value);
}

export function regexpString(value: RegExp): string {
  return regexpText.call(value);
}

export function symbolString(value: symbol): string {
  return symbolText.call(value);
}

export const isProxy = types.isProxy;
export const isPromise = types.isPromise;
export const isDate = types.isDate;
export const isRegExp = types.isRegExp;
export const isMap = types.isMap;
export const isSet = types.isSet;
export const isWeak = (value: object) => types.isWeakMap(value) || types.isWeakSet(value);
export const isError = types.isNativeError;
export const isBinary = (value: object) =>
  types.isAnyArrayBuffer(value) || ArrayBuffer.isView(value);

const builtinGetter = (prototype: object, key: string) =>
  Object.getOwnPropertyDescriptor(prototype, key)?.get;
const TYPED = Object.getPrototypeOf(Uint8Array.prototype) as object;
const typedBuffer = builtinGetter(TYPED, 'buffer');
const typedOffset = builtinGetter(TYPED, 'byteOffset');
const typedLength = builtinGetter(TYPED, 'byteLength');
const viewBuffer = builtinGetter(DataView.prototype, 'buffer');
const viewOffset = builtinGetter(DataView.prototype, 'byteOffset');
const viewLength = builtinGetter(DataView.prototype, 'byteLength');
const arrayBufferLength = builtinGetter(ArrayBuffer.prototype, 'byteLength');
const sharedLength = builtinGetter(SharedArrayBuffer.prototype, 'byteLength');

/** Byte length and the first `limit` bytes, without copying the rest (50 MB stays 50 MB). */
export function binaryHead(value: object, limit: number): { bytes: number; head: number[] } {
  let buffer: ArrayBufferLike;
  let offset = 0;
  let bytes: number;
  if (types.isDataView(value)) {
    buffer = viewBuffer?.call(value) as ArrayBufferLike;
    offset = viewOffset?.call(value) as number;
    bytes = viewLength?.call(value) as number;
  } else if (ArrayBuffer.isView(value)) {
    buffer = typedBuffer?.call(value) as ArrayBufferLike;
    offset = typedOffset?.call(value) as number;
    bytes = typedLength?.call(value) as number;
  } else {
    buffer = value as ArrayBufferLike;
    bytes = (
      types.isSharedArrayBuffer(value) ? sharedLength?.call(value) : arrayBufferLength?.call(value)
    ) as number;
  }
  const head = Array.from(new Uint8Array(buffer, offset, Math.min(limit, bytes)));
  return { bytes, head };
}
