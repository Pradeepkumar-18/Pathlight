// The safe serializer (`api-spec.md` §4.1, `architecture.md` §5 `capture`): turns any runtime
// value into a `CapturedValue` with depth, length and size caps, circular references marked,
// and special types summarized. It never calls getters, `toJSON`, custom `inspect` hooks or a
// proxy's traps, so capturing a value can never change what the app does.
import type { CapturedValue } from '@pathlight-tracker/protocol';

import { errorSummary, inline, primitiveText, REDACTED, summary } from './preview';
import {
  binaryHead,
  className,
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
  mapHead,
  own,
  ownKeys,
  ownValue,
  setHead,
  sizeOfMap,
  sizeOfSet,
} from './safe';

/** Keys shown per object; the rest is marked truncated. */
export const MAX_KEYS = 50;
/** Bytes shown for binary data. */
const BINARY_HEAD = 16;

export interface CaptureOptions {
  maxDepth: number;
  maxArray: number;
  maxString: number;
  /** Key names whose values must never leave the app (task 3.4). */
  isSecretKey?: (key: string) => boolean;
  /** Stable IDs for objects, so the same object can be followed across steps (task 3.5). */
  objectIdOf?: (value: object) => string | undefined;
  /** Mark a top-level `undefined` as suspicious (arguments; decision 0016). */
  flagUndefined?: boolean;
}

const NEVER_SECRET = () => false;

const redacted = (): CapturedValue => ({ type: 'string', preview: REDACTED, redacted: true });

export function capture(value: unknown, options: CaptureOptions): CapturedValue {
  const walker = new Walker(options);
  const result = walker.walk(value, 0, false);
  if (options.flagUndefined && value === undefined) result.suspicious = true;
  return result;
}

class Walker {
  private readonly ancestors: object[] = [];
  private readonly isSecret: (key: string) => boolean;

  constructor(private readonly options: CaptureOptions) {
    this.isSecret = options.isSecretKey ?? NEVER_SECRET;
  }

  walk(value: unknown, depth: number, child: boolean): CapturedValue {
    if (value === null) return { type: 'null', preview: 'null' };
    switch (typeof value) {
      case 'string': {
        const result: CapturedValue = {
          type: 'string',
          preview: primitiveText(value, false, this.options.maxString),
        };
        if (value.length > this.options.maxString) {
          result.size = value.length;
          result.truncated = true;
        }
        return result;
      }
      case 'number': {
        const result: CapturedValue = { type: 'number', preview: String(value) };
        if (Number.isNaN(value)) result.suspicious = true;
        return result;
      }
      case 'boolean':
        return { type: 'boolean', preview: String(value) };
      case 'undefined':
        return child
          ? { type: 'undefined', preview: 'undefined', suspicious: true }
          : { type: 'undefined', preview: 'undefined' };
      case 'bigint':
        return { type: 'bigint', preview: primitiveText(value, false, this.options.maxString) };
      case 'symbol':
        return { type: 'symbol', preview: primitiveText(value, false, this.options.maxString) };
      case 'function':
        return { type: 'function', preview: `[Function ${functionName(value) || '(anonymous)'}]` };
      default:
        return this.object(value as object, depth);
    }
  }

  private object(value: object, depth: number): CapturedValue {
    if (this.ancestors.includes(value)) return { type: 'circular', preview: '[Circular]' };
    if (isProxy(value)) return { type: 'object', className: 'Proxy', preview: 'Proxy' };
    const result = this.shape(value);
    const objectId = this.options.objectIdOf?.(value);
    if (objectId !== undefined) result.objectId = objectId;
    if (!['object', 'array', 'map', 'set', 'error'].includes(result.type)) return result;

    const entries = this.entries(value, result);
    if (entries.length === 0) return result;
    if (depth >= this.options.maxDepth) {
      result.truncated = true;
      return result;
    }
    this.ancestors.push(value);
    try {
      if (result.type === 'array' || result.type === 'set') {
        result.children = entries.map(([, item]) => this.walk(item, depth + 1, true));
      } else {
        const children: Record<string, CapturedValue> = {};
        for (const [key, item, kind] of entries) {
          children[key] =
            kind === 'secret'
              ? redacted()
              : kind === 'accessor'
                ? { type: 'function', preview: '[Getter]' }
                : this.walk(item, depth + 1, true);
        }
        result.children = children;
      }
    } finally {
      this.ancestors.pop();
    }
    return result;
  }

