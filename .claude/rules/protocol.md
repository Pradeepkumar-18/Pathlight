---
paths:
  - "packages/protocol/**"
---

# Protocol rules

- `packages/protocol` is the contract between agent, collector and UI. Changing a schema changes the event protocol or the API: ask first (CLAUDE.md "Ask before changing"); the `ask-before-change` hook prompts for every non-test file here.
- `docs/api-spec.md` §4 (shared types) and §11 (WebSocket messages) are the source of truth. Update the spec first, then the schema, then `spec-examples.ts` and the tests.
- One schema per shape, defined once with Zod; export the inferred type next to it (`export type X = z.infer<typeof xSchema>`). Never redefine a protocol type in another package.
- Use `z.strictObject` so unknown fields are rejected; IDs, nanoseconds and times use the helpers in `values.ts`.
- This package depends on nothing but `zod`.
