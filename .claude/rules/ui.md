---
paths:
  - "packages/ui/**"
---

# UI rules

- Colors, spacing, radius and type only through design tokens (`packages/ui/src/theme`). No raw hex values in components. Ask before changing tokens.
- Use shadcn/ui components and Lucide icons; no other UI library.
- Every interactive element is a real `<button>`, `<a>` or `<input>` with a label; icon-only buttons need `aria-label`.
- Render captured values as text, never as HTML.
- Every screen handles its empty, loading and error states from `docs/user-flows.md` §6; each panel has an error boundary.
- Wording says **steps**, never "spans".
- Look at `docs/ui-reference.png` only when building or changing layout (it is a large image).
- Any UI change runs `pnpm test:e2e` before it is done.
