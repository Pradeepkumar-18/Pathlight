import { parseSync } from '@swc/core';

/** Where a wrapped function lives in the original source. */
export interface Origin {
  line: number;
}

export interface WrapOptions {
  /** Module the wrapped code `require`s for `enter` / `exit` / `throw`. */
  runtimePath: string;
  /** Original file shown in the trace, e.g. `src/orders/orders.service.ts`. */
  file: string;
  /** Maps a 1-based line and 0-based UTF-16 column of the given code to the original line. */
  originFor: (line: number, column: number) => Origin | null;
}

interface Insertion {
  offset: number;
  text: string;
  /** Closing text goes before opening text at the same offset; nesting decides the rest. */
  closing: boolean;
  depth: number;
}

type Node = Record<string, unknown>;

/**
 * Names for the generated variables that appear nowhere in the file, so they can never clash
 * with user code (a parameter named like the probe once crashed the app at load time).
 */
function freeNames(code: string): { runtime: string; probe: string; error: string } {
  const bases = ['__pathlightTracker', '__pt$', '__pte$'];
  let suffix = '';
  for (let n = 0; bases.some((name) => code.includes(name + suffix)); n += 1) {
    suffix = String(n);
  }
  return {
    runtime: `__pathlightTracker${suffix}`,
    probe: `__pt$${suffix}`,
    error: `__pte$${suffix}`,
  };
}

function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && typeof (value as Node).type === 'string';
}

function spanOf(node: Node): { start: number; end: number } {
  return node.span as { start: number; end: number };
}

function keyName(key: unknown): string {
  if (!isNode(key)) return '(anonymous)';
  if (key.type === 'Identifier' || key.type === 'StringLiteral') return String(key.value);
  if (key.type === 'PrivateName') return `#${String((key.id as Node | undefined)?.value ?? '')}`;
  return '[computed]';
}

/**
 * Wraps every function in `code` so it reports enter / exit / throw to the runtime.
 * Returns `null` when the code can't be parsed, so the caller can load it untouched.
 */
