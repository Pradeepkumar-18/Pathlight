# 28 · Safe value capture: reading values without running user code
2026-11-16 · Task 3.3 · `packages/agent/src/capture/capture.ts`, `safe.ts`, `preview.ts`

## In one sentence
`capture()` turns any JavaScript value into a small, safe `CapturedValue` for the map, while never running a single line of the user's code.

## Why we are doing this
The PRD promises to show the values that went into and out of each function. But values are dangerous to read: a getter may charge a card, `toJSON` may throw, a Buffer may be 50 MB, an object may point to itself. If looking at a value changes the app (or crashes it), the tool is broken. This is "observe, never change" (lesson [11](11-behaviour-preservation-corpus.md)) applied to data.

## How it works
- Only **own data properties** are read, using `Object.getOwnPropertyDescriptor`. If a property is a getter, we do not call it; it shows as `[Getter]`.
- Proxies are never opened. `toJSON`, `toString` and custom `inspect` are never called.
- For `Map`, `Set`, `Date`, `RegExp` we call the **built-in prototype method** (e.g. `Map.prototype.entries`), saved at startup, so a user subclass that overrides the method is not run.
- Caps from settings: depth, array length, string length (e.g. `PATHLIGHT_TRACKER_MAX_DEPTH`, `PATHLIGHT_TRACKER_MAX_STRING`); objects show at most 50 keys.
- Cycles become `[Circular]`. `undefined` or `NaN` inside an object sets `suspicious` (this is how the PRD's "user.tier is undefined" bug stands out).
- Special types: Map, Set, Date, Error, Promise, BigInt, Symbol, functions, class instances, Buffer / typed arrays (first 16 bytes only), WeakMap, RegExp, Mongoose documents (their `_doc` fields), BSON ObjectIds.

```ts
const descriptor = Object.getOwnPropertyDescriptor(target, key);
if ('value' in descriptor) return { kind: 'value', value: descriptor.value };
return { kind: 'accessor', ... }; // getter: report it, never call it
```

## Why this way, not another
- `JSON.stringify` or `util.inspect` are shorter but call `toJSON` / getters, which are user code. Rejected for safety.
- The result must match the `CapturedValue` schema from `protocol` (lesson [13](13-protocol-package-zod-schemas.md)); tests check that every result is schema-valid.
- Tests prove it: a getter with side effects is counted and never triggered; a 50 MB buffer is summarized in under 50 ms.
- Sources: `api-spec.md` §4.1, `data-model.md` §3.6, decision 0016, `architecture.md` §9, PRD FR-12.

## Words to know
- **own property**: defined on the object itself, not inherited.
- **getter**: a property that runs a function when read.
- **circular reference**: an object that contains itself, directly or not.
- **preview**: the short text shown in the UI for a value.

## Try it yourself
Open `capture.test.ts`. Find the side-effect getter test. Write a new test: an object with a getter that increments a counter, plus a `toJSON` that throws. Capture it and assert the counter is 0 and no error is thrown.

## Check yourself
1. Why read a property via its descriptor instead of `obj.key`?
2. Why call `Map.prototype.entries` directly rather than `map.entries()`?
3. What does the `suspicious` flag help the developer notice?

<details><summary>Answers</summary>

1. `obj.key` would run a getter (user code); the descriptor only describes it.
2. A subclass could override `entries()` with user code.
3. Values like `undefined` or `NaN` inside objects, which are often the cause of a bug.
</details>

## Go deeper
- `docs/data-model.md` §3.6; `docs/architecture.md` §9
