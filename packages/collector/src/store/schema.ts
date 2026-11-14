// Drizzle schema: mirrors `docs/data-model.md` §9 exactly (MVP tables; `logs` arrives in v1).
// Schema changes need approval first (CLAUDE.md "Ask before changing").
import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    pid: integer('pid').notNull(),
    command: text('command'),
    cwd: text('cwd').notNull(),
    nodeVersion: text('node_version').notNull(),
    agentVersion: text('agent_version').notNull(),
    protocolVersion: integer('protocol_version').notNull(),
    framework: text('framework', { enum: ['nestjs', 'express', 'unknown'] })
      .notNull()
      .default('unknown'),
    status: text('status', { enum: ['connected', 'disconnected', 'disabled'] })
      .notNull()
      .default('connected'),
    disabledReason: text('disabled_reason'),
    connectedAt: integer('connected_at').notNull(),
    disconnectedAt: integer('disconnected_at'),
    exitCode: integer('exit_code'),
    warningsJson: text('warnings_json'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    check('sessions_framework', sql`${table.framework} IN ('nestjs','express','unknown')`),
    check('sessions_status', sql`${table.status} IN ('connected','disconnected','disabled')`),
    index('idx_sessions_status').on(table.status),
  ],
);

export const requests = sqliteTable(
  'requests',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    entryType: text('entry_type', { enum: ['http', 'test', 'queue', 'cron'] })
      .notNull()
      .default('http'),
    method: text('method', { enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] }),
    path: text('path'),
    route: text('route'),
    state: text('state', { enum: ['in_progress', 'completed', 'incomplete'] })
      .notNull()
      .default('in_progress'),
    httpStatus: integer('http_status'),
    hasError: integer('has_error').notNull().default(0),
    errorStepId: text('error_step_id'),
    stepCount: integer('step_count').notNull().default(0),
    truncated: integer('truncated').notNull().default(0),
    requestJson: text('request_json').notNull(),
    responseJson: text('response_json'),
    unhandledErrorJson: text('unhandled_error_json'),
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at'),
    durationNs: integer('duration_ns'),
    deletedAt: integer('deleted_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    check('requests_entry_type', sql`${table.entryType} IN ('http','test','queue','cron')`),
    check(
      'requests_method',
      sql`${table.method} IN ('GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS')`,
    ),
    check('requests_state', sql`${table.state} IN ('in_progress','completed','incomplete')`),
    check('requests_has_error', sql`${table.hasError} IN (0,1)`),
    check('requests_truncated', sql`${table.truncated} IN (0,1)`),
    check(
      'requests_soft_delete_finished',
      sql`${table.deletedAt} IS NULL OR ${table.state} <> 'in_progress'`,
    ),
    check(
      'requests_http_has_method_path',
      sql`${table.entryType} <> 'http' OR (${table.method} IS NOT NULL AND ${table.path} IS NOT NULL)`,
    ),
    index('idx_requests_started_at').on(sql`${table.startedAt} DESC`),
    index('idx_requests_session').on(table.sessionId),
    index('idx_requests_error').on(table.hasError, sql`${table.startedAt} DESC`),
    index('idx_requests_route').on(table.method, table.route),
    index('idx_requests_active')
      .on(sql`${table.startedAt} DESC`)
      .where(sql`${table.deletedAt} IS NULL`),
    index('idx_requests_trash')
      .on(table.deletedAt)
      .where(sql`${table.deletedAt} IS NOT NULL`),
  ],
);

const STEP_KINDS = [
  'function',
  'method',
  'middleware',
  'guard',
  'interceptor',
  'pipe',
  'handler',
  'filter',
  'boundary',
  'constructor',
  'callback',
  'decision',
  'loop',
] as const;

