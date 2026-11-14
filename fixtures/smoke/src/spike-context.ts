// Task 1.2 "Done when": 20 concurrent requests to the traced NestJS fixture produce 20
// separate, well-formed step trees with no mixed lines.
// Run with `pnpm spike:context` (builds the agent and the fixture first).
import path from 'node:path';

import { FIXTURES_DIR, REPO_DIR, startApp } from './run-app.ts';
import { groupByTrace, parseTraceLines, treeProblems } from './trace-lines.ts';

const NEST_DIR = path.join(FIXTURES_DIR, 'nestjs-app');
const HOOK = path.join(REPO_DIR, 'packages', 'agent', 'dist', 'spike', 'register.js');
const REQUESTS = 20;
const SETTLE_MS = 1000;
const FAILED_END =
  "✕ OrdersController.create threw TypeError: Cannot read properties of undefined (reading 'rate')";

async function main(): Promise<void> {
  const app = await startApp('nestjs-app (traced)', path.join(NEST_DIR, 'dist', 'main.js'), {
    nodeArgs: ['--require', HOOK],
    cwd: NEST_DIR,
  });
  const before = app.output().length;
  try {
    // Half fail (user 7, the PRD bug), half succeed (gold user 8), all at once.
    const statuses = await Promise.all(
      Array.from({ length: REQUESTS }, async (_, index) => {
        const response = await fetch(`${app.url}/orders`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: 'Bearer fixture-token' },
          body: JSON.stringify({ userId: index % 2 === 0 ? 7 : 8 }),
        });
        await response.arrayBuffer();
        return response.status;
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

    const lines = parseTraceLines(app.output().slice(before));
    const groups = groupByTrace(lines);
    const problems: string[] = [];
    const failed = statuses.filter((status) => status === 500).length;
    const created = statuses.filter((status) => status === 201).length;
    if (failed !== REQUESTS / 2 || created !== REQUESTS / 2) {
      problems.push(
        `expected ${REQUESTS / 2} × 500 and ${REQUESTS / 2} × 201, got ${statuses.join(', ')}`,
      );
    }
    if (groups.size !== REQUESTS) problems.push(`expected ${REQUESTS} traces, got ${groups.size}`);

    let failedTrees = 0;
    let createdTrees = 0;
    for (const [trace, group] of groups) {
      for (const problem of treeProblems(group)) problems.push(`${trace}: ${problem}`);
      const handler = group.filter((line) => line.name === 'OrdersController.create');
      if (handler.length !== 2)
        problems.push(`${trace}: expected one OrdersController.create step`);
      if (group.some((line) => line.text.trim().startsWith(FAILED_END))) failedTrees += 1;
      else if (handler.some((line) => line.kind === '←')) createdTrees += 1;
    }
    if (failedTrees !== REQUESTS / 2 || createdTrees !== REQUESTS / 2) {
      problems.push(
        `expected ${REQUESTS / 2} failing and ${REQUESTS / 2} successful trees, got ${failedTrees} and ${createdTrees}`,
      );
    }

    const interleaved = lines.filter(
      (line, index) => index > 0 && line.trace !== lines[index - 1]?.trace,
    ).length;
    console.log(
      `${REQUESTS} concurrent POST /orders → ${failed} × 500, ${created} × 201\n` +
        `${groups.size} traces, ${lines.length} lines, output switched between traces ${interleaved} times\n`,
    );
    const sample = [...groups.values()][0] ?? [];
    console.log(
      `First trace:\n${sample.map((line) => `[pt ${line.trace}] ${line.text}`).join('\n')}\n`,
    );

    if (problems.length > 0) {
      console.log(`FAIL\n- ${problems.join('\n- ')}`);
      process.exitCode = 1;
    } else {
      console.log(`ok: ${REQUESTS} separate, well-formed trees with no mixed lines`);
    }
  } finally {
    app.stop();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