  /** Type, class and preview of an object-like value, without its children. */
  private shape(value: object): CapturedValue {
    const name = className(value);
    const withClass = (result: CapturedValue): CapturedValue =>
      name && name !== 'Object' && name !== 'Array' ? { ...result, className: name } : result;
    if (isDate(value)) return { type: 'date', preview: summary(value, this.isSecret) };
    if (isError(value)) return withClass({ type: 'error', preview: errorSummary(value) });
    if (isPromise(value)) return { type: 'promise', preview: 'Promise' };
    if (isRegExp(value))
      return { type: 'object', className: 'RegExp', preview: summary(value, this.isSecret) };
    if (isWeak(value)) return withClass({ type: 'object', preview: summary(value, this.isSecret) });
    if (isBinary(value)) {
      const { bytes, head } = binaryHead(value, BINARY_HEAD);
      const hex = head.map((byte) => byte.toString(16).padStart(2, '0')).join(' ');
      const result = withClass({
        type: 'buffer',
        preview: `<${name ?? 'Buffer'} ${hex}${bytes > BINARY_HEAD ? ' …' : ''}> (${bytes} bytes)`,
        size: bytes,
      });
      if (bytes > BINARY_HEAD) result.truncated = true;
      return result;
    }
    if (isMap(value))
      return withClass({
        type: 'map',
        preview: summary(value, this.isSecret),
        size: sizeOfMap(value),
      });
    if (isSet(value))
      return withClass({
        type: 'set',
        preview: summary(value, this.isSecret),
        size: sizeOfSet(value),
      });
    if (Array.isArray(value)) {
      const length = ownValue(value, 'length') as number;
      return withClass({ type: 'array', preview: summary(value, this.isSecret), size: length });
    }
    const document = mongooseFields(value);
    if (document) {
      return {
        type: 'object',
        className: document.model,
        preview: `${document.model} ${summary(document.fields, this.isSecret).replace(/^Object /, '')}`,
        size: ownKeys(document.fields).length,
      };
    }
    const objectId = bsonObjectId(value, name);
    if (objectId) return { type: 'object', className: 'ObjectId', preview: objectId };
    return withClass({
      type: 'object',
      preview: summary(value, this.isSecret),
      size: ownKeys(value).length,
    });
  }

  /** The children to walk: [key, value, kind], capped by the array and key limits. */
  private entries(
    value: object,
    result: CapturedValue,
  ): [string, unknown, 'value' | 'accessor' | 'secret'][] {
    const { maxArray } = this.options;
    const out: [string, unknown, 'value' | 'accessor' | 'secret'][] = [];
    const cut = (total: number, shown: number) => {
      if (total > shown) result.truncated = true;
    };
    if (result.type === 'array') {
      const length = ownValue(value, 'length') as number;
      for (let i = 0; i < Math.min(length, maxArray); i += 1)
        out.push([String(i), ownValue(value, String(i)), 'value']);
      cut(length, out.length);
      return out;
    }
    if (result.type === 'set') {
      const items = setHead(value as Set<unknown>, maxArray);
      items.forEach((item, i) => out.push([String(i), item, 'value']));
      cut(sizeOfSet(value as Set<unknown>), items.length);
      return out;
    }
    if (result.type === 'map') {
      const items = mapHead(value as Map<unknown, unknown>, maxArray);
      for (const [key, item] of items) {
        const label = typeof key === 'string' ? key : inline(key, this.isSecret);
        out.push([label, item, typeof key === 'string' && this.isSecret(key) ? 'secret' : 'value']);
      }
      cut(sizeOfMap(value as Map<unknown, unknown>), items.length);
      return out;
    }
    const fields = result.type === 'error' ? value : (mongooseFields(value)?.fields ?? value);
    const keys = ownKeys(fields);
    for (const key of keys.slice(0, MAX_KEYS)) {
      if (this.isSecret(key)) {
        out.push([key, undefined, 'secret']);
        continue;
      }
      const read = own(fields, key);
      out.push([
        key,
        read.kind === 'value' ? read.value : undefined,
        read.kind === 'accessor' ? 'accessor' : 'value',
      ]);
    }
    if (result.type === 'error') {
      // The message is the useful part of an error; it is an own, non-enumerable property.
      const message = ownValue(value, 'message');
      if (typeof message === 'string') out.unshift(['message', message, 'value']);
    }
    cut(keys.length, Math.min(keys.length, MAX_KEYS));
    return out;
  }
}

/** A Mongoose document's own fields (`_doc`), read without calling `toObject` or getters. */
function mongooseFields(value: object): { model: string; fields: object } | null {
  if (own(value, '$__').kind !== 'value') return null;
  const fields = ownValue(value, '_doc');
  if (fields === null || typeof fields !== 'object' || isProxy(fields)) return null;
  const prototype = Object.getPrototypeOf(value) as object | null;
  const model = prototype ? ownValue(prototype, 'constructor') : undefined;
  const modelName = typeof model === 'function' ? ownValue(model, 'modelName') : undefined;
  return { model: typeof modelName === 'string' ? modelName : 'Document', fields };
}

/** A BSON ObjectId as `ObjectId("…")`, from the 12 bytes it keeps in an own property. */
function bsonObjectId(value: object, name: string | undefined): string | null {
  if (name !== 'ObjectId') return null;
  for (const key of Reflect.ownKeys(value)) {
    const bytes = ownValue(value, key);
    if (bytes !== null && typeof bytes === 'object' && isBinary(bytes)) {
      const { bytes: length, head } = binaryHead(bytes, 12);
      if (length === 12)
        return `ObjectId("${head.map((byte) => byte.toString(16).padStart(2, '0')).join('')}")`;
    }
  }
  return null;
}
