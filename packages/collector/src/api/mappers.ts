// Store rows → API shapes (`api-spec.md` §4): ISO times, nanoseconds as strings, parsed JSON.
import { statSync } from 'node:fs';
import path from 'node:path';

import type {
  CapturedValue,
  HttpMethod,
  RequestDetail,
  RequestSummary,
  Session,
  StepDetail,
  StepSummary,
  TrashItem,
} from '@pathlight-tracker/protocol';

import { layerOf } from '../builder/layer';
import type { RequestRow } from '../store/requests';
import type { sessions } from '../store/schema';
import type { StepRow } from '../store/steps';
import { parseStack } from './stack';

export type SessionRow = typeof sessions.$inferSelect;

const HOUR_MS = 60 * 60 * 1000;
export const iso = (ms: number): string => new Date(ms).toISOString();
const isoOrNull = (ms: number | null): string | null => (ms === null ? null : iso(ms));
const nsOrNull = (ns: number | null): string | null => (ns === null ? null : String(ns));
const parse = <T>(text: string | null): T | null =>
  text === null ? null : (JSON.parse(text) as T);

export function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    pid: row.pid,
    command: row.command,
    framework: row.framework,
    nodeVersion: row.nodeVersion,
    agentVersion: row.agentVersion,
    status: row.status,
    disabledReason: row.disabledReason,
    connectedAt: iso(row.connectedAt),
    disconnectedAt: isoOrNull(row.disconnectedAt),
  };
}

export function toRequestSummary(row: RequestRow): RequestSummary {
  return {
    id: row.id,
    sessionId: row.sessionId,
    // MVP requests are HTTP, which the schema guarantees have a method and a path.
    method: row.method as HttpMethod,
    path: row.path ?? '',
    route: row.route,
    state: row.state,
    httpStatus: row.httpStatus,
    hasError: row.hasError === 1,
    stepCount: row.stepCount,
    truncated: row.truncated === 1,
    startedAt: iso(row.startedAt),
    durationNs: nsOrNull(row.durationNs),
  };
}

export function toRequestDetail(
  row: RequestRow,
  session: SessionRow,
  errorPath: string[],
): RequestDetail {
  const request = parse<RequestDetail['request']>(row.requestJson) ?? {
    params: null,
    query: null,
    body: null,
    headers: null,
  };
  return {
    ...toRequestSummary(row),
    endedAt: isoOrNull(row.endedAt),
    request,
    response: parse<NonNullable<RequestDetail['response']>>(row.responseJson),
    errorStepId: row.errorStepId,
    errorPath,
    deletedAt: isoOrNull(row.deletedAt),
    session: toSession(session),
  };
}

export function toTrashItem(row: RequestRow, trashTtlHours: number): TrashItem {
  const deletedAt = row.deletedAt ?? 0;
  return {
    ...toRequestSummary(row),
    deletedAt: iso(deletedAt),
    purgeAt: iso(deletedAt + trashTtlHours * HOUR_MS),
  };
}

function anySuspicious(value: CapturedValue | null | undefined): boolean {
  if (!value) return false;
  if (value.suspicious === true) return true;
  const children = value.children;
  if (!children) return false;
  return (Array.isArray(children) ? children : Object.values(children)).some(anySuspicious);
}

export function toStepSummary(row: StepRow, childCount: number): StepSummary {
  const returnValue = parse<CapturedValue>(row.returnJson);
  const args = parse<CapturedValue[]>(row.argsJson) ?? [];
  const error = parse<{ type: string; message: string }>(row.errorJson);
  const decisionValues =
    row.kind === 'decision'
      ? Object.values(
          parse<{ values?: Record<string, CapturedValue> }>(row.detailJson)?.values ?? {},
        )
      : [];
  return {
    id: row.id,
    parentId: row.parentId,
    seq: row.seq,
    depth: row.depth,
    kind: row.kind,
    layer: layerOf(row.kind, row.className),
    name: row.name,
    file: row.file,
    line: row.line,
    column: row.column,
    isAsync: row.isAsync === 1,
    status: row.status,
    errorHandling: row.errorHandling,
    boundaryType: row.boundaryType,
    onErrorPath: row.onErrorPath === 1,
    collapsedCount: row.collapsedCount,
    childCount,
    startOffsetNs: String(row.startOffsetNs),
    durationNs: nsOrNull(row.durationNs),
    returnPreview: row.status === 'returned' ? (returnValue?.preview ?? null) : null,
    errorMessage: error ? `${error.type}: ${error.message}` : null,
    hasSuspiciousValue: [returnValue, ...args, ...decisionValues].some(anySuspicious),
  };
}

/** The file changed (or disappeared) after the request ran (`user-flows.md` §7). */
function changedSince(file: string | null, startedAt: number): boolean {
  if (file === null) return false;
  try {
    return statSync(file).mtimeMs > startedAt;
  } catch {
    return true;
  }
}

export function toStepDetail(
  row: StepRow,
  context: { childCount: number; parent: StepRow | undefined; cwd: string; startedAt: number },
): StepDetail {
  const error = parse<{
    type: string;
    message: string;
    stack?: string;
    file?: string | null;
    line?: number | null;
    column?: number | null;
  }>(row.errorJson);
  const absolutePath = row.file === null ? null : path.resolve(context.cwd, row.file);
  return {
    ...toStepSummary(row, context.childCount),
    requestId: row.requestId,
    className: row.className,
    functionName: row.functionName,
    thisClass: row.thisClass,
    args: parse<CapturedValue[]>(row.argsJson),
    argNames: parse<string[]>(row.argNamesJson),
    returnValue: parse<CapturedValue>(row.returnJson),
    error: error
      ? {
          type: error.type,
          message: error.message,
          stack: parseStack(error.stack),
          file: error.file ?? null,
          line: error.line ?? null,
          column: error.column ?? null,
        }
      : null,
    detail: parse<Record<string, unknown>>(row.detailJson),
    calledBy: context.parent ? { id: context.parent.id, name: context.parent.name } : null,
    absolutePath,
    fileChangedSince: changedSince(absolutePath, context.startedAt),
  };
}
