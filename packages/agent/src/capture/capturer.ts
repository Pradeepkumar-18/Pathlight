// One place that turns a runtime value into what is sent: the settings' caps, redaction and
// object IDs together, so no patch can capture a value without redacting it first.
import type { CapturedValue, Settings } from '@pathlight-tracker/protocol';

import { capture } from './capture';
import { createRedactor } from './redact';

export interface Capturer {
  value: (value: unknown, options?: { flagUndefined?: boolean }) => CapturedValue;
  redactUrl: (url: string) => string;
  isSecretKey: (key: string) => boolean;
}

export function createCapturer(
  settings: Pick<Settings, 'maxDepth' | 'maxArray' | 'maxString' | 'redactKeys'>,
  objectIdOf?: (value: object) => string | undefined,
): Capturer {
  const redactor = createRedactor(settings.redactKeys);
  const base = {
    maxDepth: settings.maxDepth,
    maxArray: settings.maxArray,
    maxString: settings.maxString,
    isSecretKey: redactor.isSecretKey,
    objectIdOf,
  };
  return {
    value: (value, options) => capture(value, { ...base, ...options }),
    redactUrl: redactor.redactUrl,
    isSecretKey: redactor.isSecretKey,
  };
}
