// The layer badge for method steps (`design.md` §2.5 layer rule, `api-spec.md` `Layer`): set by
// the collector from the class name suffix; the UI only displays it.
import type { Layer, StepKind } from '@pathlight-tracker/protocol';

export function layerOf(kind: StepKind, className: string | null): Layer | null {
  if (kind !== 'method') return null;
  if (className === null) return 'fn';
  if (className.endsWith('Controller')) return 'controller';
  if (className.endsWith('Service')) return 'service';
  if (className.endsWith('Repository') || className.endsWith('Repo')) return 'repository';
  return 'fn';
}
