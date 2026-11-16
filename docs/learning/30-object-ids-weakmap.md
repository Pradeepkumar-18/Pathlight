# 30 · Object IDs with WeakMap
2026-11-16 · Task 3.5 · `packages/agent/src/capture/object-ids.ts`, `capture.ts`

## In one sentence
Every object is given a stable `obj_<n>` ID the first time it is captured, using a `WeakMap`, so the same object has the same ID in every step without the agent keeping it in memory.

## Why we are doing this
The later "data journey" view (v2) must answer "where did this exact object travel, and who changed it?". A preview such as `{ id: 1 }` cannot say whether two steps saw the same object or two equal copies. An ID can. The collector already writes `object_refs` from these IDs (`data-model.md`).

## How it works
```ts
const ids = new WeakMap<object, number>();
idOf(value) {
  let id = ids.get(value);
  if (id === undefined) { last += 1; id = last; ids.set(value, id); }
  return `obj_${id}`;
}
```
- First time: new number. Next time the same object: same number.
- IDs go on objects, arrays, maps, sets and errors (things a journey can follow). Not on dates, buffers or promises.
- Each capturer gets its own ID map by default.

## Why this way, not another
- A normal `Map` would hold every object forever: a memory leak that grows with each request. A **WeakMap** holds its keys "weakly": when nothing else uses the object, the garbage collector can free it, and the entry disappears.
- Writing an `__id` property on the user's object would change their object, which breaks "observe, never change" (lesson [11](11-behaviour-preservation-corpus.md)).
- Tests: same object in two steps gets the same ID; a `WeakRef` proves objects are collected; under 1 MB heap growth after 10,000 requests with forced GC (needs `--expose-gc`).
- Sources: `data-model.md` §2, §3.4, §3.6.
- Open point: the counter is per capturer, not per request. How IDs relate to one request is worth confirming when the recorder arrives (task 3.7).

## Words to know
- **WeakMap**: a map whose keys do not keep objects alive.
- **garbage collection (GC)**: Node freeing memory nobody uses.
- **memory leak**: memory that is kept but never needed again.
- **identity**: "the same object", not "an equal-looking object".

## Try it yourself
In `object-ids.test.ts`, read the heap test. Then in a scratch file, replace the `WeakMap` with a `Map`, run the test, and see it fail (undo it afterwards).

## Check yourself
1. What can an ID tell you that a preview cannot?
2. Why a `WeakMap` and not a `Map`?
3. Why not store the ID on the object itself?

<details><summary>Answers</summary>

1. Whether two steps saw the very same object.
2. A `Map` keeps objects alive forever and leaks memory.
3. It would change the user's object, and could show up in their output.
</details>

## Go deeper
- `docs/data-model.md` §3.6; MDN: WeakMap
