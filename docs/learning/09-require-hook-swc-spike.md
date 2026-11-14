# 09 · Require hook + SWC transform spike
2026-11-14 · Task 1.1 · `packages/agent/src/spike/` (`register.ts`, `hook.ts`, `source-map.ts`, `wrap.ts`, `runtime.ts`), `fixtures/smoke/src/spike-trace.ts`, `docs/decisions/0009-watched-files-source-map.md`

## In one sentence
Task 1.1 proved that a tiny file loaded with `node --require` can rewrite the user's compiled JavaScript as it loads, so every function reports "enter", "exit" or "threw", and we get an indented step tree for a real request.

## Why we are doing this
The whole product depends on one risky question: can we see every function call in someone else's app without asking them to change their code? If not, Pathlight does not work. Phase 1 is "prove it before building around it", and this spike is the first proof. It serves the PRD question "what did my code actually do for this request?".

A spike is a throwaway experiment. It prints text to the terminal instead of sending events to the collector. The real versions come in tasks 3.2, 3.6 and 3.7. What we keep is the knowledge, written into decision 0002 in task 1.4.

## How it works

### 1. `node --require` and a require hook
`node --require ./register.js app.js` tells Node: "run `register.js` first, then start my app". Our app code does not change. `register.js` can install a **require hook**: a function Node calls every time a file is loaded with `require()`. The hook receives the file's code (a string) and may return different code. We use the library `pirates` for this, because patching Node's loader by hand is fragile.

```ts
addHook((code, filename) => instrument(code, filename, {...}), {
  exts: ['.js'],
  matcher: (filename) => !filename.includes(NODE_MODULES) && !filename.startsWith(AGENT_ROOT),
});
```

