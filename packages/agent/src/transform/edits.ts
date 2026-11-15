// Text edits on the compiled code: byte offsets from SWC spans, line / column lookup for source
// maps, and applying all insertions in a well-nested order.

export interface Insertion {
  offset: number;
  text: string;
  /** Closing text goes before opening text at the same offset; nesting decides the rest. */
  closing: boolean;
  depth: number;
}

/** 1-based line and 0-based UTF-16 column of a byte offset (what source maps expect). */
export function positions(bytes: Buffer): (offset: number) => { line: number; column: number } {
  const lineStarts = [0];
  for (let i = 0; i < bytes.length; i += 1) if (bytes[i] === 0x0a) lineStarts.push(i + 1);
  return (offset) => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if ((lineStarts[mid] ?? 0) <= offset) low = mid;
      else high = mid - 1;
    }
    const lineStart = lineStarts[low] ?? 0;
    return { line: low + 1, column: bytes.subarray(lineStart, offset).toString('utf8').length };
  };
}

/**
 * Applies insertions. At one offset: closing text goes before opening text (innermost first),
 * except an opening and a closing of the same function (an empty body, `{}`), which open first.
 */
export function apply(bytes: Buffer, insertions: Insertion[]): string {
  const sorted = [...insertions].sort((a, b) => {
    if (a.offset !== b.offset) return a.offset - b.offset;
    if (a.closing !== b.closing) {
      if (a.depth === b.depth) return a.closing ? 1 : -1;
      return a.closing ? -1 : 1;
    }
    return a.closing ? b.depth - a.depth : a.depth - b.depth;
  });
  const parts: Buffer[] = [];
  let cursor = 0;
  for (const insertion of sorted) {
    parts.push(bytes.subarray(cursor, insertion.offset), Buffer.from(insertion.text, 'utf8'));
    cursor = insertion.offset;
  }
  parts.push(bytes.subarray(cursor));
  return Buffer.concat(parts).toString('utf8');
}

/**
 * Names for the generated variables that appear nowhere in the file, so they can never clash
 * with user code (a parameter named like the probe once crashed the app at load time).
 */
export function freeNames(code: string): {
  runtime: string;
  sites: string;
  probe: string;
  error: string;
} {
  const bases = ['__pathlightTracker', '__ptSites', '__pt$', '__pte$'];
  let suffix = '';
  for (let n = 0; bases.some((name) => code.includes(name + suffix)); n += 1) suffix = String(n);
  return {
    runtime: `__pathlightTracker${suffix}`,
    sites: `__ptSites${suffix}`,
    probe: `__pt$${suffix}`,
    error: `__pte$${suffix}`,
  };
}
