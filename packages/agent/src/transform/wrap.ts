// The load-time transform (`architecture.md` §3b, decision 0002): wraps every function, method,
// static method, arrow (including arrow class fields) and async function so it reports enter /
// exit / throw to the runtime, without changing what the code does. Getters, setters,
// constructors (v1) and generators are left alone. Returns `null` when the code can't be parsed
// or the result wouldn't parse, so the caller loads the original file.
import { parseSync } from '@swc/core';

import { apply, freeNames, positions } from './edits';
import type { Insertion } from './edits';
import { argNames, arrowArgs } from './sites';
import type { Site } from './sites';

export interface WrapOptions {
  /** Module the wrapped code `require`s: the runtime. */
  runtimePath: string;
  /** Original file shown in the map, e.g. `src/orders/orders.service.ts`. */
  file: string;
  /** Compiled 1-based line / 0-based column → original 1-based line / column, or null (generated code). */
  originFor: (line: number, column: number) => { line: number; column: number } | null;
}

type Node = Record<string, unknown>;

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && typeof (value as Node).type === 'string';
const spanOf = (node: Node) => node.span as { start: number; end: number };

function keyName(key: unknown): string {
  if (!isNode(key)) return '(anonymous)';
  if (key.type === 'Identifier' || key.type === 'StringLiteral') return String(key.value);
  // SWC 1.16 keeps the name on the node itself; older versions under `id`.
  if (key.type === 'PrivateName')
    return `#${String(key.value ?? (key.id as Node | undefined)?.value ?? '')}`;
  return '[computed]';
}

const PARSE = { syntax: 'ecmascript', target: 'es2022' } as const;

interface Context {
  className: string;
  /** Name given by the surrounding declaration (`const f = () => …`, `key: function () {}`). */
  pendingName: string | null;
  /** The surrounding class field: an arrow there gets the instance as `this`. */
  classField: boolean;
  depth: number;
  /** The enclosing function has a probe, so its `return`s are routed through the runtime. */
  wrapped: boolean;
}

