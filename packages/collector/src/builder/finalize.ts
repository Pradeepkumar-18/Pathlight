// After `request.end`: decides how each thrown error was handled and marks the red error path
// (decision 0010). Pure function over the request's steps, so it is easy to test.

export interface FinalizeStep {
  id: string;
  parentId: string | null;
  seq: number;
  status: 'running' | 'returned' | 'threw';
}

export type Handling = 'propagated' | 'swallowed' | 'converted' | 'unhandled';

export interface Finalized {
  handling: Map<string, Handling>;
  /** Root → the step that threw, only for an error that reached the response. */
  errorPath: string[];
  errorStepId: string | null;
  hasError: boolean;
}

export function finalize(
  steps: FinalizeStep[],
  response: { status: number; unhandled: boolean },
): Finalized {
  const byId = new Map(steps.map((step) => [step.id, step]));
  const children = new Map<string, FinalizeStep[]>();
  for (const step of steps) {
    if (step.parentId !== null)
      children.set(step.parentId, [...(children.get(step.parentId) ?? []), step]);
  }

  const handling = new Map<string, Handling>();
  for (const step of steps) {
    if (step.status !== 'threw') continue;
    const parent = step.parentId === null ? undefined : byId.get(step.parentId);
    if (parent === undefined) {
      // A root step's error left user code: either nothing handled it, or the framework
      // (exception filter / error middleware) turned it into the response.
      handling.set(step.id, response.unhandled ? 'unhandled' : 'converted');
    } else {
      // The parent threw too: the error went up. The parent finished normally: it was caught.
      handling.set(step.id, parent.status === 'threw' ? 'propagated' : 'swallowed');
    }
  }

  // Red only for an error that reached the response: unhandled, or converted into a 5xx.
  const reachedResponse = response.unhandled || response.status >= 500;
  const errorPath: string[] = [];
  if (reachedResponse) {
    let current = steps.find(
      (step) =>
        step.parentId === null &&
        (handling.get(step.id) === 'converted' || handling.get(step.id) === 'unhandled'),
    );
    while (current) {
      errorPath.push(current.id);
      // Follow the child the error came from (the last one that threw and propagated).
      current = (children.get(current.id) ?? [])
        .filter((child) => handling.get(child.id) === 'propagated')
        .sort((a, b) => b.seq - a.seq)[0];
    }
  }

  return {
    handling,
    errorPath,
    errorStepId: errorPath.at(-1) ?? null,
    hasError: handling.size > 0 || response.unhandled,
  };
}
