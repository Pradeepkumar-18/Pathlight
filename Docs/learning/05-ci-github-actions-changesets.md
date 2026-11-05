# 05 · Continuous Integration: GitHub Actions and Changesets
2026-11-05 · Task 0.5 · `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `.changeset/config.json`

## In one sentence
We use GitHub Actions to verify every commit across Ubuntu, macOS, and Windows on Node 20 and 24, and Changesets to manage package versioning and changelogs across our monorepo.

## Why we are doing this
Pathlight Tracker is developer tooling that runs locally across diverse environments:
1. **Cross-platform reliability**: Developers run backends on macOS, Linux, and Windows. By running tests on all three operating systems in CI, we catch platform-specific issues (e.g. path separators, file permissions, long path limits) before they reach users.
2. **Multiple Node runtime support**: While we develop on Node 24, our runtime agent must support user apps running on Node 20+. CI tests the matrix of `[20, 24]` across all 3 OSes (6 matrix jobs total).
3. **Automated versioning**: With four interdependent packages in one repo (`protocol`, `agent`, `collector`, `ui`), coordinating package releases manually causes version mismatch bugs. Changesets automates version bumping, dependency updates, and changelogs via pull requests.

## How it works

### 1. Matrix Testing in GitHub Actions (`ci.yml`)
The workflow defines a matrix across:
- **OS**: `[ubuntu-latest, macos-latest, windows-latest]`
- **Node**: `[20, 24]`

For every combination, CI runs:
1. `pnpm install --frozen-lockfile`: Ensures exact dependency tree from `pnpm-lock.yaml`.
2. `pnpm format:check`: Enforces Prettier formatting.
3. `pnpm lint`: Runs ESLint 9 across all packages.
4. `pnpm typecheck`: Strict TypeScript typechecking.
5. `pnpm test`: Parallel unit tests with Vitest.
6. `pnpm build`: Monorepo build with Turborepo.

### 2. Changesets (`.changeset/config.json`)
- Whenever a PR introduces a notable feature or fix, developer runs `pnpm changeset`.
- Changeset prompts for which package changed (`major`, `minor`, or `patch`) and asks for a summary.
- The resulting `.changeset/*.md` file is committed to git.
- On merge to `main`, GitHub Actions creates or updates a "Version Packages" PR that bumps version numbers and updates `CHANGELOG.md`.

## Why this way, not another
- **pnpm/action-setup vs npm/yarn**: Pinned to exact version `10.34.9` with store caching for rapid CI runs.
- **Changesets vs semantic-release**: Semantic-release assumes single-package repositories or complex plugin setups. Changesets is designed specifically for monorepos with linked or independent packages.
- **Fail-fast disabled (`fail-fast: false`)**: If Windows fails, Linux and macOS jobs continue running so we see the full matrix result in a single run.

## Words to know
- **CI (Continuous Integration)**: Automating the build and testing of code every time a team member commits changes.
- **Matrix Build**: Running the same workflow across multiple permutations of operating systems and runtime versions.
- **Frozen Lockfile**: Installing dependencies strictly matching the lockfile, failing if the lockfile needs updates.
- **Changeset**: A markdown file declaring which packages should be versioned and how.

## Try it yourself
1. Run `pnpm changeset --help` to see available changeset commands.
2. Look at `.github/workflows/ci.yml` and see how the matrix is structured.
3. Push a branch to GitHub to watch the 6 matrix runners execute in parallel.

## Check yourself
1. Why do we test on both Node 20 and Node 24?
2. What does `--frozen-lockfile` prevent in CI?
3. How does Changesets help in a monorepo?

<details>
<summary>Answers</summary>

1. We develop on Node 24, but user backends being traced may run on Node 20. Matrix testing ensures our runtime agent and packages run reliably on both LTS versions.
2. It prevents accidental dependency upgrades during CI and ensures the exact dependencies tested locally are what CI runs.
3. It allows individual packages to be versioned independently or together, generating accurate changelogs and coordinating version bumps across workspace packages automatically.
</details>

## Go deeper
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Changesets Documentation](https://github.com/changesets/changesets)

