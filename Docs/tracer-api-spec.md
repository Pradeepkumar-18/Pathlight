# Tracer: API Spec

Tracer's backend is the **collector**, a local Node process started by `npx tracer dev`. It exposes:

- a **REST API** under `/api/v1` (used by the map UI, later the VS Code extension and an MCP server), and
- two **WebSocket channels**: `/agent` (runtime agent → collector) and `/live` (collector → UI).

Everything runs on the developer's machine at `http://127.0.0.1:<port>`. There is no cloud API.

Related docs: `tracer-architecture.md` (§4 auth, §6 API approach), `tracer-data-model.md` (tables, soft delete), `tracer-user-flows.md` (which screen calls what).

---

## 0. Checklist at a glance

| Checkpoint | Where |
| --- | --- |
| Every endpoint (method + path) | §2 (index), §5–§7 |
| Purpose of each endpoint | §2, §5–§7 |
| Request body / params with types | §5–§7 |
| Response shape (success example) | §5–§7, shared types in §4 |
| Error responses and status codes | §8 |
| Auth required? Roles? | §3 |
| Pagination, filtering, sorting | §9 |
| Rate limits | §10 |

---

## 1. Conventions

| Topic | Rule |
| --- | --- |
| Base URL | `http://127.0.0.1:<port>` (random port per run, or `TRACER_PORT`) |
| Version | REST under `/api/v1`; every WebSocket message carries `v` (protocol version, currently `1`) |
| Format | JSON (`Content-Type: application/json; charset=utf-8`), except `…/curl` which returns `text/plain` |
| Field names | camelCase |
| IDs | Prefixed ULIDs: `ses_…` (session), `req_…` (request), `stp_…` (step); objects `obj_…` |
| Wall-clock times | ISO 8601 UTC strings, e.g. `"2026-10-30T06:34:58.120Z"` |
| Durations and offsets | Nanoseconds as **strings** (`"durationNs": "84000000"`) to avoid JavaScript number precision loss |
| Captured values | Always the `CapturedValue` shape (§4.1); already redacted and truncated by the agent |
| Validation | Every request and message is validated with Zod schemas from `packages/protocol` |
| Response headers | `X-Tracer-Version: 0.1.0`, `Cache-Control: no-store` on all `/api` responses |
| Trash | Soft-deleted requests are hidden from every endpoint except the trash endpoints, unless `includeDeleted=true` is passed where noted |

---

## 2. Endpoint index

### REST

| # | Method | Path | Purpose | Phase |
| --- | --- | --- | --- | --- |
| 1 | `GET` | `/api/v1/health` | Collector status, version, connected agents | MVP |
| 2 | `GET` | `/api/v1/config` | Effective configuration and where each value came from (Settings screen) | MVP |
| 3 | `GET` | `/api/v1/sessions` | App processes seen (starts and restarts) | MVP |
| 4 | `GET` | `/api/v1/requests` | List active requests (paginated, filterable, sortable) | MVP |
| 5 | `GET` | `/api/v1/requests/:requestId` | One request: summary, captured request and response, error path | MVP |
| 6 | `GET` | `/api/v1/requests/:requestId/steps` | Steps of a request (whole tree or one level, paginated) | MVP |
| 7 | `GET` | `/api/v1/steps/:stepId` | One step with full captured values | MVP |
| 8 | `GET` | `/api/v1/requests/:requestId/curl` | The request as a cURL command (secrets left as placeholders) | MVP |
| 9 | `DELETE` | `/api/v1/requests/:requestId` | Move one finished request to the trash (soft delete) | MVP |
| 10 | `DELETE` | `/api/v1/requests/:requestId?permanent=true` | Delete one request permanently | MVP |
| 11 | `DELETE` | `/api/v1/requests` | Move all finished requests to the trash ("Clear all") | MVP |
| 12 | `POST` | `/api/v1/requests/:requestId/restore` | Restore a request from the trash | MVP |
| 13 | `GET` | `/api/v1/trash` | List trashed requests | MVP |
| 14 | `DELETE` | `/api/v1/trash` | Empty the trash (permanent) | MVP |
| 15 | `GET` | `/api/v1/sample` | Read-only sample request for onboarding ("Load sample data") | MVP |
| 16 | `GET` | `/api/v1/requests/:requestId/logs` | `console.log` output captured during a request (Logs tab) | v1 |
| 17 | `GET` | `/api/v1/search` | Search steps by function name, file or captured value | v1 |
| 18 | `GET` | `/api/v1/compare` | Differences between two requests | v1 |
| 19 | `POST` | `/api/v1/client-logs` | UI reports its own errors into the collector log | v1 |
| 20 | `GET` | `/api/v1/requests/:requestId/objects/:objectId` | Data journey: every step an object passed through | v2 |

### WebSocket

| # | Path | Direction | Purpose | Phase |
| --- | --- | --- | --- | --- |
| W1 | `/agent` | Agent → collector (with replies) | Agent sends `hello` and batches of recorded events | MVP |
| W2 | `/live` | Collector → UI (with subscriptions) | Pushes new requests, steps, completion, deletes and agent status | MVP |

---

## 3. Auth

Tracer has **no users and no roles**. Every protected call must prove it belongs to the current collector run.