export function wrapFunctions(code: string, options: WrapOptions): string | null {
  // A leading `;` pins SWC's span base to byte 0 of our input; shebangs are
  // blanked (same length) because they are only legal as the first bytes.
  const source = code.startsWith('#!')
    ? code.replace(/^#![^\n]*/, (m) => ' '.repeat(m.length))
    : code;
  let program: Node;
  try {
    program = parseSync(`;${source}`, {
      syntax: 'ecmascript',
      target: 'es2022',
    }) as unknown as Node;
  } catch {
    return null;
  }
  const base = spanOf(program).start + 1;
  const names = freeNames(code);
  const RUNTIME_VAR = names.runtime;
  const PROBE_VAR = names.probe;
  const ERROR_VAR = names.error;
  const bytes = Buffer.from(code, 'utf8');
  const lineStarts = [0];
  for (let i = 0; i < bytes.length; i += 1) if (bytes[i] === 0x0a) lineStarts.push(i + 1);

  const position = (byteOffset: number): { line: number; column: number } => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if ((lineStarts[mid] ?? 0) <= byteOffset) low = mid;
      else high = mid - 1;
    }
    const lineStart = lineStarts[low] ?? 0;
    return { line: low + 1, column: bytes.subarray(lineStart, byteOffset).toString('utf8').length };
  };

  const insertions: Insertion[] = [];

  const probeFor = (name: string, at: number): string | null => {
    const { line, column } = position(at);
    const origin = options.originFor(line, column);
    // No original position means compiler-generated code (e.g. tsc's `__decorate`), not user code.
    if (origin === null) return null;
    const args = [JSON.stringify(name), JSON.stringify(options.file), String(origin.line)];
    // Leading `;` ends a body directive written without one (`"use strict"}` style code).
    return `;const ${PROBE_VAR}=${RUNTIME_VAR}.enter(${args.join(',')});try{`;
  };
  const tail = `}catch(${ERROR_VAR}){${RUNTIME_VAR}.throw(${PROBE_VAR},${ERROR_VAR});throw ${ERROR_VAR}}finally{${RUNTIME_VAR}.exit(${PROBE_VAR})}`;
  // Routes a returned value through the runtime, so a returned promise ends the step when it settles.
  const returnOpen = `${RUNTIME_VAR}.ret(${PROBE_VAR},`;

  /** Wraps `fn`; returns whether its body now has a probe (so its `return`s get routed too). */
  const wrapFunction = (fn: Node, name: string, at: number, depth: number): boolean => {
    // Generators run lazily, so try / finally would report the wrong timing; left to task 3.6.
    if (fn.generator === true) return false;
    const body = fn.body;
    if (!isNode(body)) return false;
    const opening = probeFor(name, at);
    if (opening === null) return false;
    const span = spanOf(body);
    // SWC calls a function's block body `FunctionBody` (older versions: `BlockStatement`).
    if (body.type === 'FunctionBody' || body.type === 'BlockStatement') {
      // Keep a "use strict" directive first, or the function would lose strict mode.
      let start = span.start - base + 1;
      for (const stmt of (body.stmts as Node[] | undefined) ?? []) {
        const expression = stmt.expression as Node | undefined;
        if (stmt.type !== 'ExpressionStatement' || expression?.type !== 'StringLiteral') break;
        start = spanOf(stmt).end - base;
      }
      insertions.push({ offset: start, text: opening, closing: false, depth });
      insertions.push({
        offset: span.end - base - 1,
        text: tail,
        closing: true,
        depth,
      });
      return true;
    }
    insertions.push({
      offset: span.start - base,
      text: `{${opening}return ${returnOpen}(`,
      closing: false,
      depth,
    });
    insertions.push({
      offset: span.end - base,
      text: `))${tail}}`,
      closing: true,
      depth,
    });
    // The expression body is already routed; its own nested `return`s belong to other functions.
    return false;
  };

  const visit = (
    value: unknown,
    className: string,
    pendingName: string | null,
    depth: number,
    wrapped: boolean,
  ): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item, className, null, depth, wrapped);
      return;
    }
    if (!isNode(value)) {
      if (typeof value === 'object' && value !== null) {
        for (const child of Object.values(value)) visit(child, className, null, depth, wrapped);
      }
      return;
    }
    const node = value;
    // Some SWC nodes (e.g. `KeyValueProperty`) carry no span.
    const nodeStart = ((node.span as { start: number } | undefined)?.start ?? base) - base;
    switch (node.type) {
      case 'FunctionDeclaration':
      case 'FunctionExpression': {
        const own = isNode(node.identifier) ? String(node.identifier.value) : null;
        const inner = wrapFunction(node, own ?? pendingName ?? '(anonymous)', nodeStart, depth + 1);
        visit(node.body, className, null, depth + 1, inner);
        return;
      }
      case 'ArrowFunctionExpression': {
        const inner = wrapFunction(node, pendingName ?? '(anonymous)', nodeStart, depth + 1);
        visit(node.body, className, null, depth + 1, inner);
        return;
      }
      case 'ClassDeclaration':
      case 'ClassExpression': {
        const name = isNode(node.identifier)
          ? String(node.identifier.value)
          : (pendingName ?? '(anonymous class)');
        visit(node.body, name, null, depth, false);
        visit(node.decorators, className, null, depth, wrapped);
        visit(node.superClass, className, null, depth, wrapped);
        return;
      }
      case 'ClassMethod':
      case 'PrivateMethod': {
        const fn = node.function as Node;
        // Getters and setters are never tracked (PRD: reading can cause side effects).
        const inner =
          node.kind === 'method' &&
          wrapFunction(fn, `${className}.${keyName(node.key)}`, nodeStart, depth + 1);
        visit(fn, className, null, depth + 1, inner);
        return;
      }
      case 'ClassProperty':
      case 'PrivateProperty':
        visit(node.value, className, `${className}.${keyName(node.key)}`, depth, false);
        return;
      case 'MethodProperty': {
        const inner = wrapFunction(node, keyName(node.key), nodeStart, depth + 1);
        visit(node.body, className, null, depth + 1, inner);
        return;
      }
      case 'KeyValueProperty':
        visit(node.value, className, keyName(node.key), depth, wrapped);
        return;
      case 'VariableDeclarator': {
        const id = node.id as Node;
        visit(
          node.init,
          className,
          id.type === 'Identifier' ? String(id.value) : null,
          depth,
          wrapped,
        );
        return;
      }
      case 'AssignmentExpression': {
        const left = node.left as Node;
        const name = left.type === 'MemberExpression' ? keyName(left.property) : null;
        visit(node.right, className, name, depth, wrapped);
        return;
      }
      case 'ReturnStatement': {
        const argument = node.argument;
        if (wrapped && isNode(argument)) {
          const span = spanOf(argument);
          // Half a level deeper than the function's own tail, so at a shared offset
          // (`{return 1}`) the return's `))` closes before the tail does.
          const returnDepth = depth + 0.5;
          insertions.push({
            offset: span.start - base,
            text: `${returnOpen}(`,
            closing: false,
            depth: returnDepth,
          });
          insertions.push({
            offset: span.end - base,
            text: '))',
            closing: true,
            depth: returnDepth,
          });
        }
        visit(argument, className, null, depth, wrapped);
        return;
      }
      case 'Constructor':
      case 'GetterProperty':
      case 'SetterProperty':
        // Constructors arrive in v1; getters and setters are never tracked.
        return;
      default:
        for (const [key, child] of Object.entries(node)) {
          if (key !== 'span') visit(child, className, null, depth, wrapped);
        }
    }
  };
  visit(program.body, '', null, 0, false);
  if (insertions.length === 0) return code;

  // Leading `;` ends a directive written without one (`"use strict"` + newline-less code).
  const header = `;const ${RUNTIME_VAR}=require(${JSON.stringify(options.runtimePath)});`;
  const parts: Buffer[] = [];
  let cursor = 0;
  // A shebang must stay the very first bytes, so the header goes after its line.
  let headerAt = code.startsWith('#!') ? bytes.indexOf(0x0a) + 1 || bytes.length : 0;
  // After a file-level "use strict", so the directive keeps working.
  const first = (program.body as Node[])[1];
  const firstExpression = first?.expression as Node | undefined;
  if (first?.type === 'ExpressionStatement' && firstExpression?.type === 'StringLiteral') {
    headerAt = spanOf(first).end - base;
  }
  const all = [...insertions, { offset: headerAt, text: header, closing: false, depth: -1 }];
  // At one offset: closing text first (innermost first), then opening text (outermost first).
  all.sort(
    (a, b) =>
      a.offset - b.offset ||
      Number(b.closing) - Number(a.closing) ||
      (a.closing ? b.depth - a.depth : a.depth - b.depth),
  );
  for (const insertion of all) {
    parts.push(bytes.subarray(cursor, insertion.offset), Buffer.from(insertion.text, 'utf8'));
    cursor = insertion.offset;
  }
  parts.push(bytes.subarray(cursor));
  const output = Buffer.concat(parts).toString('utf8');
  // Safety net: if our edits produced invalid code, load the original instead.
  try {
    parseSync(output.startsWith('#!') ? `//${output.slice(2)}` : output, {
      syntax: 'ecmascript',
      target: 'es2022',
    });
  } catch {
    return null;
  }
  return output;
}
