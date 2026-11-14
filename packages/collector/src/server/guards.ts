// Host, origin and token checks (`api-spec.md` §3, `architecture.md` §4).
import type { IncomingHttpHeaders } from 'node:http';

import { PROTOCOL_SUBPROTOCOL } from '@pathlight-tracker/protocol';

import { tokensMatch } from './token';

export interface GuardContext {
  port: number;
  token: string;
}

/** `Host` must be the collector itself (blocks DNS rebinding). */
export function hostAllowed(host: string | undefined, port: number): boolean {
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

function originMatches(origin: string, port: number): boolean {
  return origin === `http://127.0.0.1:${port}` || origin === `http://localhost:${port}`;
}

/**
 * REST: a present `Origin` must be the collector's own UI. Browsers leave `Origin` out on
 * same-origin GETs, so a missing one is allowed (the token is still required).
 */
export function restOriginAllowed(origin: string | undefined, port: number): boolean {
  return origin === undefined || originMatches(origin, port);
}

/** `/live` is opened by the browser, which always sends `Origin`: it must match. */
export function liveOriginAllowed(origin: string | undefined, port: number): boolean {
  return origin !== undefined && originMatches(origin, port);
}

/** `/agent` is a Node process, never a browser: any `Origin` means a website is trying. */
export function agentOriginAllowed(origin: string | undefined): boolean {
  return origin === undefined;
}

export function bearerToken(headers: IncomingHttpHeaders): string | undefined {
  const value = headers.authorization;
  return value?.startsWith('Bearer ') ? value.slice('Bearer '.length).trim() : undefined;
}

/** `["pathlight-tracker.v1", "bearer.<token>"]` → the token. */
export function subprotocolToken(headers: IncomingHttpHeaders): string | undefined {
  const offered = (headers['sec-websocket-protocol'] ?? '').split(',').map((part) => part.trim());
  return offered.find((protocol) => protocol.startsWith('bearer.'))?.slice('bearer.'.length);
}

export function offersProtocol(headers: IncomingHttpHeaders): boolean {
  return (headers['sec-websocket-protocol'] ?? '')
    .split(',')
    .map((part) => part.trim())
    .includes(PROTOCOL_SUBPROTOCOL);
}

export { tokensMatch };
