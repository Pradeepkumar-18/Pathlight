// Events waiting to be sent (`architecture.md` §10): bounded by count and bytes. When full, whole
// requests are dropped, oldest first, never part of one: a dropped request's later events are
// discarded too, so the collector never builds a tree with holes in the middle.
import type { AgentEvent } from '@pathlight-tracker/protocol';

export const MAX_BUFFERED_EVENTS = 10_000;
export const MAX_BUFFERED_BYTES = 8 * 1024 * 1024;

export interface Entry {
  traceId: string | null;
  /** The request's last event: once it is gone, nothing more of that request will arrive. */
  end: boolean;
  json: string;
  bytes: number;
}

export interface BufferLimits {
  maxEvents: number;
  maxBytes: number;
}

export class EventBuffer {
  private pending: Entry[] = [];
  private pendingBytes = 0;
  /** Requests dropped while running: their remaining events are discarded as they arrive. */
  private dropped = new Set<string>();
  droppedRequests = 0;

  constructor(
    private readonly limits: BufferLimits = {
      maxEvents: MAX_BUFFERED_EVENTS,
      maxBytes: MAX_BUFFERED_BYTES,
    },
  ) {}

  get size(): number {
    return this.pending.length;
  }

  get bytes(): number {
    return this.pendingBytes;
  }

  /**
   * Adds an event. `inFlight` counts events sent but not yet acknowledged, which also hold
   * memory. Returns false when the event was discarded (its request was dropped).
   */
  push(event: AgentEvent, inFlight: { events: number; bytes: number }): boolean {
    const traceId = event.traceId;
    if (traceId !== null && this.dropped.has(traceId)) {
      if (event.e === 'request.end') this.dropped.delete(traceId);
      return false;
    }
    const json = JSON.stringify(event);
    const bytes = Buffer.byteLength(json);
    this.pending.push({ traceId, end: event.e === 'request.end', json, bytes });
    this.pendingBytes += bytes;
    while (
      this.pending.length + inFlight.events > this.limits.maxEvents ||
      this.pendingBytes + inFlight.bytes > this.limits.maxBytes
    ) {
      if (!this.dropOldestRequest()) break;
    }
    return !(traceId !== null && this.dropped.has(traceId));
  }

  /** Puts events from batches that were never acknowledged back at the front, in order. */
  requeue(entries: Entry[]): void {
    this.pending = [...entries, ...this.pending];
    this.pendingBytes += entries.reduce((sum, entry) => sum + entry.bytes, 0);
  }

  /** Takes the next batch, within the collector's limits (`welcome.limits`). */
  take(maxEvents: number, maxBytes: number, overhead: number): Entry[] {
    const batch: Entry[] = [];
    let bytes = overhead;
    while (batch.length < maxEvents && this.pending.length > 0) {
      const next = this.pending[0];
      if (!next) break;
      // +1 for the comma between events.
      if (batch.length > 0 && bytes + next.bytes + 1 > maxBytes) break;
      batch.push(next);
      bytes += next.bytes + 1;
      this.pending.shift();
      this.pendingBytes -= next.bytes;
    }
    return batch;
  }

  private dropOldestRequest(): boolean {
    const oldest = this.pending.find((entry) => entry.traceId !== null)?.traceId;
    if (oldest === undefined || oldest === null) return false;
    const kept = this.pending.filter((entry) => entry.traceId !== oldest);
    const ended = this.pending.some((entry) => entry.traceId === oldest && entry.end);
    this.pending = kept;
    this.pendingBytes = kept.reduce((sum, entry) => sum + entry.bytes, 0);
    if (!ended) this.dropped.add(oldest);
    this.droppedRequests += 1;
    return true;
  }
}