export function wrapFunctions(code: string, options: WrapOptions): string | null {
  // A leading `;` pins SWC's span base to byte 0 of our input; a shebang is blanked (same
  // length) because it is only legal as the very first bytes.
  const source = code.startsWith('#!')
    ? code.replace(/^#![^\n]*/, (m) => ' '.repeat(m.length))
    : code;
  let program: Node;
  try {
    program = parseSync(`;${source}`, PARSE) as unknown as Node;
  } catch {
    return null;
  }
  const base = spanOf(program).start + 1;
  const names = freeNames(code);
  const bytes = Buffer.from(code, 'utf8');
  const positionOf = positions(bytes);
  const insertions: Insertion[] = [];
  const sites: Site[] = [];
  const tail = `}catch(${names.error}){${names.runtime}.throw(${names.probe},${names.error});throw ${names.error}}finally{${names.runtime}.exit(${names.probe})}`;
  const returnOpen = `${names.runtime}.ret(${names.probe},(`;

  /** Registers the function's site; null for compiler-generated code (no original position). */
  const siteFor = (fn: Node, at: number, name: string, kind: Site['kind'], className: string) => {
    const { line, column } = positionOf(at);
    const origin = options.originFor(line, column);
    if (origin === null) return null;
    const site: Site = {
      name,
      kind,
      file: options.file,
      line: origin.line,
      column: origin.column + 1,
      isAsync: fn.async === true,
      argNames: argNames(fn.params),
    };
    if (kind === 'method' && className) site.thisClass = className;
    sites.push(site);
    return sites.length - 1;
  };

  /** Wraps `fn`; returns whether its block body now has a probe (so its `return`s get routed). */
  const wrap = (
    fn: Node,
    at: number,
    name: string,
    kind: Site['kind'],
    context: Context,
    arrow: boolean,
  ): boolean => {
    // Generators run lazily: try / finally would report the wrong timing.
    if (fn.generator === true) return false;
    const body = fn.body;
    if (!isNode(body)) return false;
    const index = siteFor(fn, at, name, kind, context.className);
    if (index === null) return false;
    // `arguments` and `this` are the function's own, except in arrows: there `this` is only
    // passed for class fields (elsewhere it could be a derived constructor's `this` before
    // `super()`), and the arguments are the parameters themselves.
    const self = arrow ? (context.classField ? 'this' : 'void 0') : 'this';
    const args = arrow ? arrowArgs(fn.params) : 'arguments';
    const opening = `;const ${names.probe}=${names.runtime}.enter(${names.sites}[${index}],${self},${args});try{`;
    const depth = context.depth + 1;
    const span = spanOf(body);
    if (body.type === 'FunctionBody' || body.type === 'BlockStatement') {
      // Keep a "use strict" directive first, or the function would lose strict mode.
      let start = span.start - base + 1;
      for (const stmt of (body.stmts as Node[] | undefined) ?? []) {
        const expression = stmt.expression as Node | undefined;
        if (stmt.type !== 'ExpressionStatement' || expression?.type !== 'StringLiteral') break;
        start = spanOf(stmt).end - base;
      }
      insertions.push({ offset: start, text: opening, closing: false, depth });
      insertions.push({ offset: span.end - base - 1, text: tail, closing: true, depth });
      return true;
    }
    // Expression body: `x => x + 1` becomes `x => {…return ret(probe,(x + 1))…}`.
    insertions.push({
      offset: span.start - base,
      text: `{${opening}return ${returnOpen}`,
      closing: false,
      depth,
    });
    insertions.push({ offset: span.end - base, text: `))${tail}}`, closing: true, depth });
    return false;
  };

  const visit = (value: unknown, context: Context): void => {
    const plain: Context = { ...context, pendingName: null, classField: false };
    if (Array.isArray(value)) {
      for (const item of value) visit(item, plain);
      return;
    }
    if (!isNode(value)) {
      if (typeof value === 'object' && value !== null)
        for (const child of Object.values(value)) visit(child, plain);
      return;
    }
    const node = value;
    // Some SWC nodes (e.g. `KeyValueProperty`) carry no span.
    const at = ((node.span as { start: number } | undefined)?.start ?? base) - base;
    const inner = (wrapped: boolean): Context => ({ ...plain, depth: context.depth + 1, wrapped });
    switch (node.type) {
      case 'FunctionDeclaration':
      case 'FunctionExpression': {
        const own = isNode(node.identifier) ? String(node.identifier.value) : null;
        const name = own ?? context.pendingName ?? '(anonymous)';
        const kind = context.classField ? 'method' : 'function';
        visit(node.body, inner(wrap(node, at, name, kind, context, false)));
        visit(node.params, inner(false));
        return;
      }
      case 'ArrowFunctionExpression': {
        const kind = context.classField ? 'method' : 'function';
        visit(
          node.body,
          inner(wrap(node, at, context.pendingName ?? '(anonymous)', kind, context, true)),
        );
        visit(node.params, inner(false));
        return;
      }
      case 'ClassDeclaration':
      case 'ClassExpression': {
        const name = isNode(node.identifier)
          ? String(node.identifier.value)
          : (context.pendingName ?? '(anonymous class)');
        visit(node.body, { ...plain, className: name, wrapped: false });
        visit(node.decorators, plain);
        visit(node.superClass, plain);
        return;
      }
      case 'ClassMethod':
      case 'PrivateMethod': {
        const fn = node.function as Node;
        // Getters and setters are never tracked (PRD: reading can cause side effects).
        const name = `${context.className}.${keyName(node.key)}`;
        const wrapped = node.kind === 'method' && wrap(fn, at, name, 'method', context, false);
        visit(fn.body, inner(wrapped));
        visit(fn.params, inner(false));
        visit(fn.decorators, plain);
        visit(node.key, plain);
        return;
      }
      case 'ClassProperty':
      case 'PrivateProperty':
        visit(node.value, {
          ...plain,
          pendingName: `${context.className}.${keyName(node.key)}`,
          classField: true,
          wrapped: false,
        });
        visit(node.decorators, plain);
        visit(node.key, plain);
        return;
      case 'MethodProperty': {
        visit(node.body, inner(wrap(node, at, keyName(node.key), 'function', context, false)));
        visit(node.params, inner(false));
        visit(node.key, plain);
        return;
      }
      case 'KeyValueProperty':
        visit(node.value, { ...context, pendingName: keyName(node.key), classField: false });
        visit(node.key, plain);
        return;
      case 'VariableDeclarator': {
        const id = node.id as Node;
        visit(node.init, {
          ...context,
          pendingName: id.type === 'Identifier' ? String(id.value) : null,
          classField: false,
        });
        visit(node.id, plain);
        return;
      }
      case 'AssignmentExpression': {
        const left = node.left as Node;
        const name =
          left.type === 'MemberExpression'
            ? keyName(left.property)
            : left.type === 'Identifier'
              ? String(left.value)
              : null;
        visit(node.right, { ...context, pendingName: name, classField: false });
        visit(node.left, plain);
        return;
      }
      case 'ReturnStatement': {
        const argument = node.argument;
        if (context.wrapped && isNode(argument)) {
          const span = spanOf(argument);
          // Half a level deeper than the function's own tail, so at a shared offset
          // (`{return 1}`) the return's `))` closes before the tail does.
          const depth = context.depth + 0.5;
          insertions.push({ offset: span.start - base, text: returnOpen, closing: false, depth });
          insertions.push({ offset: span.end - base, text: '))', closing: true, depth });
        }
        visit(argument, plain);
        return;
      }
      case 'Constructor':
      case 'GetterProperty':
      case 'SetterProperty':
        // Constructors arrive in v1; getters and setters are never tracked. Functions nested
        // inside them are still user code worth wrapping.
        visit(node.body ?? node.function, inner(false));
        return;
      default:
        for (const [key, child] of Object.entries(node)) if (key !== 'span') visit(child, plain);
    }
  };
  visit(program.body, {
    className: '',
    pendingName: null,
    classField: false,
    depth: 0,
    wrapped: false,
  });
  if (insertions.length === 0) return code;

  // Leading `;` ends a directive written without one. A shebang must stay first; a file-level
  // "use strict" must stay before any code.
  const header = `;const ${names.runtime}=require(${JSON.stringify(options.runtimePath)}),${names.sites}=${names.runtime}.sites(${JSON.stringify(sites)});`;
  let headerAt = code.startsWith('#!') ? bytes.indexOf(0x0a) + 1 || bytes.length : 0;
  const first = (program.body as Node[])[1];
  const firstExpression = first?.expression as Node | undefined;
  if (first?.type === 'ExpressionStatement' && firstExpression?.type === 'StringLiteral')
    headerAt = spanOf(first).end - base;
  const output = apply(bytes, [
    ...insertions,
    { offset: headerAt, text: header, closing: false, depth: -1 },
  ]);
  // Safety net: if our edits produced invalid code, load the original instead.
  try {
    parseSync(output.startsWith('#!') ? `//${output.slice(2)}` : output, PARSE);
  } catch {
    return null;
  }
  return output;
}
