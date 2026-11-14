// Parses the agent spike's `[pt <trace>] <indent><→|←|✕> name …` lines.

export interface TraceLine {
  trace: string;
  indent: number;
  kind: '→' | '←' | '✕';
  name: string;
  text: string;
}

const LINE = /^\[pt ([^\]]+)\] ( *)([→←✕]) (\S+)(.*)$/;

export function parseTraceLines(output: string): TraceLine[] {
  const lines: TraceLine[] = [];
  for (const raw of output.split('\n')) {
    const match = LINE.exec(raw.trimEnd());
    if (!match) continue;
    const [, trace = '', spaces = '', kind = '→', name = '', rest = ''] = match;
    lines.push({
      trace,
      indent: spaces.length / 2,
      kind: kind as TraceLine['kind'],
      name,
      text: `${spaces}${kind} ${name}${rest}`,
    });
  }
  return lines;
}

export function groupByTrace(lines: TraceLine[]): Map<string, TraceLine[]> {
  const groups = new Map<string, TraceLine[]>();
  for (const line of lines) {
    if (line.trace === '-') continue;
    groups.set(line.trace, [...(groups.get(line.trace) ?? []), line]);
  }
  return groups;
}

/**
 * Problems with one request's lines: every `→` must be closed by a matching `←` / `✕` at the
 * same indent, and every line's indent must equal the number of steps still open.
 * A line from another request mixed in breaks this.
 */
export function treeProblems(lines: TraceLine[]): string[] {
  const problems: string[] = [];
  const open: TraceLine[] = [];
  for (const line of lines) {
    if (line.kind === '→') {
      if (line.indent !== open.length)
        problems.push(`"${line.text.trim()}" at indent ${line.indent}, expected ${open.length}`);
      open.push(line);
      continue;
    }
    const top = open.pop();
    if (!top || top.name !== line.name || top.indent !== line.indent) {
      problems.push(`"${line.text.trim()}" does not close "${top?.text.trim() ?? 'nothing'}"`);
    }
  }
  for (const line of open) problems.push(`"${line.text.trim()}" never ended`);
  return problems;
}
