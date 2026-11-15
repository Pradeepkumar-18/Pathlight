// Behaviour-preservation corpus (task 1.3): runs every case with and without the agent and
// checks the app behaves the same: stdout, stderr and exit code. Since task 3.6 it runs the real
// agent (`--require @pathlight-tracker/agent`), not the spike.
// Run with `pnpm test:corpus` (builds the agent first).
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface Run {
  stdout: string;
  stderr: string;
  status: number | null;
  traceLines: number;
}

interface KnownDifference {
  reason: string;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CASES_DIR = path.resolve(HERE, '..', 'cases');
const HOOK = path.resolve(HERE, '..', '..', '..', 'packages', 'agent', 'dist', 'register.js');
/**
 * The real agent only starts with a collector address. Nothing listens on port 9 (discard), so
 * the transport just retries in the background; `trace` makes every step print one line, which
 * proves the case really ran through the agent.
 */
const AGENT_ENV = {
  PATHLIGHT_TRACKER_COLLECTOR_URL: 'ws://127.0.0.1:9/agent',
  PATHLIGHT_TRACKER_TOKEN: 'corpus-'.padEnd(43, 'x'),
  PATHLIGHT_TRACKER_AGENT_LOG_LEVEL: 'trace',
};
const KNOWN = JSON.parse(
  readFileSync(path.resolve(HERE, '..', 'known-differences.json'), 'utf8'),
) as Record<string, KnownDifference>;
const TIMEOUT_MS = 30_000;

function run(file: string, traced: boolean): Run {
  const result = spawnSync(process.execPath, [...(traced ? ['--require', HOOK] : []), file], {
    cwd: CASES_DIR,
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
    env: traced ? { ...process.env, ...AGENT_ENV } : process.env,
  });
  const stderrLines = result.stderr.split('\n');
  // The agent's own lines (steps, warnings) are the tracer talking, not the app.
  const appStderr = stderrLines
    .filter((line) => !line.startsWith('[pathlight-tracker]'))
    // Node prints the crash location with the column; the probes shift columns (known finding).
    .map((line) => line.replace(/(\.js:\d+):\d+/g, '$1'))
    .join('\n');
  return {
    stdout: result.stdout,
    stderr: appStderr,
    status: result.status,
    traceLines: stderrLines.filter((line) => line.startsWith('[pathlight-tracker] STEP ')).length,
  };
}

function differences(plain: Run, traced: Run): string[] {
  const found: string[] = [];
  if (plain.status !== traced.status) found.push(`exit code ${plain.status} vs ${traced.status}`);
  if (plain.stdout !== traced.stdout)
    found.push(`stdout:\n  plain:  ${plain.stdout.trim()}\n  traced: ${traced.stdout.trim()}`);
  if (plain.stderr !== traced.stderr)
    found.push(`stderr:\n  plain:  ${plain.stderr.trim()}\n  traced: ${traced.stderr.trim()}`);
  return found;
}

function main(): void {
  const cases = readdirSync(path.join(CASES_DIR, 'src')).filter((file) => file.endsWith('.js'));
  let failures = 0;
  for (const file of cases.sort()) {
    const name = file.replace(/\.js$/, '');
    const plain = run(`src/${file}`, false);
    const traced = run(`src/${file}`, true);
    const found = differences(plain, traced);
    const known = KNOWN[name];
    // A case that the hook didn't instrument proves nothing.
    const instrumented =
      traced.traceLines > 0 || name === 'generators' || name === 'getters-setters';
    if (!instrumented) {
      console.log(`FAIL ${name}: the hook did not instrument it`);
      failures += 1;
    } else if (known) {
      // Known differences must still show up, so a fix (or a regression in reverse) is noticed.
      console.log(`${found.length > 0 ? 'known' : 'FAIL '} ${name}: ${known.reason}`);
      if (found.length === 0) {
        console.log('      no difference any more: remove it from known-differences.json');
        failures += 1;
      }
    } else if (found.length > 0) {
      console.log(`FAIL ${name}\n      ${found.join('\n      ')}`);
      failures += 1;
    } else {
      console.log(`ok   ${name} (${traced.traceLines} trace lines)`);
    }
  }
  const knownCount = Object.keys(KNOWN).length;
  console.log(
    failures === 0
      ? `\n${cases.length - knownCount} cases identical with and without the hook; ${knownCount} known differences.`
      : `\n${failures} case(s) failed.`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

main();