| Mechanism | Detail |
| --- | --- |
| Token | 32 random bytes (base64url), generated each time the collector starts; given to the agent via `TRACER_TOKEN` and to the UI via the URL fragment `#token=…` |
| REST | `Authorization: Bearer <token>` |
| WebSocket | Browsers cannot set headers on WebSockets, so both channels pass the token as a subprotocol: `new WebSocket(url, ["tracer.v1", "bearer.<token>"])`. The server answers with subprotocol `tracer.v1` |
| Origin check | `/api/*` and `/live` accept only `Origin: http://127.0.0.1:<port>` or `http://localhost:<port>` (Phase 2: the VS Code webview origin). `/agent` must send **no** `Origin` (it is a Node process, not a browser) |
| Host check | `Host` must be `127.0.0.1:<port>` or `localhost:<port>` (blocks DNS rebinding) |
| Network | Server binds `127.0.0.1` only |

| Endpoint | Auth required | Roles |
| --- | --- | --- |
| `GET /`, static UI files | No (contains no data) | — |
| Every `/api/v1/*` endpoint | Yes: token + origin + host | None (single user) |
| `WS /agent` | Yes: token + host; no browser origin | None |
| `WS /live` | Yes: token + origin + host | None |

---

## 4. Shared types

```ts
// 4.1 Captured value (already redacted and size-limited by the agent)
type CapturedValue = {
  type: 'string' | 'number' | 'boolean' | 'null' | 'undefined' | 'bigint'
      | 'symbol' | 'function' | 'object' | 'array' | 'map' | 'set'
      | 'date' | 'error' | 'buffer' | 'promise' | 'circular';
  preview: string;
  className?: string;
  objectId?: string;          // "obj_3"
  size?: number;
  truncated?: boolean;
  redacted?: boolean;
  suspicious?: boolean;       // undefined/NaN inside an object: UI shows ⚠
  children?: Record<string, CapturedValue> | CapturedValue[];
};

// 4.2 Enums
type HttpMethod   = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
type RequestState = 'in_progress' | 'completed' | 'incomplete';
type StepKind     = 'function' | 'method' | 'middleware' | 'guard' | 'interceptor' | 'pipe'
                  | 'handler' | 'filter' | 'boundary' | 'constructor' | 'callback' | 'decision' | 'loop';
type StepStatus   = 'running' | 'returned' | 'threw';
type ErrorHandling = 'propagated' | 'swallowed' | 'converted' | 'unhandled';
type BoundaryType = 'db' | 'http' | 'redis' | 'queue' | 'log' | 'fs';
type Layer        = 'controller' | 'service' | 'repository' | 'fn';   // derived from class name

// 4.3 Session
type Session = {
  id: string;                 // "ses_…"
  pid: number;
  command: string | null;
  framework: 'nestjs' | 'express' | 'unknown';
  nodeVersion: string;
  agentVersion: string;
  status: 'connected' | 'disconnected' | 'disabled';
  disabledReason: string | null;
  connectedAt: string;
  disconnectedAt: string | null;
};

// 4.4 Request in a list
type RequestSummary = {
  id: string;                 // "req_…"
  sessionId: string;
  method: HttpMethod;
  path: string;               // "/orders/42"
  route: string | null;       // "/orders/:id"
  state: RequestState;
  httpStatus: number | null;  // null while in progress
  hasError: boolean;
  stepCount: number;
  truncated: boolean;
  startedAt: string;
  durationNs: string | null;
};

// 4.5 One request in full
type RequestDetail = RequestSummary & {
  endedAt: string | null;
  request: { params: CapturedValue | null; query: CapturedValue | null;
             body: CapturedValue | null; headers: CapturedValue | null };
  response: { headers: CapturedValue | null; body: CapturedValue | null } | null;
  errorStepId: string | null;
  errorPath: string[];        // step ids from root to the error, for auto-expansion
  deletedAt: string | null;   // set only when read with includeDeleted=true
  session: Session;
};

// 4.6 Step in a tree (previews only)
type StepSummary = {
  id: string;                 // "stp_…"
  parentId: string | null;
  seq: number;
  depth: number;
  kind: StepKind;
  layer: Layer | null;        // for method steps
  name: string;               // "PricingService.calculateDiscount"
  file: string | null;        // "src/pricing/pricing.service.ts"
  line: number | null;
  column: number | null;
  isAsync: boolean;
  status: StepStatus;
  errorHandling: ErrorHandling | null;
  boundaryType: BoundaryType | null;
  onErrorPath: boolean;
  collapsedCount: number;
  childCount: number;
  startOffsetNs: string;
  durationNs: string | null;
  returnPreview: string | null;   // "User { id: 7, tier: undefined }"
  errorMessage: string | null;    // "TypeError: Cannot read …"
  hasSuspiciousValue: boolean;
};

// 4.7 Step in full
type StepDetail = StepSummary & {
  requestId: string;
  className: string | null;
  functionName: string | null;
  thisClass: string | null;
  args: CapturedValue[] | null;
  argNames: string[] | null;      // ["user", "total"] when known from source
  returnValue: CapturedValue | null;
  error: { type: string; message: string; stack: StackFrame[]; file: string | null; line: number | null } | null;
  detail: Record<string, unknown> | null;   // boundary / decision / loop / guard / pipe detail (data-model §6)
  calledBy: { id: string; name: string } | null;
  editorUrl: string | null;       // built from TRACER_EDITOR, e.g. "vscode://file/…:22:3"
};

type StackFrame = { fn: string | null; file: string; line: number; column: number; internal: boolean };

// 4.8 Page wrapper for lists
type Page<T> = {
  data: T[];
  page: { limit: number; nextCursor: string | null; total: number };
};

// 4.9 Error envelope (every non-2xx response)
type ApiError = {
  error: { code: string; message: string; details?: Record<string, unknown> };
};
```