The matcher skips `node_modules` (not the user's code) and the agent itself (we must not trace ourselves).

### 2. Find the original `.ts` file through the source map (decision 0009)
The app runs compiled `dist/orders/orders.service.js`. But the developer thinks in `src/orders/orders.service.ts`. Compiled files end with a comment like `//# sourceMappingURL=...`. A **source map** is a lookup table: "line 40 of the JS came from line 19 of the TS". `source-map.ts` reads it with `@jridgewell/trace-mapping`, and gets two things:
- the original file name (`src/orders/orders.service.ts`), so `hook.ts` can say "only instrument `src/**`, not tests";
- the original line for each function, so the tree shows `orders.service.ts:19`, not a line number in `dist`.

If there is no map, we warn (`NO_SOURCE_MAP`) and use the compiled file's own name.

### 3. Wrap each function with SWC and byte offsets
`wrap.ts` asks **SWC** (a fast parser written in Rust) to parse the JavaScript into a tree (an AST). Every function node has a `span`: where it starts and ends. We do not regenerate code from the tree (that could change behaviour and would be slower). We only **insert text** at exact positions in the original code. A function body goes from

```js
create(dto) { ...body... }
```
to
```js
create(dto) { const __pt$=__pathlightTracker.enter("OrdersService.create","src/orders/orders.service.ts",19);
  try{ ...body... }
  catch(__pte$){__pathlightTracker.throw(__pt$,__pte$);throw __pte$}
  finally{__pathlightTracker.exit(__pt$)} }
```

Why **byte** offsets: SWC reports positions in UTF-8 bytes, but JavaScript strings count UTF-16 characters. For plain ASCII they are the same. With an emoji or accented letter in a comment they differ, and the insertions would land in the wrong place and break the file. So we convert the code to a `Buffer` (bytes), cut and join there, and only convert to a string at the end. There is a unit test with multi-byte characters for this.

Two small tricks: we parse `;` + code so SWC's positions start exactly at byte 0, and we blank a `#!` shebang with spaces of the same length so offsets do not move.

Why **"use strict" must stay first**: a directive only works if it is the very first statement. If we put `const __pt$=...` before it, the function (or file) silently loses strict mode and behaves differently. That is a bug in the user's app caused by us. So the code skips past leading string directives before inserting. The `require` header line of the runtime is also placed after a file-level `"use strict"`.

Arrow functions with an expression body (`x => x.price`) get turned into `{ ...; return ret(...) }` blocks. Getters, setters, constructors and generators are skipped (generators run lazily, so try/finally would report wrong timing; constructors come in v1).

### 4. Promises go through `ret`
An `async` function returns right away with a promise, so `finally { exit() }` would fire long before the work is done and the time would be wrong. So every `return value` becomes `return __pathlightTracker.ret(probe, value)`. If the value is a promise, `ret` marks the step as pending, so `exit` does nothing, and the step finishes when the promise settles:

```ts
return value.then(
  (result) => { finish(probe); return result; },
  (error)  => { recordThrow(probe, error); finish(probe); throw error; },
);
```

The caller now gets a **follow-on promise** (a new promise that settles the same way). Important: if the original promise rejects and nobody handles it, the follow-on promise rejects too and nobody handles that either, so Node still reports an "unhandled rejection". We did not accidentally "handle" the user's error by observing it (we rethrow in the rejection branch). The cost: it is a different promise object than the original. OpenTelemetry does the same.

### 5. Fail open: the user's app always wins
Look at `hook.ts`: everything is in `try/catch`; if the file cannot be parsed, or anything throws, it returns the **original code** and logs a `[pathlight-tracker]` warning code (`TRANSFORM_FAILED`, `INSTRUMENT_ERROR`). In `runtime.ts`, every action runs inside `safely(...)` which swallows our own errors. A broken debug tool must never break the app being debugged (`.claude/rules/agent.md`). The worst outcome is "this file is not traced".

### The actual result
`pnpm spike:trace` starts the NestJS fixture with the hook, sends the failing `POST /orders` (user 7), and prints:

```
POST /orders → 500

→ AuthGuard.canActivate (src/common/auth.guard.ts:11)
← AuthGuard.canActivate (0.1 ms)
→ LoggingInterceptor.intercept (src/common/logging.interceptor.ts:11)
← LoggingInterceptor.intercept (0.1 ms)
→ OrdersController.create (src/orders/orders.controller.ts:23)
  → OrdersService.create (src/orders/orders.service.ts:19)
    → UserService.findById (src/users/user.service.ts:10)
      → UsersRepository.findOne (src/users/users.repository.ts:11)
      ← UsersRepository.findOne (5.0 ms)
    ← UserService.findById (5.1 ms)
    → CartService.total (src/cart/cart.service.ts:9)
      → CartRepository.findByUser (src/cart/cart.repository.ts:11)
      ← CartRepository.findByUser (1.7 ms)
      → (anonymous) (src/cart/cart.service.ts:11)
      ← (anonymous) (0.0 ms)
      → (anonymous) (src/cart/cart.service.ts:11)
      ← (anonymous) (0.0 ms)
    ← CartService.total (1.8 ms)
    → PricingService.calculateDiscount (src/pricing/pricing.service.ts:22)
    ✕ PricingService.calculateDiscount threw TypeError: Cannot read properties of undefined (reading 'rate') (0.1 ms)
  ✕ OrdersService.create threw TypeError: ... (7.1 ms)
✕ OrdersController.create threw TypeError: ... (7.3 ms)
```

Read it like a call stack: indentation is depth, `→` is enter, `←` is a normal return, `✕` is a throw. The error starts in `PricingService.calculateDiscount` and travels up two levels. This is the PRD's user-7 bug, now visible as a path instead of a guess. The two `(anonymous)` entries are the arrow callbacks in `CartService.total` (probably `reduce`/`map`); naming them is a later problem.

## Why this way, not another
- **Rewrite the code (instrument) vs. use `async_hooks` or the inspector.** Those cannot give "function X was called with these arguments and threw" for plain functions. Rewriting can. (Decision 0002 will record the final choice after task 1.4's benchmarks.)
- **Insert text vs. regenerate code from the AST.** Inserting keeps every other byte identical, and is fast. The price is the byte-offset care above.
- **`pirates` vs. patching `Module._extensions` ourselves.** `pirates` is small and handles ordering with other hooks. The new dependencies (`pirates`, `@swc/core`, `@jridgewell/trace-mapping`) were approved on 2026-11-14, as `CLAUDE.md` requires.
- **Original file via source map (0009).** Matching on `dist/` paths would break for every project with a different build layout.

## Findings (the point of a spike)
1. **Stack-trace columns shift.** We insert text on lines that contain functions, so an error's stack trace inside those lines points to the wrong column (the line stays right). Production needs a chained source map (tasks 3.6 and 3.7).
2. **A function returning a promise ends when the promise settles**, and the caller gets a follow-on promise (see section 4).
3. **SWC 1.16 calls a function body `FunctionBody`** (older versions: `BlockStatement`), and some nodes (like `KeyValueProperty`) have no span. The code handles both.
4. **tsc helpers such as `__decorate` have no source position**, so the source map returns "no origin". We treat that as compiler-generated code and skip it.

## Words to know
- **require hook**: code Node runs every time a CommonJS file is loaded, able to change its text.
- **`--require` (`-r`)**: a Node flag that runs a file before the app starts.
- **pirates**: a small library for installing a require hook safely.
- **source map**: a table that maps compiled code positions back to the original file and line.
- **AST / span**: the parsed tree of code / the start and end position of a node in it.
- **byte offset**: position counted in bytes; differs from JS string position for non-ASCII text.
- **probe**: the object `enter` returns; it carries name, time and error for one call.
- **fail open**: when our code breaks, the app runs normally, just untraced.
- **spike**: a throwaway experiment to answer a risk question.

## Try it yourself
1. Run `pnpm spike:trace` and find the `✕` lines. Which function threw first?
2. Open `packages/agent/src/spike/wrap.test.ts` and find the multi-byte test. Temporarily change the code in `wrap.ts` to compute offsets on the string instead of the `Buffer` (do not commit), run `pnpm --filter @pathlight-tracker/agent test`, and see which test fails. Then undo the change.

## Check yourself
1. What does `node --require register.js app.js` do, and why can the user's app stay unchanged?
2. Why does `wrap.ts` work on a `Buffer` and byte offsets instead of the string, and why must a `"use strict"` directive stay first?
3. Why does a returned promise go through `ret`, and what happens to an unhandled rejection of that promise?
4. What does "fail open" mean here? Name two places in the code that do it.
5. Name one thing the spike found that the real implementation (3.6 / 3.7) must solve.

<details>
<summary>Answers</summary>

1. It runs `register.js` before the app, so the hook is installed before any app file is loaded. The hook rewrites code in memory as each file loads, so no source file changes.
2. SWC gives positions in UTF-8 bytes, while JS strings count UTF-16 characters; they differ with non-ASCII text, so insertions would land in the wrong place. A directive is only valid as the first statement; text placed before it would silently turn off strict mode in the user's code.
3. Without it, `finally { exit }` runs when the async function returns its promise, not when the work finishes, so the timing and result would be wrong. `ret` ends the step when the promise settles. The follow-on promise rejects with the same error (it rethrows), so an unhandled rejection stays unhandled and Node still reports it.
4. If anything in Pathlight fails, the user's app still runs, only untraced. Examples: `hook.ts` returns the original code on parse failure or any exception; `runtime.ts` wraps all output and recording in `safely`; `register.ts` catches `addHook` failures.
5. Any of: stack-trace columns shift on lines with inserted probes (needs a chained source map); the follow-on promise is a different object; generators, constructors and getters are not handled yet; compiler helpers have no source position.
</details>

## Go deeper
- `docs/decisions/0009-watched-files-source-map.md` and `docs/implementation-plan.md` tasks 1.1, 1.4, 3.6.
- `docs/architecture.md` agent sections (instrumentation and fail-open behaviour).
