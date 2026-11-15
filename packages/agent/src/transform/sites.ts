// What the transform knows about each wrapped function, registered once per file and handed to
// the runtime on every call (`api-spec.md` §11.1 `step.enter` fields).
import type { StepKind } from '@pathlight-tracker/protocol';

export interface Site {
  name: string;
  kind: Extract<StepKind, 'function' | 'method'>;
  /** Original file relative to the project root, e.g. `src/orders/orders.service.ts`. */
  file: string;
  line: number;
  column: number;
  isAsync: boolean;
  thisClass?: string;
  /** Parameter names; `{…}` / `[…]` for destructured ones, `...rest` for a rest parameter. */
  argNames?: string[];
}

type Node = Record<string, unknown>;

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && typeof (value as Node).type === 'string';

/** SWC wraps function parameters in `Parameter` nodes (older: `Param`); arrows list the patterns directly. */
function patternOf(param: unknown): Node | null {
  if (!isNode(param)) return null;
  return (param.type === 'Parameter' || param.type === 'Param') && isNode(param.pat)
    ? param.pat
    : param;
}

function nameOf(pattern: Node | null): string {
  if (pattern === null) return '?';
  switch (pattern.type) {
    case 'Identifier':
      return String(pattern.value);
    case 'AssignmentPattern':
      return nameOf(patternOf(pattern.left));
    case 'RestElement':
      return `...${nameOf(patternOf(pattern.argument))}`;
    case 'ObjectPattern':
      return '{…}';
    case 'ArrayPattern':
      return '[…]';
    default:
      return '?';
  }
}

export function argNames(params: unknown): string[] {
  return Array.isArray(params) ? params.map((param) => nameOf(patternOf(param))) : [];
}

/**
 * For an arrow (which has no `arguments`): an expression for its argument values, or `void 0`
 * when a destructured parameter can't be referenced by name.
 */
export function arrowArgs(params: unknown): string {
  if (!Array.isArray(params)) return 'void 0';
  const parts: string[] = [];
  for (const param of params) {
    const pattern = patternOf(param);
    if (pattern?.type === 'Identifier') parts.push(String(pattern.value));
    else if (
      pattern?.type === 'AssignmentPattern' &&
      isNode(pattern.left) &&
      pattern.left.type === 'Identifier'
    )
      parts.push(String(pattern.left.value));
    else if (
      pattern?.type === 'RestElement' &&
      isNode(pattern.argument) &&
      pattern.argument.type === 'Identifier'
    )
      parts.push(`...${String(pattern.argument.value)}`);
    else parts.push('void 0');
  }
  return `[${parts.join(',')}]`;
}