---

## 5. REST endpoints: status, config, sessions

### 5.1 `GET /api/v1/health`

Collector status, used by the header connection pill and `tracer doctor`.

**Params:** none.

**200 OK**

```json
{
  "status": "ok",
  "collectorVersion": "0.1.0",
  "protocolVersion": 1,
  "startedAt": "2026-10-30T06:30:00.000Z",
  "project": { "name": "shop-api", "cwd": "/home/dev/shop-api" },
  "agents": [
    { "sessionId": "ses_01JBSEED0000000000000001", "pid": 48213, "framework": "nestjs", "status": "connected" }
  ],
  "storage": { "mode": "sqlite", "activeRequests": 2, "trashedRequests": 1 }
}
```

`storage.mode` is `"memory"` when `.tracer/` could not be written (data is lost when the collector stops).

**Errors:** `401`, `403`, `429`.

### 5.2 `GET /api/v1/config`

Effective configuration for the Settings screen. Read-only.

**200 OK**

```json
{
  "data": {
    "include":        { "value": ["src/**"], "source": "default" },
    "exclude":        { "value": ["**/*.spec.ts", "**/*.test.ts"], "source": "default" },
    "redactKeys":     { "value": ["password", "token", "authorization", "secret", "cookie", "apiKey", "otp"], "source": "env" },
    "maxDepth":       { "value": 3, "source": "default" },
    "maxArray":       { "value": 10, "source": "default" },
    "maxString":      { "value": 200, "source": "default" },
    "maxSteps":       { "value": 5000, "source": "default" },
    "retention":      { "value": 100, "source": "default" },
    "trashTtlHours":  { "value": 72, "source": "default" },
    "editor":         { "value": "vscode://file/{path}:{line}:{column}", "source": "config-file" }
  }
}
```

`source` is one of `default`, `config-file`, `env`, `cli`.

**Errors:** `401`, `403`, `429`.

### 5.3 `GET /api/v1/sessions`

App processes seen by this collector (each start or watch-mode restart).

| Query param | Type | Default | Notes |
| --- | --- | --- | --- |
| `status` | `connected` \| `disconnected` \| `disabled` | all | Filter |

**200 OK:** `{ "data": Session[] }`, newest first (not paginated; sessions are few).

**Errors:** `400 INVALID_PARAMS`, `401`, `403`, `429`.

---

## 6. REST endpoints: requests and steps

### 6.1 `GET /api/v1/requests`

List active (not trashed) requests for the request list.

| Query param | Type | Default | Notes |
| --- | --- | --- | --- |
| `limit` | integer 1–200 | `50` | Page size |
| `cursor` | string | — | From `page.nextCursor` |
| `sort` | `-startedAt` \| `startedAt` \| `-durationNs` \| `durationNs` | `-startedAt` | See §9 |
| `method` | comma list of `HttpMethod` | — | `method=GET,POST` |
| `status` | comma list of exact codes or classes | — | `status=500` or `status=4xx,5xx` |
| `hasError` | `true` \| `false` | — | Includes swallowed errors |
| `state` | comma list of `RequestState` | — | `state=in_progress` |
| `path` | string (max 200) | — | Case-insensitive substring match on path |
| `route` | string | — | Exact route pattern, e.g. `/orders/:id` |
| `sessionId` | string | — | Only one app process |
| `since`, `until` | ISO 8601 | — | Filter on `startedAt` |
| `minDurationMs` | number | — | "Slow" filter |

**200 OK:** `Page<RequestSummary>`

```json
{
  "data": [
    {
      "id": "req_01JBSEED0000000000000002",
      "sessionId": "ses_01JBSEED0000000000000001",
      "method": "GET",
      "path": "/orders/42",
      "route": "/orders/:id",
      "state": "completed",
      "httpStatus": 200,
      "hasError": false,
      "stepCount": 4,
      "truncated": false,
      "startedAt": "2026-10-30T06:35:10.010Z",
      "durationNs": "21000000"
    },
    {
      "id": "req_01JBSEED0000000000000001",
      "sessionId": "ses_01JBSEED0000000000000001",
      "method": "POST",
      "path": "/orders",
      "route": "/orders",
      "state": "completed",
      "httpStatus": 500,
      "hasError": true,
      "stepCount": 9,
      "truncated": false,
      "startedAt": "2026-10-30T06:35:05.120Z",
      "durationNs": "84000000"
    }
  ],
  "page": { "limit": 50, "nextCursor": null, "total": 2 }
}
```

**Errors:** `400 INVALID_PARAMS` (e.g. `limit=500`), `400 INVALID_CURSOR`, `401`, `403`, `429`.

### 6.2 `GET /api/v1/requests/:requestId`

One request with captured input and output, used by the map header.

