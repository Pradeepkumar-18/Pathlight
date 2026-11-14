import { describe, expect, it, vi } from 'vitest';

import { createProgram } from './program';
import type { CliHandlers } from './program';

function setup(env: Record<string, string> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const handlers: CliHandlers = {
    dev: vi.fn(() => 0),
    clear: vi.fn(() => 0),
    doctor: vi.fn(() => 0),
  };
  const cli = createProgram(
    { out: (t) => out.push(t), err: (t) => err.push(t), cwd: () => '/no-config-here', env },
    handlers,
  );
  return { cli, handlers, out: () => out.join(''), err: () => err.join('') };
}

describe('pathlight-tracker CLI', () => {
  it('--help lists the dev, clear and doctor commands', async () => {
    const { cli, out } = setup();
    expect(await cli.run(['--help'])).toBe(0);
    expect(out()).toMatch(/dev \[options\] <command\.\.\.>/);
    expect(out()).toContain('clear');
    expect(out()).toContain('doctor');
  });

  it('dev --help shows the -- separator', async () => {
    const { cli, out } = setup();
    expect(await cli.run(['dev', '--help'])).toBe(0);
    expect(out()).toContain('pathlight-tracker dev [options] -- <command...>');
  });

  it('dev passes the user command through untouched, with flags applied to the config', async () => {
    const { cli, handlers } = setup({ PATHLIGHT_TRACKER_PORT: '4100' });
    expect(
      await cli.run([
        'dev',
        '--port',
        '4200',
        '--no-open',
        '--',
        'npm',
        'run',
        'start:dev',
        '--watch',
      ]),
    ).toBe(0);
    const request = vi.mocked(handlers.dev).mock.calls[0]?.[0];
    expect(request?.command).toEqual(['npm', 'run', 'start:dev', '--watch']);
    expect(request?.config.port).toEqual({ value: 4200, source: 'cli' });
    expect(request?.config.openBrowser).toEqual({ value: false, source: 'cli' });
  });

  it('clear passes --purge and --yes', async () => {
    const { cli, handlers } = setup();
    await cli.run(['clear', '--purge', '-y']);
    expect(vi.mocked(handlers.clear).mock.calls[0]?.[0]).toMatchObject({ purge: true, yes: true });
  });

  it('prints config warnings and still runs the command', async () => {
    const { cli, handlers, err } = setup({ PATHLIGHT_TRACKER_RETENTION: 'lots' });
    expect(await cli.run(['doctor'])).toBe(0);
    expect(handlers.doctor).toHaveBeenCalled();
    expect(err()).toContain('CONFIG_INVALID_VALUE PATHLIGHT_TRACKER_RETENTION');
  });

  it('returns a non-zero exit code for an unknown command', async () => {
    const { cli, err } = setup();
    expect(await cli.run(['launch'])).toBe(1);
    expect(err()).toContain("unknown command 'launch'");
  });

  it('the default (stub) handlers say which task builds the command', async () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const cli = createProgram({
      out: () => undefined,
      err: () => undefined,
      cwd: () => '/x',
      env: {},
    });
    expect(await cli.run(['doctor'])).toBe(1);
    expect(write).toHaveBeenCalledWith(expect.stringContaining('task 5.3'));
    write.mockRestore();
  });
});
