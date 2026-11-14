// Task 1.1 "Done when": runs the NestJS fixture with the agent spike hook, sends the PRD's
// failing POST /orders and checks the printed step tree ends in the TypeError.
// Run with `pnpm spike:trace` (builds the agent and the fixture first).
import path from 'node:path';

import { FIXTURES_DIR, REPO_DIR, startApp } from './run-app.ts';
import { groupByTrace, parseTraceLines, treeProblems } from './trace-lines.ts';

const NEST_DIR = path.join(FIXTURES_DIR, 'nestjs-app');
const HOOK = path.join(REPO_DIR, 'packages', 'agent', 'dist', 'spike', 'register.js');
const SETTLE_MS = 500;

// Each one nested under the one before it, as in the PRD example.
const EXPECTED_PATH = [
  '→ OrdersController.create (src/orders/orders.controller.ts:',
  '→ OrdersService.create (src/orders/orders.service.ts:',
  '→ PricingService.calculateDiscount (src/pricing/pricing.service.ts:22)',
];
const EXPECTED_ALSO = [
  '→ AuthGuard.canActivate (src/common/auth.guard.ts:',
  '→ UserService.findById (src/users/user.service.ts:',
  '→ CartService.total (src/cart/cart.service.ts:',
];
const EXPECTED_END =
  "✕ OrdersController.create threw TypeError: Cannot read properties of undefined (reading 'rate')";

async function main(): Promise<void> {
  const app = await startApp('nestjs-app (traced)', path.join(NEST_DIR, 'dist', 'main.js'), {
    nodeArgs: ['--require', HOOK],
    cwd: NEST_DIR,
  });
  const before = app.output().length;
  try {
    const response = await fetch(`${app.url}/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer fixture-token' },
      body: JSON.stringify({ userId: 7 }),
    });
    await response.arrayBuffer();
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

    const groups = [...groupByTrace(parseTraceLines(app.output().slice(before))).values()];
    const lines =
      groups.find((group) => group.some((line) => line.name === 'OrdersController.create')) ?? [];
    const texts = lines.map((line) => line.text);
    const end = texts.findIndex((text) => text.includes(EXPECTED_END));
    const tree = end >= 0 ? texts.slice(0, end + 1) : texts;
    console.log(`POST /orders → ${response.status}\n\n${tree.join('\n')}\n`);

    const problems: string[] = [];
    if (response.status !== 500) problems.push(`expected status 500, got ${response.status}`);
    if (end < 0) problems.push('the tree does not end in the TypeError');
    for (const text of EXPECTED_ALSO) {
      if (!tree.some((line) => line.includes(text))) problems.push(`missing "${text}"`);
    }
    let lastIndent = -1;
    for (const text of EXPECTED_PATH) {
      const line = lines.find((candidate) => candidate.text.includes(text));
      if (!line) {
        problems.push(`missing "${text}"`);
        continue;
      }
      if (line.indent <= lastIndent)
        problems.push(`"${text}" is not nested under the step before it`);
      lastIndent = line.indent;
    }
    problems.push(...treeProblems(lines));

    if (problems.length > 0) {
      console.log(`FAIL\n- ${problems.join('\n- ')}\n\n--- full output ---\n${app.output()}`);
      process.exitCode = 1;
    } else {
      console.log('ok: indented step tree for POST /orders ends in the TypeError');
    }
  } finally {
    app.stop();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