| Param | Type | Notes |
| --- | --- | --- |
| `requestId` (path) | string `req_…` | |
| `includeDeleted` (query) | boolean, default `false` | `true` also returns a trashed request (trash preview) |

**200 OK:** `{ "data": RequestDetail }`

```json
{
  "data": {
    "id": "req_01JBSEED0000000000000001",
    "sessionId": "ses_01JBSEED0000000000000001",
    "method": "POST",
    "path": "/orders",
    "route": "/orders",
    "state": "completed",
    "httpStatus": 500,
    "hasError": true,
    "stepCount": 9,
    "truncated": false,
    "startedAt": "2026-10-30T06:35:05.120Z",
    "endedAt": "2026-10-30T06:35:05.204Z",
    "durationNs": "84000000",
    "request": {
      "params": null,
      "query": null,
      "body": { "type": "object", "preview": "{ userId: 7, items: [2] }", "objectId": "obj_1", "size": 2 },
      "headers": { "type": "object", "preview": "{ authorization: [REDACTED], content-type: application/json }" }
    },
    "response": {
      "headers": null,
      "body": { "type": "object", "preview": "{ statusCode: 500, message: \"Internal server error\" }" }
    },
    "errorStepId": "stp_01JBSEED0000000000000008",
    "errorPath": [
      "stp_01JBSEED0000000000000003",
      "stp_01JBSEED0000000000000004",
      "stp_01JBSEED0000000000000008"
    ],
    "deletedAt": null,
    "session": {
      "id": "ses_01JBSEED0000000000000001",
      "pid": 48213,
      "command": "npm run start:dev",
      "framework": "nestjs",
      "nodeVersion": "v24.10.0",
      "agentVersion": "0.1.0",
      "status": "connected",
      "disabledReason": null,
      "connectedAt": "2026-10-30T06:35:00.000Z",
      "disconnectedAt": null
    }
  }
}
```

**Errors:** `400 INVALID_ID`, `401`, `403`, `404 REQUEST_NOT_FOUND`, `404 REQUEST_IN_TRASH` (with `details.deletedAt`, so the UI can offer Restore), `429`.

### 6.3 `GET /api/v1/requests/:requestId/steps`

Steps of a request, in entry order (`seq`). Values are previews only; full values come from §6.4.

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `requestId` (path) | string | — | |
| `parentId` (query) | `stp_…` \| `root` | — (whole tree) | Only direct children of this step (lazy loading of big trees) |
| `kind` | comma list of `StepKind` | — | e.g. hide framework steps: `kind=method,function,boundary,handler` |
| `onErrorPath` | boolean | — | Only steps on the error path |
| `limit` | integer 1–2000 | `500` | |
| `cursor` | string | — | |
| `includeDeleted` | boolean | `false` | For trash preview |

**200 OK:** `Page<StepSummary>`

```json
{
  "data": [
    {
      "id": "stp_01JBSEED0000000000000005",
      "parentId": "stp_01JBSEED0000000000000004",
      "seq": 5,
      "depth": 2,
      "kind": "method",
      "layer": "service",
      "name": "UserService.findById",
      "file": "src/users/user.service.ts",
      "line": 14,
      "column": 3,
      "isAsync": true,
      "status": "returned",
      "errorHandling": null,
      "boundaryType": null,
      "onErrorPath": false,
      "collapsedCount": 1,
      "childCount": 1,
      "startOffsetNs": "3200000",
      "durationNs": "41000000",
      "returnPreview": "User { id: 7, name: \"Ravi\", tier: undefined }",
      "errorMessage": null,
      "hasSuspiciousValue": true
    },
    {
      "id": "stp_01JBSEED0000000000000008",
      "parentId": "stp_01JBSEED0000000000000004",
      "seq": 8,
      "depth": 2,
      "kind": "method",
      "layer": "service",
      "name": "PricingService.calculateDiscount",
      "file": "src/pricing/pricing.service.ts",
      "line": 22,
      "column": 3,
      "isAsync": false,
      "status": "threw",
      "errorHandling": "propagated",
      "boundaryType": null,
      "onErrorPath": true,
      "collapsedCount": 1,
      "childCount": 1,
      "startOffsetNs": "45200000",
      "durationNs": "300000",
      "returnPreview": null,
      "errorMessage": "TypeError: Cannot read properties of undefined (reading 'rate')",
      "hasSuspiciousValue": true
    }
  ],
  "page": { "limit": 500, "nextCursor": null, "total": 9 }
}
```

(Example shortened to two of nine steps.)

**Errors:** `400 INVALID_PARAMS`, `401`, `403`, `404 REQUEST_NOT_FOUND`, `404 REQUEST_IN_TRASH`, `404 STEP_NOT_FOUND` (unknown `parentId`), `429`.

### 6.4 `GET /api/v1/steps/:stepId`

One step with full captured values, for the inspector.

| Param | Type | Notes |
| --- | --- | --- |
| `stepId` (path) | string `stp_…` | |
| `includeDeleted` (query) | boolean, default `false` | |

**200 OK:** `{ "data": StepDetail }`

