# 11 · Behaviour-preservation corpus: observe, never change
2026-11-14 · Task 1.3 · `tests/behaviour-corpus/` (`cases/src/*.js`, `src/run.ts`, `known-differences.json`), `packages/agent/src/spike/wrap.ts`

## In one sentence
Task 1.3 built a test suite of 14 small, odd programs that each run twice, with and without Pathlight's hook, and fail if the app behaves differently in any way we can see (output, errors, exit code).

## Why we are doing this
Pathlight rewrites the user's code to watch it. The rule is **observe, never change**: if the app behaves differently because we are watching, we have failed, and nobody will debug with a tool that might itself cause the bug. This corpus is the safety net that protects that promise, and it serves every PRD question, because a trace of a changed program is a trace of the wrong program.

Ordinary unit tests ask "does our code do what we meant?". The corpus asks a different question: "does the user's code still do what IT meant?"

## How it works

### The cases
`tests/behaviour-corpus/cases/src/` has files that use tricky JavaScript: private methods and `super`, `arguments` aliasing, `new.target`, generators, getters and setters, decorators, strict and sloppy `this`, async ordering, thrown non-Errors and `finally`, default parameters, directives without `;`, hoisting, and an unhandled rejection that must still crash the process. Each is exactly the kind of shape where a naive rewrite breaks something.

### The runner (`run.ts`)
For every case:
1. Run `node src/case.js` (plain).
2. Run `node --require .../register.js src/case.js` (traced).
3. Compare **stdout, stderr and exit code**.

Some noise is removed first, because it is the tracer talking, not the app: lines starting `[pt `, lines starting `[pathlight-tracker]`, and the column number in crash locations (`file.js:12:5` becomes `file.js:12`; the spike shifts columns on lines where it inserts probes, a known finding from lesson 09).

It also checks the hook really instrumented the case (`traceLines > 0`). A case the hook skipped would pass for a useless reason.

### Known differences must still be detected
Two cases differ on purpose and are listed in `known-differences.json`. The runner does not just ignore them:

```ts
// Known differences must still show up, so a fix (or a regression in reverse) is noticed.
console.log(`${found.length > 0 ? 'known' : 'FAIL '} ${name}: ${known.reason}`);
if (found.length === 0) { ... failures += 1; }
```

If a "known difference" stops differing, the test FAILS and tells you to remove it from the list. Why? A list that is only ignored goes stale: you could fix the problem, or change what the case tests, and never notice. Making the list "tested too" keeps it honest.

### The bug the corpus found
The case `directives-and-hoisting.js` has `function shadowing(__pt$) { return __pt$; }`. The generated probe variable was also named `__pt$`, so the rewritten function declared the same name twice and the app crashed at load time. Our safety net (re-parse the output and fall back to the original on bad syntax) did not catch it, because a duplicate declaration is an "early error", not a syntax error.

The fix in `wrap.ts` is **collision-free by construction**: pick names that appear nowhere in the file.

```ts
const bases = ['__pathlightTracker', '__pt$', '__pte$'];
let suffix = '';
for (let n = 0; bases.some((name) => code.includes(name + suffix)); n += 1) suffix = String(n);
```

If the user's file contains `__pt$`, we use `__pt$0`, and so on. Nobody ever planned a parameter called `__pt$`; the corpus found it because it is deliberately paranoid.

### The two open known differences
1. **Promise identity** (`promise-identity.js`): when a function returns a promise, we hand back a follow-on promise (same result, different object) so we can end the step when it settles. So `got === shared` becomes `false` and custom properties such as `shared.extra` vanish.
2. **`Function.prototype.toString`** (`function-tostring.js`): `add.toString()` returns the source as loaded, which now includes our inserted probes.

These are real violations of "never change", but rare in practice and costly to avoid. In task 1.4 you decide, in decision 0002, whether to accept them as documented limits or demand a different approach.

## Why this way, not another
- **Only unit-test the transform**: checks our expectations, not the user's. The corpus is a black box, so it catches bugs we did not imagine.
- **Fuzz or run big real apps**: valuable later, but slow and noisy. A small hand-picked corpus is quick, runs in CI and every failure is easy to read.
- **Compare nothing but exit code**: misses changed output and errors.
- **Silently allow known differences**: see above, the list rots.
- Rule in `.claude/rules/agent.md`: every agent change must run `pnpm test:corpus`. The corpus will grow (v0 means first version).

## Words to know
- **Behaviour preservation**: the app does the same observable things with the tool on.
- **Corpus**: a collection of test inputs.
- **Instrumentation**: inserting probe code into the user's code.
- **Early error**: an error JavaScript reports when it loads a file (for example, a duplicate parameter name) even though the syntax is valid.
- **Collision-free by construction**: names chosen so a clash is impossible, instead of hoping.
- **Known difference**: an accepted, written-down, still-tested deviation.

## Try it yourself
1. Run `pnpm test:corpus` and find the lines marked `known`.
2. In `wrap.ts`, make `freeNames` always return the bare names (suffix empty). Rebuild, run the corpus: which case fails and how? Revert.
3. Optional: add a case of your own, for example a function that reads `fn.name`, and see if it passes.

## Check yourself
1. What does "observe, never change" mean for a tool like Pathlight, and why does it matter more than any feature?
2. Which three things does the runner compare, and what does it strip out first and why?
3. Why does the runner fail when a known difference disappears?
4. What caused the `__pt$` crash, and why did the re-parse safety net not catch it?
5. Name the two open known differences and what task decides them.

<details>
<summary>Answers</summary>

1. The app must behave exactly the same with the tool on; otherwise the trace is not of the real program and users will stop trusting it.
2. stdout, stderr, exit code. It strips trace lines, agent warnings and crash-location columns, because these come from the tracer or shift with inserted code.
3. So the list stays accurate: a fixed or changed case is noticed and the entry is removed, not forgotten.
4. A parameter named `__pt$` clashed with the generated probe variable (duplicate declaration, an early error). The re-parse only catches syntax errors. Fix: names that appear nowhere in the file.
5. Promise identity and `Function.prototype.toString`; task 1.4 (decision 0002), decided by you.
</details>

## Go deeper
- `docs/progress.md`, entry 1.3 ("Findings for 0002").
- `tests/behaviour-corpus/known-differences.json` and `cases/src/` for the odd shapes.
- Lesson [09](09-require-hook-swc-spike.md) for the follow-on promise and shifted columns.
