# 03 · Linting and formatting: ESLint 9, Prettier and Lefthook
2026-11-04 · Task 0.3 · `eslint.config.mjs`, `.prettierrc`, `.prettierignore`, `lefthook.yml`, `package.json`

## In one sentence
We use ESLint to catch bugs and bad patterns in TypeScript code, Prettier to format all files identically, and Lefthook to automatically format and check code before every git commit.

## Why we are doing this
When developing software with AI assistants, code quality tooling is essential:
1. **Preventing hidden bugs**: ESLint enforces strict TypeScript hygiene (e.g. banning `any`, ensuring unused variables are flagged, requiring explicit type imports).
2. **Clean git diffs**: Without an automated formatter, different editors and assistants use different spacing, quotes, or semicolons, creating noisy git diffs. Prettier ensures every file conforms to one standard.
3. **Zero effort enforcement**: Developers shouldn't have to remember to run format commands manually. Lefthook runs as a git pre-commit hook, formatting and fixing staged files right before they are committed.

## How it works

### 1. ESLint 9 (Flat Config) & typescript-eslint
ESLint 9 introduced the new "flat config" system (`eslint.config.mjs`). Instead of nested `.eslintrc` files:
- All configuration lives in one root `eslint.config.mjs`.
- It uses `typescript-eslint` with `projectService: true` to type-check and lint all packages in the monorepo.
- `eslint-config-prettier` turns off any ESLint rules that would conflict with Prettier.

### 2. Prettier 3
`.prettierrc` defines our code style:
- Semicolons: `true`
- Single quotes: `true`
- Trailing commas: `all`
- Print width: `100`
- Tab width: `2`
- `proseWrap`: `preserve` (so documentation tables and ASCII maps aren't mangled)

`.prettierignore` ignores generated folders (`dist`, `.turbo`, `node_modules`, `pnpm-lock.yaml`) and markdown documentation (`Docs/`).

### 3. Lefthook (Git Hooks)
`lefthook.yml` configures git hooks using a single Go/Rust-backed binary:
- On `git commit`, Lefthook inspects staged files.
- It runs `prettier --write` on staged files and re-stages any auto-formatted changes (`stage_fixed: true`).
- It runs `eslint --fix` on staged TypeScript and JavaScript files.
- If linting fails with an unfixable error, the commit is blocked so broken code is never saved to git history.

## Why this way, not another
- **ESLint flat config**: ESLint 9 deprecated legacy `.eslintrc.json`. Flat config is the modern standard supported by typescript-eslint v8.
- **Lefthook vs Husky + lint-staged**: Husky and lint-staged require multiple node packages and slow npm lifecycle scripts. Lefthook is a single fast binary with parallel execution and simple YAML configuration.
- **eslint-config-prettier**: Running both linters and formatters can cause fights over formatting rules. `eslint-config-prettier` disables stylistic ESLint rules, leaving formatting entirely to Prettier.

## Words to know
- **Linter**: A tool that analyzes code for potential bugs, security issues, and style violations without running it.
- **Formatter**: A tool that rewrites code ASTs into a consistent visual layout (spacing, indentation, line breaks).
- **Git Hook**: A script triggered automatically by Git at key points in its workflow (e.g. `pre-commit`, `pre-push`).
- **Flat Config**: The unified configuration format introduced in ESLint 9 (`eslint.config.mjs`).

## Try it yourself
1. Open any file in `packages/protocol/src/index.ts`.
2. Add a badly formatted line like: `export const test = "bad spacing" ;`
3. Stage it with `git add packages/protocol/src/index.ts`.
4. Run `pnpm exec lefthook run pre-commit`. Notice how Lefthook intercepts the file and formats it into clean single quotes and spacing.

## Check yourself
1. Why do we use both ESLint and Prettier instead of just one?
2. What does `stage_fixed: true` in `lefthook.yml` do when Prettier formats a file?
3. Why do we keep documentation (`Docs/`) in `.prettierignore`?

<details>
<summary>Answers</summary>

1. ESLint checks code semantics and logic (catching `any`, unused variables, logic errors), while Prettier focuses exclusively on formatting (whitespace, line length, semicolons). Separating them avoids conflicts and ensures both logic and style are enforced.
2. It automatically stages the formatted version of the file in git so you don't commit unformatted code or leave unstaged changes after commit.
3. Detailed architectural specs contain ASCII diagrams, complex markdown tables, and indented blocks that automated prose wrapping would mangle.
</details>

## Go deeper
- [ESLint Flat Config documentation](https://eslint.org/docs/latest/use/configure/configuration-files)
- [typescript-eslint Getting Started](https://typescript-eslint.io/getting-started)
- [Lefthook Guide](https://github.com/evilmartians/lefthook)