```json
{
  "data": {
    "id": "stp_01JBSEED0000000000000008",
    "requestId": "req_01JBSEED0000000000000001",
    "parentId": "stp_01JBSEED0000000000000004",
    "seq": 8,
    "depth": 2,
    "kind": "method",
    "layer": "service",
    "name": "PricingService.calculateDiscount",
    "className": "PricingService",
    "functionName": "calculateDiscount",
    "thisClass": "PricingService",
    "file": "src/pricing/pricing.service.ts",
    "line": 22,
    "column": 3,
    "isAsync": false,
    "status": "threw",
    "errorHandling": "propagated",
    "boundaryType": null,
    "onErrorPath": true,
    "collapsedCount": 1,
    "childCount": 1,
    "startOffsetNs": "45200000",
    "durationNs": "300000",
    "returnPreview": null,
    "errorMessage": "TypeError: Cannot read properties of undefined (reading 'rate')",
    "hasSuspiciousValue": true,
    "argNames": ["user", "total"],
    "args": [
      {
        "type": "object",
        "className": "User",
        "preview": "User { id: 7, name: \"Ravi\", tier: undefined }",
        "objectId": "obj_3",
        "size": 3,
        "children": {
          "id":   { "type": "number", "preview": "7" },
          "name": { "type": "string", "preview": "\"Ravi\"" },
          "tier": { "type": "undefined", "preview": "undefined", "suspicious": true }
        }
      },
      { "type": "number", "preview": "1200" }
    ],
    "returnValue": null,
    "error": {
      "type": "TypeError",
      "message": "Cannot read properties of undefined (reading 'rate')",
      "file": "src/pricing/pricing.service.ts",
      "line": 27,
      "stack": [
        { "fn": "PricingService.calculateDiscount", "file": "src/pricing/pricing.service.ts", "line": 27, "column": 31, "internal": false },
        { "fn": "OrdersService.create", "file": "src/orders/orders.service.ts", "line": 40, "column": 18, "internal": false },
        { "fn": "processTicksAndRejections", "file": "node:internal/process/task_queues", "line": 95, "column": 5, "internal": true }
      ]
    },
    "detail": null,
    "calledBy": { "id": "stp_01JBSEED0000000000000004", "name": "OrdersService.create" },
    "editorUrl": "vscode://file/home/dev/shop-api/src/pricing/pricing.service.ts:22:3"
  }
}
```

**Errors:** `400 INVALID_ID`, `401`, `403`, `404 STEP_NOT_FOUND`, `404 REQUEST_IN_TRASH`, `429`.

### 6.5 `GET /api/v1/requests/:requestId/curl`

The request as a cURL command. Redacted values are left as placeholders, never real secrets.

**200 OK** (`text/plain`)

```
curl -X POST 'http://localhost:3000/orders' \
  -H 'content-type: application/json' \
  -H 'authorization: <REDACTED>' \
  --data-raw '{"userId":7,"items":[{"sku":"A1","qty":2},{"sku":"B4","qty":1}]}'
```

If the body was truncated during capture, the response adds the header `X-Tracer-Truncated: true` and the UI warns that the command is incomplete.

**Errors:** `401`, `403`, `404 REQUEST_NOT_FOUND`, `404 REQUEST_IN_TRASH`, `409 REQUEST_IN_PROGRESS`, `429`.

### 6.6 `GET /api/v1/requests/:requestId/logs` (v1)

`console.log` / `console.error` output captured during the request.

| Query param | Type | Default |
| --- | --- | --- |
| `level` | comma list of `log`, `info`, `warn`, `error`, `debug` | all |
| `limit`, `cursor` | as §9 | `200` |

**200 OK:** `Page<{ stepId: string; seq: number; level: string; message: string; args: CapturedValue[]; offsetNs: string }>`

**Errors:** `400`, `401`, `403`, `404 REQUEST_NOT_FOUND`, `429`.

### 6.7 `GET /api/v1/search` (v1)

| Query param | Type | Default | Notes |
| --- | --- | --- | --- |
| `q` | string, 1–200 chars | — | Required. Plain text, never a regex or SQL |
| `in` | comma list of `name`, `file`, `value` | all | Where to look |
| `requestId` | string | — | Search inside one request |
| `limit`, `cursor` | as §9 | `50` | |

**200 OK:** `Page<{ step: StepSummary; request: RequestSummary; match: { field: 'name' | 'file' | 'value'; snippet: string } }>`

**Errors:** `400 INVALID_PARAMS` (empty or too long `q`), `401`, `403`, `429`.

### 6.8 `GET /api/v1/compare` (v1)

| Query param | Type | Notes |
| --- | --- | --- |
| `a`, `b` | `req_…` | Both required, both finished |

**200 OK**

```json
{
  "data": {
    "a": "req_01JBSEED0000000000000001",
    "b": "req_01JBSEED0000000000000004",
    "differences": [
      { "type": "value_changed", "aStepId": "stp_…05", "bStepId": "stp_…21", "path": "return.tier", "a": "undefined", "b": "\"gold\"" },
      { "type": "step_missing", "aStepId": null, "bStepId": "stp_…25", "name": "OrdersRepository.save" },
      { "type": "status_changed", "aStepId": "stp_…08", "bStepId": "stp_…24", "a": "threw", "b": "returned" }
    ]
  }
}
```

**Errors:** `400 INVALID_PARAMS`, `401`, `403`, `404 REQUEST_NOT_FOUND`, `409 REQUEST_IN_PROGRESS`, `429`.

### 6.9 `GET /api/v1/requests/:requestId/objects/:objectId` (v2)

