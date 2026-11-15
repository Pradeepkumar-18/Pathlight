// Agent events → step row fields (`data-model.md` §3.3, §6 `detail_json` shapes). Pure functions.
import type { AgentEvent, CapturedValue, StepKind } from '@pathlight-tracker/protocol';

import type { NewStep } from '../store/writes';

/** A step row before the builder adds `seq`, depth, request, start offset and timestamps. */
export type StepFields = Omit<
  NewStep,
  'seq' | 'depth' | 'requestId' | 'startOffsetNs' | 'createdAt' | 'updatedAt'
>;

type Event<E extends AgentEvent['e']> = Extract<AgentEvent, { e: E }>;

export const json = (value: unknown): string | null =>
  value === undefined || value === null ? null : JSON.stringify(value);

/** `OrdersService.create` → class `OrdersService`, function `create`. */
export function splitName(
  kind: StepKind,
  name: string,
): { className: string | null; functionName: string | null } {
  if (kind === 'boundary' || kind === 'decision') return { className: null, functionName: null };
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return { className: null, functionName: name === '(anonymous)' ? null : name };
  return { className: name.slice(0, dot), functionName: name.slice(dot + 1) };
}

const location = (event: {
  file?: string | null;
  line?: number | null;
  column?: number | null;
}) => ({
  file: event.file ?? null,
  line: event.line ?? null,
  column: event.column ?? null,
});

export function enterRow(event: Event<'step.enter'>): StepFields {
  return {
    id: event.stepId,
    parentId: event.parentStepId ?? null,
    kind: event.kind,
    name: event.name,
    ...splitName(event.kind, event.name),
    ...location(event),
    isAsync: event.isAsync ? 1 : 0,
    status: 'running',
    argsJson: json(event.args),
    argNamesJson: json(event.argNames),
    thisClass: event.thisClass ?? null,
  };
}

/**
 * One finished DB / HTTP call. `request` and `response` together make `detail_json`, except a
 * captured `returnValue`, which becomes the step's return value (api-spec §11.1).
 */
export function boundaryRow(event: Event<'boundary'>): StepFields {
  const { returnValue, ...response } = (event.response ?? {}) as {
    returnValue?: CapturedValue;
  } & Record<string, unknown>;
  const derived = [event.request.collectionOrTable, event.request.operation]
    .filter((part) => typeof part === 'string')
    .join('.');
  return {
    id: event.stepId,
    parentId: event.parentStepId ?? null,
    kind: 'boundary',
    boundaryType: event.boundaryType,
    name: event.name ?? (derived || event.boundaryType),
    className: null,
    functionName: null,
    ...location(event),
    isAsync: event.isAsync ? 1 : 0,
    status: event.error ? 'threw' : 'returned',
    returnJson: json(returnValue),
    errorJson: json(event.error),
    detailJson: JSON.stringify({ ...event.request, ...response }),
    durationNs: Number(event.durationNs),
  };
}

export function decisionRow(event: Event<'decision'>): StepFields {
  return {
    id: event.stepId,
    parentId: event.parentStepId ?? null,
    kind: 'decision',
    name: `${event.decisionType === 'switch' ? 'switch' : 'if'} (${event.expression})`,
    className: null,
    functionName: null,
    ...location(event),
    isAsync: 0,
    status: 'returned',
    detailJson: JSON.stringify({
      decisionType: event.decisionType,
      expression: event.expression,
      values: event.values,
      result: event.result,
      branch: event.branch,
    }),
  };
}
