// A captured request as a cURL command (`api-spec.md` §6.5). Redacted values stay placeholders;
// the address comes from the captured `host` header, else a `localhost:<port>` placeholder.
import type { CapturedValue } from '@pathlight-tracker/protocol';

type Children = Record<string, CapturedValue>;

const quote = (text: string): string => `'${text.replace(/'/g, `'\\''`)}'`;

function childMap(value: CapturedValue | null | undefined): Children {
  const children = value?.children;
  return children && !Array.isArray(children) ? children : {};
}

/** Text of a captured string ("\"abc\"" → abc); other types keep their preview. */
function text(value: CapturedValue): string {
  if (value.redacted) return '<REDACTED>';
  if (value.type === 'string' && /^".*"$/s.test(value.preview)) {
    try {
      return JSON.parse(value.preview) as string;
    } catch {
      return value.preview.slice(1, -1);
    }
  }
  return value.preview;
}

/** Rebuilds JSON from a captured value's children; falls back to the preview when it can't. */
function json(value: CapturedValue): string {
  if (value.redacted) return '"<REDACTED>"';
  const children = value.children;
  if (Array.isArray(children)) return `[${children.map(json).join(',')}]`;
  if (children)
    return `{${Object.entries(children)
      .map(([key, child]) => `${JSON.stringify(key)}:${json(child)}`)
      .join(',')}}`;
  if (value.type === 'string') return JSON.stringify(text(value));
  if (['number', 'boolean', 'null'].includes(value.type)) return value.preview;
  return value.preview;
}

export function toCurl(input: {
  method: string;
  path: string;
  request: {
    query: CapturedValue | null;
    body: CapturedValue | null;
    headers: CapturedValue | null;
  };
}): { command: string; truncated: boolean } {
  const headers = childMap(input.request.headers);
  const hostHeader = headers.host;
  const host = hostHeader && !hostHeader.redacted ? text(hostHeader) : 'localhost:<port>';
  const lines = [`curl -X ${input.method} ${quote(`http://${host}${input.path}`)}`];
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === 'host' || name.toLowerCase() === 'content-length') continue;
    lines.push(`  -H ${quote(`${name}: ${text(value)}`)}`);
  }
  const body = input.request.body;
  if (body && body.type !== 'undefined' && body.type !== 'null')
    lines.push(`  --data-raw ${quote(json(body))}`);
  const truncated = [body, input.request.headers].some((value) => value?.truncated === true);
  return { command: `${lines.join(' \\\n')}\n`, truncated };
}