Data journey: every step where the object appeared, in order.

**200 OK:** `{ "data": { "objectId": "obj_3", "typeName": "User", "appearances": [{ "stepId": "stp_…05", "name": "UserService.findById", "role": "return", "path": "return", "value": CapturedValue }, { "stepId": "stp_…08", "name": "PricingService.calculateDiscount", "role": "arg", "path": "args[0]", "value": CapturedValue }] } }`

**Errors:** `401`, `403`, `404 REQUEST_NOT_FOUND`, `404 OBJECT_NOT_FOUND`, `429`.

### 6.10 `GET /api/v1/sample`

A built-in, read-only example (the failing `POST /orders` from the seed data) for the onboarding screen. Nothing is written to the database.

**200 OK:** `{ "data": { "request": RequestDetail, "steps": StepSummary[], "stepDetails": Record<string, StepDetail> } }` with `"sample": true` on the request.

**Errors:** `401`, `403`, `429`.

---

## 7. REST endpoints: delete, trash, restore, client logs

Soft-delete rules are defined in `tracer-data-model.md` §7. Every change is also pushed to `/live` (`live.request.deleted`, `live.request.restored`, `live.request.purged`).

### 7.1 `DELETE /api/v1/requests/:requestId`

Move one **finished** request to the trash.

**Body:** none.

**200 OK**

```json
{ "data": { "id": "req_01JBSEED0000000000000001", "deletedAt": "2026-10-30T06:40:00.000Z", "purgeAt": "2026-11-02T06:40:00.000Z" } }
```

Deleting an already-trashed request returns the same `200` (idempotent).

**Errors:** `401`, `403`, `404 REQUEST_NOT_FOUND`, `409 REQUEST_IN_PROGRESS`, `429`.

### 7.2 `DELETE /api/v1/requests/:requestId?permanent=true`

Delete one request (active or trashed) and its steps permanently.

**204 No Content**

**Errors:** `401`, `403`, `404 REQUEST_NOT_FOUND`, `409 REQUEST_IN_PROGRESS`, `429`.

### 7.3 `DELETE /api/v1/requests`

"Clear all": move every finished active request to the trash. In-progress requests are skipped.

| Query param | Type | Notes |
| --- | --- | --- |
| `sessionId` | string, optional | Only this app process |

**200 OK**

```json
{ "data": { "moved": 37, "skippedInProgress": 1, "purgeAt": "2026-11-02T06:40:00.000Z" } }
```

**Errors:** `401`, `403`, `429`.

### 7.4 `POST /api/v1/requests/:requestId/restore`

Restore a trashed request. If this pushes active requests over the retention limit, the oldest active request is moved to the trash (and reported).

**Body:** none.

**200 OK**

```json
{ "data": { "request": { "id": "req_01JBSEED0000000000000003", "method": "GET", "path": "/health", "state": "completed", "httpStatus": 200, "hasError": false, "stepCount": 1, "truncated": false, "startedAt": "2026-10-30T06:35:01.000Z", "durationNs": "2000000", "sessionId": "ses_01JBSEED0000000000000001", "route": "/health" }, "movedToTrash": [] } }
```

**Errors:** `401`, `403`, `404 REQUEST_NOT_FOUND` (already purged), `409 REQUEST_NOT_IN_TRASH`, `429`.

### 7.5 `GET /api/v1/trash`

| Query param | Type | Default | Notes |
| --- | --- | --- | --- |
| `limit` | integer 1–200 | `50` | |
| `cursor` | string | — | |
| `sort` | `-deletedAt` \| `deletedAt` | `-deletedAt` | |

**200 OK:** `Page<RequestSummary & { deletedAt: string; purgeAt: string }>`

```json
{
  "data": [
    {
      "id": "req_01JBSEED0000000000000003",
      "sessionId": "ses_01JBSEED0000000000000001",
      "method": "GET",
      "path": "/health",
      "route": "/health",
      "state": "completed",
      "httpStatus": 200,
      "hasError": false,
      "stepCount": 1,
      "truncated": false,
      "startedAt": "2026-10-30T06:35:01.000Z",
      "durationNs": "2000000",
      "deletedAt": "2026-10-30T06:35:20.000Z",
      "purgeAt": "2026-11-02T06:35:20.000Z"
    }
  ],
  "page": { "limit": 50, "nextCursor": null, "total": 1 }
}
```

**Errors:** `400 INVALID_PARAMS`, `401`, `403`, `429`.

### 7.6 `DELETE /api/v1/trash`

Empty the trash: permanently delete every trashed request.

**200 OK:** `{ "data": { "deleted": 3 } }`

**Errors:** `401`, `403`, `429`.

### 7.7 `POST /api/v1/client-logs` (v1)

The UI reports its own errors (e.g. a crashed panel) into the collector log file.

**Body**

```ts
{ level: 'warn' | 'error'; message: string /* max 2,000 chars */; context?: Record<string, string> /* max 20 keys */ }
```

**202 Accepted:** `{ "data": { "accepted": true } }`

Captured values must never be sent here; the collector also redacts known secret keys.

**Errors:** `400 INVALID_BODY`, `401`, `403`, `413 PAYLOAD_TOO_LARGE`, `429`.

---

## 8. Errors and status codes

Every non-2xx REST response uses the envelope:

