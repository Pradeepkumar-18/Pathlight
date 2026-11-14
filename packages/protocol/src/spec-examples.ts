// Examples copied from `api-spec.md` (seed IDs and times), shared by the protocol tests.
// Placeholders such as "req_01J…" in the spec are filled in with the seed's real IDs.

export const SESSION_ID = 'ses_01JBSEED000000000000000001';
export const REQUEST_ID = 'req_01JBSEED000000000000000001';
export const STEP = (n: number): string =>
  `stp_01JBSEED0000000000000000${String(n).padStart(2, '0')}`;

export const session = {
  id: SESSION_ID,
  pid: 48213,
  command: 'npm run start:dev',
  framework: 'nestjs',
  nodeVersion: 'v24.10.0',
  agentVersion: '0.1.0',
  status: 'connected',
  disabledReason: null,
  connectedAt: '2026-10-30T06:35:00.000Z',
  disconnectedAt: null,
};

/** §6.1 */
export const requestSummary = {
  id: REQUEST_ID,
  sessionId: SESSION_ID,
  method: 'POST',
  path: '/orders',
  route: '/orders',
  state: 'completed',
  httpStatus: 500,
  hasError: true,
  stepCount: 9,
  truncated: false,
  startedAt: '2026-10-30T06:35:05.120Z',
  durationNs: '84000000',
};

/** §6.2 */
export const requestDetail = {
  ...requestSummary,
  endedAt: '2026-10-30T06:35:05.204Z',
  request: {
    params: null,
    query: null,
    body: { type: 'object', preview: '{ userId: 7, items: [2] }', objectId: 'obj_1', size: 2 },
    headers: {
      type: 'object',
      preview: '{ authorization: [REDACTED], content-type: application/json }',
    },
  },
  response: {
    headers: null,
    body: { type: 'object', preview: '{ statusCode: 500, message: "Internal server error" }' },
  },
  errorStepId: STEP(8),
  errorPath: [STEP(3), STEP(4), STEP(8)],
  deletedAt: null,
  session,
};

/** §6.3 */
export const stepSummary = {
  id: STEP(5),
  parentId: STEP(4),
  seq: 5,
  depth: 2,
  kind: 'method',
  layer: 'service',
  name: 'UserService.findById',
  file: 'src/users/user.service.ts',
  line: 14,
  column: 3,
  isAsync: true,
  status: 'returned',
  errorHandling: null,
  boundaryType: null,
  onErrorPath: false,
  collapsedCount: 1,
  childCount: 1,
  startOffsetNs: '3200000',
  durationNs: '41000000',
  returnPreview: 'User { id: 7, name: "Ravi", tier: undefined }',
  errorMessage: null,
  hasSuspiciousValue: true,
};

/** §6.4 */
export const stepDetail = {
  ...stepSummary,
  id: STEP(8),
  seq: 8,
  name: 'PricingService.calculateDiscount',
  file: 'src/pricing/pricing.service.ts',
  line: 22,
  status: 'threw',
  errorHandling: 'propagated',
  onErrorPath: true,
  startOffsetNs: '45200000',
  durationNs: '300000',
  returnPreview: null,
  errorMessage: "TypeError: Cannot read properties of undefined (reading 'rate')",
  requestId: REQUEST_ID,
  className: 'PricingService',
  functionName: 'calculateDiscount',
  thisClass: 'PricingService',
  argNames: ['user', 'total'],
  args: [
    {
      type: 'object',
      className: 'User',
      preview: 'User { id: 7, name: "Ravi", tier: undefined }',
      objectId: 'obj_3',
      size: 3,
      children: {
        id: { type: 'number', preview: '7' },
        name: { type: 'string', preview: '"Ravi"' },
        tier: { type: 'undefined', preview: 'undefined', suspicious: true },
      },
    },
    { type: 'number', preview: '1200' },
  ],
  returnValue: null,
  error: {
    type: 'TypeError',
    message: "Cannot read properties of undefined (reading 'rate')",
    file: 'src/pricing/pricing.service.ts',
    line: 27,
    column: 31,
    stack: [
      {
        fn: 'PricingService.calculateDiscount',
        file: 'src/pricing/pricing.service.ts',
        line: 27,
        column: 31,
        internal: false,
      },
      {
        fn: 'OrdersService.create',
        file: 'src/orders/orders.service.ts',
        line: 40,
        column: 18,
        internal: false,
      },
      {
        fn: 'processTicksAndRejections',
        file: 'node:internal/process/task_queues',
        line: 95,
        column: 5,
        internal: true,
      },
    ],
  },
  detail: null,
  calledBy: { id: STEP(4), name: 'OrdersService.create' },
  absolutePath: '/home/dev/shop-api/src/pricing/pricing.service.ts',
  fileChangedSince: false,
};

/** §11.1 */
export const hello = {
  type: 'hello',
  v: 1,
  pid: 48213,
  nodeVersion: 'v24.10.0',
  agentVersion: '0.1.0',
  framework: 'nestjs',
  command: 'npm run start:dev',
  cwd: '/home/dev/shop-api',
};

export const requestStart = {
  e: 'request.start',
  traceId: REQUEST_ID,
  ts: '1793342105120000000',
  framework: 'nestjs',
  method: 'POST',
  path: '/orders',
  route: '/orders',
  params: null,
  query: null,
  body: { type: 'object', preview: '{ userId: 7, items: [2] }', objectId: 'obj_1' },
  headers: { type: 'object', preview: '{ authorization: [REDACTED] }' },
};

export const stepEnter = {
  e: 'step.enter',
  traceId: REQUEST_ID,
  ts: '1793342105120400000',
  stepId: STEP(1),
  parentStepId: null,
  kind: 'guard',
  name: 'JwtAuthGuard.canActivate',
  file: 'src/auth/jwt-auth.guard.ts',
  line: 12,
  column: 3,
  args: [],
  thisClass: 'JwtAuthGuard',
  isAsync: true,
};

export const stepExit = {
  e: 'step.exit',
  traceId: REQUEST_ID,
  ts: '1793342105121500000',
  stepId: STEP(1),
  returnValue: { type: 'boolean', preview: 'true' },
  durationNs: '1100000',
};

export const batch = {
  type: 'batch',
  v: 1,
  pid: 48213,
  seq: 42,
  events: [requestStart, stepEnter, stepExit],
};

/** §11.2 */
export const stepsAppended = {
  type: 'live.steps.appended',
  v: 1,
  requestId: REQUEST_ID,
  steps: [
    {
      ...stepSummary,
      status: 'running',
      durationNs: null,
      childCount: 0,
      returnPreview: null,
      hasSuspiciousValue: false,
    },
  ],
};
