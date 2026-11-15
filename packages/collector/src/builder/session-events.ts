// Session-level events: setup warnings (kept once each) and the agent disabling itself.
import { eq } from 'drizzle-orm';

import type { AgentEvent } from '@pathlight-tracker/protocol';

import { sessions } from '../store/schema';
import { updateSession } from '../store/writes';
import type { Tx } from '../store/writes';

type SessionEvent = Extract<AgentEvent, { e: 'warning' | 'agent.disabled' }>;

interface Warning {
  code: string;
  message: string;
  file?: string;
}

export function applySessionEvent(
  tx: Tx,
  sessionId: string,
  event: SessionEvent,
  now: number,
): void {
  if (event.e === 'agent.disabled') {
    updateSession(tx, sessionId, { status: 'disabled', disabledReason: event.reason }, now);
    return;
  }
  const row = tx
    .select({ warnings: sessions.warningsJson })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .get();
  const warnings = (row?.warnings ? JSON.parse(row.warnings) : []) as Warning[];
  if (warnings.some((warning) => warning.code === event.code && warning.file === event.file))
    return;
  warnings.push({
    code: event.code,
    message: event.message,
    ...(event.file !== undefined ? { file: event.file } : {}),
  });
  updateSession(tx, sessionId, { warningsJson: JSON.stringify(warnings) }, now);
}