```json
{ "error": { "code": "REQUEST_IN_PROGRESS", "message": "Wait until the request finishes before deleting it.", "details": { "requestId": "req_01J…" } } }
```

| HTTP | Code | When |
| --- | --- | --- |
| `400` | `INVALID_PARAMS` | Query or path params fail validation (unknown sort, `limit` out of range, bad filter) |
| `400` | `INVALID_ID` | ID has the wrong prefix or format |
| `400` | `INVALID_CURSOR` | Cursor is malformed or from another sort order |
| `400` | `INVALID_BODY` | JSON body fails validation |
| `401` | `MISSING_TOKEN` | No `Authorization` header / subprotocol |
| `401` | `INVALID_TOKEN` | Token doesn't match this collector run (e.g. collector restarted) |
| `403` | `ORIGIN_NOT_ALLOWED` | Request from another website or origin |
| `403` | `HOST_NOT_ALLOWED` | Unexpected `Host` header (DNS rebinding protection) |
| `404` | `ROUTE_NOT_FOUND` | Unknown endpoint |
| `404` | `REQUEST_NOT_FOUND` | No such request, or it was purged |
| `404` | `REQUEST_IN_TRASH` | Request exists but is in the trash; `details.deletedAt` included |
| `404` | `STEP_NOT_FOUND` | No such step |
| `404` | `OBJECT_NOT_FOUND` | No such object in that request (v2) |
| `405` | `METHOD_NOT_ALLOWED` | Wrong HTTP method for the path |
| `409` | `REQUEST_IN_PROGRESS` | Delete, cURL or compare on a request that hasn't finished |
| `409` | `REQUEST_NOT_IN_TRASH` | Restore on an active request |
| `413` | `PAYLOAD_TOO_LARGE` | Body over the limit (§10) |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | Body not JSON |
| `429` | `RATE_LIMITED` | Too many requests; `Retry-After` header set (§10) |
| `500` | `INTERNAL_ERROR` | Unexpected collector error (logged with a correlation ID in `details.logId`) |
| `503` | `STORE_UNAVAILABLE` | Database locked or unreadable; retry shortly |

WebSocket close codes:

| Close code | Meaning |
| --- | --- |
| `1000` | Normal close |
| `1001` | Collector shutting down |
| `4001` | Missing or invalid token |
| `4003` | Origin or host not allowed |
| `4009` | Protocol version mismatch (`details` sent first in an `error` message) |
| `4013` | Message too large |
| `4029` | Too many connections |

---

## 9. Pagination, filtering and sorting

### Pagination

| Rule | Detail |
| --- | --- |
| Style | **Cursor-based** (`cursor` + `limit`), so new requests arriving live never shift pages |
| Cursor | Opaque base64url string encoding the sort key and the last ID; valid only with the same `sort` and filters |
| End of list | `page.nextCursor` is `null` |
| Total | `page.total` = number of items matching the filters (cheap, because retention keeps the store small) |
| Limits | Requests and trash: default 50, max 200. Steps: default 500, max 2,000. Logs: default 200, max 1,000. Search: default 50, max 200 |
| Not paginated | `health`, `config`, `sessions`, a single request or step |

### Filtering

| Rule | Detail |
| --- | --- |
| Combining | Different filters combine with **AND**; comma lists within one filter combine with **OR** (`method=GET,POST`) |
| Text filters | `path`, `q`: case-insensitive substring, max 200 characters, treated as plain text |
| Status classes | `2xx`, `3xx`, `4xx`, `5xx` accepted alongside exact codes |
| Booleans | `true` / `false` only |
| Unknown params | Rejected with `400 INVALID_PARAMS` (catches typos instead of silently ignoring them) |

### Sorting

| Endpoint | Allowed `sort` | Default | Tie-breaker |
| --- | --- | --- | --- |
| `GET /requests` | `startedAt`, `-startedAt`, `durationNs`, `-durationNs` | `-startedAt` (newest first) | `id` |
| `GET /trash` | `deletedAt`, `-deletedAt` | `-deletedAt` | `id` |
| `GET /requests/:id/steps` | fixed: `seq` ascending | — | — |
| `GET /requests/:id/logs` | fixed: `seq` ascending | — | — |
| `GET /search` | fixed: relevance, then newest request | — | `id` |

`-` prefix means descending.

---

## 10. Rate limits and size limits

Tracer is local, so limits exist to protect the collector from runaway scripts or loops, not to meter usage.

| Scope | Limit | Behaviour when exceeded |
| --- | --- | --- |
| REST `GET` endpoints | 100 requests/second, burst 200 (per token) | `429 RATE_LIMITED` with `Retry-After` (seconds) and `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` headers |
| REST `DELETE` / `POST` endpoints | 10 requests/second (per token) | Same |
| REST request body | 64 KB | `413 PAYLOAD_TOO_LARGE` |
| `/live` connections | 10 open at once | Close `4029` |
| `/agent` connections | 32 open at once (one per app process) | Close `4029` |
| `/agent` message (one batch) | 1 MB and 2,000 events | Close `4013`; agent splits batches below this |
| `/agent` throughput | No hard limit; **backpressure** instead | When ingest falls behind, collector sends `slow_down`; agent collapses repeated calls and drops low-priority events until `resume` |
| Steps per request | `TRACER_MAX_STEPS` (default 5,000) | Recording stops; request marked `truncated` |

