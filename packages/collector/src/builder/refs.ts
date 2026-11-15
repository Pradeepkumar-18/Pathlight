// `object_refs` rows from the object IDs inside captured values (`data-model.md` §3.4): where
// each object appeared, as a path like `args[0]`, `args[1].items[2]`, `return` or `request.body`.
import type { CapturedValue } from '@pathlight-tracker/protocol';

import type { NewObjectRef } from '../store/writes';

type Role = NewObjectRef['role'];

function typeName(value: CapturedValue): string {
  if (value.className !== undefined) return value.className;
  return value.type === 'array'
    ? 'Array'
    : value.type === 'map'
      ? 'Map'
      : value.type === 'set'
        ? 'Set'
        : 'Object';
}

function collect(
  value: CapturedValue,
  at: string,
  found: { objectId: string; path: string; typeName: string }[],
): void {
  if (value.objectId !== undefined)
    found.push({ objectId: value.objectId, path: at, typeName: typeName(value) });
  const children = value.children;
  if (Array.isArray(children)) {
    children.forEach((child, index) => collect(child, `${at}[${index}]`, found));
  } else if (children !== undefined) {
    for (const [key, child] of Object.entries(children)) {
      collect(
        child,
        /^[A-Za-z_$][\w$]*$/.test(key) ? `${at}.${key}` : `${at}[${JSON.stringify(key)}]`,
        found,
      );
    }
  }
}

export function refsFor(
  base: { requestId: string; stepId: string | null; createdAt: number },
  role: Role,
  value: CapturedValue | null | undefined,
  at: string,
): NewObjectRef[] {
  if (!value) return [];
  const found: { objectId: string; path: string; typeName: string }[] = [];
  collect(value, at, found);
  return found.map((ref) => ({
    ...base,
    role,
    objectId: ref.objectId,
    path: ref.path,
    typeName: ref.typeName,
  }));
}

export function argRefs(
  base: { requestId: string; stepId: string; createdAt: number },
  args: CapturedValue[] | undefined,
): NewObjectRef[] {
  return (args ?? []).flatMap((arg, index) => refsFor(base, 'arg', arg, `args[${index}]`));
}