export const steps = sqliteTable(
  'steps',
  {
    id: text('id').primaryKey(),
    requestId: text('request_id')
      .notNull()
      .references(() => requests.id, { onDelete: 'cascade' }),
    // Self-reference: the parent step.
    parentId: text('parent_id').references((): ReturnType<typeof text> => steps.id, {
      onDelete: 'cascade',
    }),
    seq: integer('seq').notNull(),
    depth: integer('depth').notNull().default(0),
    kind: text('kind', { enum: STEP_KINDS }).notNull(),
    name: text('name').notNull(),
    className: text('class_name'),
    functionName: text('function_name'),
    file: text('file'),
    line: integer('line'),
    column: integer('column'),
    isAsync: integer('is_async').notNull().default(0),
    status: text('status', { enum: ['running', 'returned', 'threw'] })
      .notNull()
      .default('running'),
    argsJson: text('args_json'),
    argNamesJson: text('arg_names_json'),
    returnJson: text('return_json'),
    thisClass: text('this_class'),
    errorJson: text('error_json'),
    errorHandling: text('error_handling', {
      enum: ['propagated', 'swallowed', 'converted', 'unhandled'],
    }),
    boundaryType: text('boundary_type', { enum: ['db', 'http', 'redis', 'queue', 'fs'] }),
    detailJson: text('detail_json'),
    onErrorPath: integer('on_error_path').notNull().default(0),
    collapsedCount: integer('collapsed_count').notNull().default(1),
    startOffsetNs: integer('start_offset_ns').notNull(),
    durationNs: integer('duration_ns'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    check('steps_seq', sql`${table.seq} >= 1`),
    check('steps_depth', sql`${table.depth} >= 0`),
    check(
      'steps_kind',
      sql`${table.kind} IN (${sql.raw(STEP_KINDS.map((kind) => `'${kind}'`).join(','))})`,
    ),
    check('steps_is_async', sql`${table.isAsync} IN (0,1)`),
    check('steps_status', sql`${table.status} IN ('running','returned','threw')`),
    check(
      'steps_error_handling',
      sql`${table.errorHandling} IN ('propagated','swallowed','converted','unhandled')`,
    ),
    check('steps_boundary_type', sql`${table.boundaryType} IN ('db','http','redis','queue','fs')`),
    check('steps_on_error_path', sql`${table.onErrorPath} IN (0,1)`),
    check('steps_collapsed_count', sql`${table.collapsedCount} >= 1`),
    check(
      'steps_boundary_iff_kind',
      sql`(${table.kind} = 'boundary') = (${table.boundaryType} IS NOT NULL)`,
    ),
    check(
      'steps_error_handling_threw',
      sql`${table.errorHandling} IS NULL OR ${table.status} = 'threw'`,
    ),
    unique('uq_steps_request_seq').on(table.requestId, table.seq),
    index('idx_steps_parent').on(table.requestId, table.parentId),
    index('idx_steps_error_path').on(table.requestId, table.onErrorPath),
    index('idx_steps_name').on(table.name),
  ],
);

export const objectRefs = sqliteTable(
  'object_refs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    requestId: text('request_id')
      .notNull()
      .references(() => requests.id, { onDelete: 'cascade' }),
    // NULL for request-level objects (role `request`).
    stepId: text('step_id').references(() => steps.id, { onDelete: 'cascade' }),
    objectId: text('object_id').notNull(),
    role: text('role', { enum: ['arg', 'return', 'this', 'thrown', 'request'] }).notNull(),
    path: text('path').notNull().default(''),
    typeName: text('type_name'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    check('object_refs_role', sql`${table.role} IN ('arg','return','this','thrown','request')`),
    check('object_refs_request_role', sql`(${table.role} = 'request') = (${table.stepId} IS NULL)`),
    unique('uq_object_refs').on(
      table.requestId,
      table.stepId,
      table.objectId,
      table.role,
      table.path,
    ),
    index('idx_object_refs_object').on(table.requestId, table.objectId),
  ],
);

export const meta = sqliteTable('meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