Implementation: `@fastify/rate-limit` for REST; manual counters for WebSocket connections.

---

## 11. WebSocket protocol

All messages are JSON objects with `type` and `v`. Messages are validated with Zod; an invalid message gets an `error` reply (and repeated invalid messages close the socket with `4003`).

### 11.1 `WS /agent` (agent → collector)

Connect with subprotocols `["tracer.v1", "bearer.<token>"]`.

**Agent → collector**

```json
{ "type": "hello", "v": 1, "pid": 48213, "nodeVersion": "v24.10.0", "agentVersion": "0.1.0",
  "framework": "nestjs", "command": "npm run start:dev", "cwd": "/home/dev/shop-api" }
```

```json
{ "type": "batch", "v": 1, "pid": 48213, "seq": 42, "events": [
  { "e": "request.start", "traceId": "req_01J…", "ts": "1761805505120000000",
    "method": "POST", "path": "/orders", "route": "/orders", "params": null, "query": null,
    "body": { "type": "object", "preview": "{ userId: 7, items: [2] }", "objectId": "obj_1" },
    "headers": { "type": "object", "preview": "{ authorization: [REDACTED] }" } },
  { "e": "step.enter", "traceId": "req_01J…", "ts": "…", "stepId": "stp_01J…", "parentStepId": null,
    "kind": "guard", "name": "JwtAuthGuard.canActivate", "file": "src/auth/jwt-auth.guard.ts", "line": 12, "column": 3,
    "args": [], "thisClass": "JwtAuthGuard", "isAsync": true },
  { "e": "step.exit", "traceId": "req_01J…", "ts": "…", "stepId": "stp_01J…",
    "returnValue": { "type": "boolean", "preview": "true" }, "durationNs": "1100000" }
] }
```

Event types inside a batch: `request.start`, `step.enter`, `step.exit`, `step.throw`, `boundary`, `decision` (v1), `loop` (v1), `log` (v1), `request.end`, `agent.disabled`. Field lists are in `tracer-architecture.md` §3d.

**Collector → agent**

| Message | Meaning |
| --- | --- |
| `{ "type": "welcome", "v": 1, "sessionId": "ses_…", "limits": { "maxBatchBytes": 1048576, "maxBatchEvents": 2000 } }` | Handshake accepted |
| `{ "type": "ack", "v": 1, "seq": 42 }` | Batch stored; the agent can free it |
| `{ "type": "slow_down", "v": 1, "reason": "ingest_backlog" }` | Apply backpressure |
| `{ "type": "resume", "v": 1 }` | Back to normal |
| `{ "type": "error", "v": 1, "code": "INVALID_EVENT", "message": "…", "seq": 42 }` | Batch rejected (bad events dropped, the rest kept) |

### 11.2 `WS /live` (collector → UI)

Connect with subprotocols `["tracer.v1", "bearer.<token>"]`.

**UI → collector**

| Message | Meaning |
| --- | --- |
| `{ "type": "subscribe", "v": 1, "topics": ["requests"] }` | New requests, completions, deletes, agent status (always needed for the list) |
| `{ "type": "subscribe", "v": 1, "topics": ["request:req_01J…"] }` | Streamed steps for one request (the one open in the map) |
| `{ "type": "unsubscribe", "v": 1, "topics": ["request:req_01J…"] }` | Stop streaming steps |
| `{ "type": "ping", "v": 1 }` | Keep-alive (every 25 s) |

**Collector → UI**

| Message | Payload |
| --- | --- |
| `live.request.started` | `{ request: RequestSummary }` |
| `live.steps.appended` | `{ requestId, steps: StepSummary[] }` (batched; only for subscribed requests) |
| `live.steps.updated` | `{ requestId, steps: Partial<StepSummary>[] }` (exit/throw fills duration and status) |
| `live.request.completed` | `{ request: RequestSummary, errorPath: string[] }` |
| `live.request.deleted` | `{ requestId, deletedAt, purgeAt }` |
| `live.request.restored` | `{ request: RequestSummary }` |
| `live.request.purged` | `{ requestIds: string[] }` |
| `live.agent.connected` | `{ session: Session }` |
| `live.agent.disconnected` | `{ sessionId, reason: 'exit' \| 'restart' \| 'crash', exitCode: number \| null }` |
| `live.agent.disabled` | `{ sessionId, reason }` |
| `pong` | Keep-alive reply |
| `error` | `{ code, message }` |

Example:

```json
{ "type": "live.steps.appended", "v": 1, "requestId": "req_01J…",
  "steps": [ { "id": "stp_01J…", "parentId": "stp_01J…", "seq": 5, "depth": 2, "kind": "method", "layer": "service",
               "name": "UserService.findById", "status": "running", "startOffsetNs": "3200000", "durationNs": null,
               "file": "src/users/user.service.ts", "line": 14, "column": 3, "isAsync": true, "errorHandling": null,
               "boundaryType": null, "onErrorPath": false, "collapsedCount": 1, "childCount": 0,
               "returnPreview": null, "errorMessage": null, "hasSuspiciousValue": false } ] }
```

**Reconnect rule:** after reconnecting, the UI re-subscribes, then refetches `GET /api/v1/requests` and any open in-progress request over REST. Steps are de-duplicated by `id` (and `seq`).
