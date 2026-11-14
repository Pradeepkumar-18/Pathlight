# 13 · The protocol package: one contract, written once
2026-11-14 · Task 2.1 · `packages/protocol/src/` (`values.ts`, `events.ts`, `live.ts`, `api.ts`, `spec-examples.ts`), `.claude/rules/protocol.md`

## In one sentence
We built `packages/protocol`, a small package that holds every message shape the agent, collector and UI send to each other, written once as Zod schemas, with the TypeScript types inferred from those schemas.

## Why we are doing this
Pathlight Tracker has three programs that talk to each other: the agent (inside the user's app), the collector (server + SQLite) and the UI (browser). The agent sends events like "step entered" over a WebSocket. The collector must understand them exactly. If the agent calls a field `durationNs` and the collector expects `duration`, nothing crashes at compile time. Data just silently goes wrong.

The fix is a **contract**: one place that says "this is what a `step.enter` event looks like". All three packages read the same contract. This serves the PRD's trust principle: the map must show what the code really did, so the data pipe cannot be sloppy.

## How it works

**1. The protocol package depends on nothing (except `zod`).**
The rule from lesson [02](02-monorepo-pnpm-turborepo.md): `agent`, `collector` and `ui` import only from `protocol`, never from each other.

```
agent ──┐
collector ──> protocol  (depends only on zod)
ui ─────┘
```

Why at the bottom? If `protocol` imported the collector, then the agent would pull in the whole server just to know a type. Also you would get loops (A needs B needs A). A package with no dependencies is the one every other package can safely share.

**2. Schema first, type inferred.**
A TypeScript type exists only while compiling. It vanishes at runtime. But data arriving over a WebSocket is just text: TypeScript cannot check it. So we need a runtime check too, and that is what Zod does. If we wrote the type by hand and the schema by hand, they could drift apart. So we write the schema once and ask Zod for the type:

```ts
export const stepKindSchema = z.enum(['function', 'method', ...]);
export type StepKind = z.infer<typeof stepKindSchema>;
```

One source of truth: change the schema, and the type changes with it. This is the rule in `.claude/rules/protocol.md`, and it also follows CLAUDE.md: "Validate every external input with Zod".

**3. Strict objects reject unknown fields.**
`z.strictObject({...})` fails if the data has a field the schema does not list. A plain `z.object` would quietly drop it. Strict is better here because a surprise field usually means the agent and collector disagree about the protocol (for example a newer agent with an older collector). We want to see that loudly, not hide it.

**4. Discriminated unions: "look at one field, pick the shape".**
There are 11 event kinds. Each has an `e` field (`'request.start'`, `'step.enter'`, ...):

```ts
export const agentEventSchema = z.discriminatedUnion('e', [
  requestStartEventSchema, stepEnterEventSchema, ...
]);
```

Zod reads `e`, goes straight to the matching schema and gives a precise error ("step.exit needs durationNs") instead of "none of 11 shapes matched". TypeScript also uses `e` to narrow: inside `if (event.e === 'step.exit')` it knows `event.durationNs` exists. The WebSocket messages (`hello`, `batch`, `welcome`, `ack`...) use the same trick with the field `type`. Note the commit's history: an older design reused `kind` for two meanings, and a test now checks that this is rejected.

**5. Recursive values with `z.lazy`.**
A captured value can contain captured values: an object's `children` are more captured values (`{ user: { tier: ... } }`). A schema that refers to itself breaks at definition time, because the constant does not exist yet when it is being built. `z.lazy(() => ...)` delays the building until first use. Zod cannot infer the type of a recursive schema, so `CapturedValue` is written by hand as an interface and the schema is annotated `z.ZodType<CapturedValue>`. This is the one exception to "infer from schema". A test checks that a bad value nested deep inside is still rejected.

**6. Durations are digit strings.**
`durationNs: '84000000'`, not `84000000`. JavaScript numbers lose exactness above about 9 quadrillion (2^53). Nanosecond clock values are bigger than that, and JSON has no BigInt. So we send digits in a string and the schema checks `^\d+$`. The cost: whoever does maths must convert (`BigInt(...)`).

**7. IDs: prefix + 26-char ULID.**
`req_01JB...` is checked by regex: `req_` then exactly 26 characters of Crockford base32 (no I, L, O, U). The prefix means you can never pass a step ID where a request ID is wanted. The strict length catches truncated IDs (a test uses a 24-character one). Object IDs are different on purpose: `obj_17`, a counter per session, so they only need `obj_<digits>`.

**8. Tests use the spec's own examples.**
`spec-examples.ts` copies the JSON examples from `api-spec.md` (§6, §8, §11) and the tests assert the schemas accept them. Then a second group checks bad data is rejected (wrong prefix, numeric duration, unknown field, fake error code). The spec is the source of truth, so if the spec and a schema disagree, a test goes red. This already paid off: the §6.4 example lacked an error `column` that its own type requires, so the spec was fixed.

**9. The new guard.**
Because changing a schema changes the protocol for three packages, the `ask-before-change` hook now prompts before any edit to non-test files in `packages/protocol/src`. The order of work is in `.claude/rules/protocol.md`: spec first, then schema, then examples and tests.

## Why this way, not another
- **Hand-written types plus separate validators:** two copies drift. Rejected for one source of truth.
- **Types only, no runtime check:** unsafe at the WebSocket, which is the exact place bad data can enter.
- **JSON Schema or protobuf:** more tools and generated code; Zod is already approved in the tech stack (zod 4.6.7, Phase 2 libraries in `progress.md`).
- **Each package keeps its own copy of the types:** forbidden by CLAUDE.md ("Never redefine an event, API or value type locally").
- **Numbers for nanoseconds:** simpler but silently imprecise.

## Words to know
- **Protocol / contract** → the agreed shapes of messages between programs.
- **Schema** → a runtime description of valid data (Zod).
- **`z.infer`** → asks Zod for the TypeScript type that matches a schema.
- **Strict object** → rejects fields not in the schema.
- **Discriminated union** → several shapes, chosen by the value of one tag field.
- **`z.lazy`** → delays building a schema so it can refer to itself.
- **ULID** → a 26-character sortable unique ID.
- **Crockford base32** → digits and letters without easily confused ones (I, L, O, U).

## Try it yourself
1. Open `packages/protocol/src/events.test.ts` and find the "rejects invalid data" group.
2. In a scratch test file (do not commit it), write:
   ```ts
   import { agentEventSchema } from './events';
   const r = agentEventSchema.safeParse({ e: 'step.exit', traceId: 'req_01JBSEED000000000000000001', ts: '1', stepId: 'stp_01JBSEED000000000000000001', durationNs: 5 });
   console.log(JSON.stringify(r.error?.issues, null, 2));
   ```
3. Run it with `pnpm --filter @pathlight-tracker/protocol test`. Read the error: which field fails and why? Then change `5` to `'5'` and add `extra: true` to see the strict rejection.

## Check yourself
1. Why must `protocol` depend on nothing but `zod`? What would go wrong if it imported from the collector?
2. Why do we write `export type X = z.infer<typeof xSchema>` instead of writing the type by hand? Which type is the exception, and why?
3. Why is `durationNs` the string `'84000000'` and not the number?
4. What does a discriminated union on `e` give you, compared with a plain union of 11 schemas?
5. Why do the tests use the examples copied from `api-spec.md`, and what happens if you change a schema without asking first?

<details>
<summary>Answers</summary>

1. So every package can import it without pulling in anything else, and to avoid import loops. Importing the collector would drag the server into the agent and break the "only depend on protocol" rule.
2. One source of truth: the type can never disagree with the runtime check. `CapturedValue` is the exception, because a self-referring (`z.lazy`) schema cannot be inferred, so the interface is hand-written and the schema is annotated with it.
3. Nanosecond values can exceed what a JavaScript number holds exactly (2^53), and JSON has no BigInt, so a digit string keeps them exact.
4. Zod picks the right schema by reading `e`, so errors name the exact problem, and TypeScript narrows the type inside `if (event.e === ...)`.
5. They tie the code to the spec, so drift turns a test red. Changing a schema changes the protocol for agent, collector and UI, so the `ask-before-change` hook prompts you first and the spec must be updated before the schema.
</details>

## Go deeper
- `docs/api-spec.md` §4 (shared types) and §11 (WebSocket messages), the master copy.
- `.claude/rules/protocol.md` for the working order and rules.
- Zod docs: discriminated unions and recursive types (`z.lazy`).
