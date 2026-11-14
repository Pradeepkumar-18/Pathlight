-- Seed data: the failing POST /orders example from the PRD.
-- Copied from docs/data-model.md §10; a test fails if the two drift apart.
-- Load it with `pnpm seed`.
-- OR REPLACE: the collector writes these keys when it creates the store
INSERT OR REPLACE INTO meta (key, value, updated_at) VALUES
  ('schema_version',     '1',     1793342100000),
  ('created_by_version', '0.1.0', 1793342100000);


INSERT INTO sessions (id, pid, command, cwd, node_version, agent_version, protocol_version,
                      framework, status, connected_at, created_at, updated_at) VALUES
  ('ses_01JBSEED000000000000000001', 48213, 'npm run start:dev', '/home/dev/shop-api',
   'v24.10.0', '0.1.0', 1, 'nestjs', 'connected', 1793342100000, 1793342100000, 1793342100000);

INSERT INTO requests (id, session_id, method, path, route, state, http_status, has_error,
                      error_step_id, step_count, request_json, response_json,
                      started_at, ended_at, duration_ns, created_at, updated_at) VALUES
  ('req_01JBSEED000000000000000001', 'ses_01JBSEED000000000000000001', 'POST', '/orders', '/orders',
   'completed', 500, 1, 'stp_01JBSEED000000000000000008', 9,
   '{"params":null,"query":null,"body":{"type":"object","preview":"{ userId: 7, items: [2] }","objectId":"obj_1","size":2},"headers":{"type":"object","preview":"{ authorization: [REDACTED], content-type: application/json }"}}',
   '{"headers":{},"body":{"type":"object","preview":"{ statusCode: 500, message: Internal server error }"}}',
   1793342105120, 1793342105204, 84000000, 1793342105120, 1793342105204),
  ('req_01JBSEED000000000000000002', 'ses_01JBSEED000000000000000001', 'GET', '/orders/42', '/orders/:id',
   'completed', 200, 0, NULL, 4,
   '{"params":{"type":"object","preview":"{ id: \"42\" }"},"query":null,"body":{"type":"undefined","preview":"undefined"},"headers":{"type":"object","preview":"{ authorization: [REDACTED] }"}}',
   '{"headers":{},"body":{"type":"object","preview":"{ id: 42, total: 1200, status: \"paid\" }"}}',
   1793342110010, 1793342110031, 21000000, 1793342110010, 1793342110031);

-- A request the developer moved to the trash (soft-deleted, restorable for 72 hours)
INSERT INTO requests (id, session_id, method, path, route, state, http_status, has_error,
                      step_count, request_json, response_json,
                      started_at, ended_at, duration_ns, deleted_at, created_at, updated_at) VALUES
  ('req_01JBSEED000000000000000003', 'ses_01JBSEED000000000000000001', 'GET', '/health', '/health',
   'completed', 200, 0, 1,
   '{"params":null,"query":null,"body":{"type":"undefined","preview":"undefined"},"headers":{}}',
   '{"headers":{},"body":{"type":"object","preview":"{ status: \"ok\" }"}}',
   1793342101000, 1793342101002, 2000000, 1793342120000, 1793342101000, 1793342120000);

-- Steps for the failing POST /orders (seq order = order of entry)
INSERT INTO steps (id, request_id, parent_id, seq, depth, kind, name, class_name, function_name,
                   file, line, "column", is_async, status, args_json, return_json, this_class,
                   error_json, error_handling, boundary_type, detail_json, on_error_path,
                   start_offset_ns, duration_ns, created_at, updated_at) VALUES
  ('stp_01JBSEED000000000000000001', 'req_01JBSEED000000000000000001', NULL, 1, 0, 'guard',
   'JwtAuthGuard.canActivate', 'JwtAuthGuard', 'canActivate', 'src/auth/jwt-auth.guard.ts', 12, 3,
   1, 'returned', NULL, '{"type":"boolean","preview":"true"}', 'JwtAuthGuard', NULL, NULL, NULL,
   '{"allowed":true}', 0, 400000, 1100000, 1793342105120, 1793342105121),

  ('stp_01JBSEED000000000000000002', 'req_01JBSEED000000000000000001', NULL, 2, 0, 'pipe',
   'ValidationPipe.transform', 'ValidationPipe', 'transform', NULL, NULL, NULL,
   1, 'returned', NULL, '{"type":"object","className":"CreateOrderDto","preview":"CreateOrderDto { userId: 7, items: [2] }","objectId":"obj_2"}',
   'ValidationPipe', NULL, NULL, NULL,
   '{"input":{"type":"object","preview":"{ userId: 7, items: [2] }","objectId":"obj_1"},"output":{"type":"object","className":"CreateOrderDto","preview":"CreateOrderDto { userId: 7, items: [2] }","objectId":"obj_2"}}',
   0, 1600000, 900000, 1793342105122, 1793342105123),

  ('stp_01JBSEED000000000000000003', 'req_01JBSEED000000000000000001', NULL, 3, 0, 'handler',
   'OrdersController.create', 'OrdersController', 'create', 'src/orders/orders.controller.ts', 18, 3,
   1, 'threw', '[{"type":"object","className":"CreateOrderDto","preview":"CreateOrderDto { userId: 7, items: [2] }","objectId":"obj_2"}]',
   NULL, 'OrdersController',
   '{"type":"TypeError","message":"Cannot read properties of undefined (reading ''rate'')","file":"src/pricing/pricing.service.ts","line":27}',
   'converted', NULL, NULL, 1, 2600000, 81000000, 1793342105123, 1793342105204),

  ('stp_01JBSEED000000000000000004', 'req_01JBSEED000000000000000001', 'stp_01JBSEED000000000000000003', 4, 1, 'method',
   'OrdersService.create', 'OrdersService', 'create', 'src/orders/orders.service.ts', 31, 3,
   1, 'threw', '[{"type":"object","className":"CreateOrderDto","preview":"CreateOrderDto { userId: 7, items: [2] }","objectId":"obj_2"}]',
   NULL, 'OrdersService',
   '{"type":"TypeError","message":"Cannot read properties of undefined (reading ''rate'')","file":"src/pricing/pricing.service.ts","line":27}',
   'propagated', NULL, NULL, 1, 2900000, 80500000, 1793342105123, 1793342105204),

  ('stp_01JBSEED000000000000000005', 'req_01JBSEED000000000000000001', 'stp_01JBSEED000000000000000004', 5, 2, 'method',
   'UserService.findById', 'UserService', 'findById', 'src/users/user.service.ts', 14, 3,
   1, 'returned', '[{"type":"number","preview":"7"}]',
   '{"type":"object","className":"User","preview":"User { id: 7, name: \"Ravi\", tier: undefined }","objectId":"obj_3"}',
   'UserService', NULL, NULL, NULL, NULL, 0, 3200000, 41000000, 1793342105124, 1793342105165),

  ('stp_01JBSEED000000000000000006', 'req_01JBSEED000000000000000001', 'stp_01JBSEED000000000000000005', 6, 3, 'boundary',
   'users.findOne', NULL, NULL, 'src/users/user.service.ts', 15, 5,
   1, 'returned', NULL, '{"type":"object","preview":"{ id: 7, name: \"Ravi\" }"}', NULL, NULL, NULL, 'db',
   '{"driver":"mongoose","operation":"findOne","collectionOrTable":"users","query":"{ id: 7 }","resultSummary":"1 document"}',
   0, 3500000, 39000000, 1793342105124, 1793342105164),

  ('stp_01JBSEED000000000000000007', 'req_01JBSEED000000000000000001', 'stp_01JBSEED000000000000000004', 7, 2, 'method',
   'CartService.total', 'CartService', 'total', 'src/cart/cart.service.ts', 9, 3,
   0, 'returned', '[{"type":"array","preview":"[2 items]","size":2,"objectId":"obj_4"}]',
   '{"type":"number","preview":"1200"}', 'CartService', NULL, NULL, NULL, NULL, 0,
   44500000, 600000, 1793342105165, 1793342105165),

  ('stp_01JBSEED000000000000000008', 'req_01JBSEED000000000000000001', 'stp_01JBSEED000000000000000004', 8, 2, 'method',
   'PricingService.calculateDiscount', 'PricingService', 'calculateDiscount', 'src/pricing/pricing.service.ts', 22, 3,
   0, 'threw', '[{"type":"object","className":"User","preview":"User { id: 7, name: \"Ravi\", tier: undefined }","objectId":"obj_3"},{"type":"number","preview":"1200"}]',
   NULL, 'PricingService',
   '{"type":"TypeError","message":"Cannot read properties of undefined (reading ''rate'')","stack":"TypeError: Cannot read properties of undefined (reading ''rate'')
    at PricingService.calculateDiscount (src/pricing/pricing.service.ts:27:31)
    at OrdersService.create (src/orders/orders.service.ts:35:41)","file":"src/pricing/pricing.service.ts","line":27,"column":31}',
   'propagated', NULL, NULL, 1, 45200000, 300000, 1793342105166, 1793342105166),

  ('stp_01JBSEED000000000000000009', 'req_01JBSEED000000000000000001', 'stp_01JBSEED000000000000000008', 9, 3, 'decision',
   'if (user.tier === ''gold'')', NULL, NULL, 'src/pricing/pricing.service.ts', 24, 5,
   0, 'returned', NULL, NULL, NULL, NULL, NULL, NULL,
   '{"decisionType":"if","expression":"user.tier === ''gold''","values":{"user.tier":{"type":"undefined","preview":"undefined","suspicious":true}},"result":false,"branch":"else"}',
   0, 45300000, 10000, 1793342105166, 1793342105166);

-- One successful request (GET /orders/42), shortened
INSERT INTO steps (id, request_id, parent_id, seq, depth, kind, name, class_name, function_name,
                   file, line, is_async, status, args_json, return_json, boundary_type, detail_json,
                   start_offset_ns, duration_ns, created_at, updated_at) VALUES
  ('stp_01JBSEED000000000000000010', 'req_01JBSEED000000000000000002', NULL, 1, 0, 'guard',
   'JwtAuthGuard.canActivate', 'JwtAuthGuard', 'canActivate', 'src/auth/jwt-auth.guard.ts', 12,
   1, 'returned', NULL, '{"type":"boolean","preview":"true"}', NULL, '{"allowed":true}',
   300000, 1000000, 1793342110010, 1793342110011),
  ('stp_01JBSEED000000000000000011', 'req_01JBSEED000000000000000002', NULL, 2, 0, 'handler',
   'OrdersController.findOne', 'OrdersController', 'findOne', 'src/orders/orders.controller.ts', 26,
   1, 'returned', '[{"type":"string","preview":"\"42\""}]',
   '{"type":"object","className":"Order","preview":"Order { id: 42, total: 1200, status: \"paid\" }","objectId":"obj_9"}',
   NULL, NULL, 1500000, 19000000, 1793342110011, 1793342110030),
  ('stp_01JBSEED000000000000000012', 'req_01JBSEED000000000000000002', 'stp_01JBSEED000000000000000011', 3, 1, 'method',
   'OrdersService.findOne', 'OrdersService', 'findOne', 'src/orders/orders.service.ts', 52,
   1, 'returned', '[{"type":"number","preview":"42"}]',
   '{"type":"object","className":"Order","preview":"Order { id: 42, total: 1200, status: \"paid\" }","objectId":"obj_9"}',
   NULL, NULL, 1800000, 18500000, 1793342110011, 1793342110030),
  ('stp_01JBSEED000000000000000013', 'req_01JBSEED000000000000000002', 'stp_01JBSEED000000000000000012', 4, 2, 'boundary',
   'orders.findOne', NULL, NULL, 'src/orders/orders.service.ts', 53,
   1, 'returned', NULL, '{"type":"object","preview":"{ id: 42, total: 1200, status: \"paid\" }"}', 'db',
   '{"driver":"mongoose","operation":"findOne","collectionOrTable":"orders","query":"{ id: 42 }","resultSummary":"1 document"}',
   2000000, 17000000, 1793342110012, 1793342110029),
  -- The single step of the trashed GET /health request
  ('stp_01JBSEED000000000000000014', 'req_01JBSEED000000000000000003', NULL, 1, 0, 'handler',
   'HealthController.check', 'HealthController', 'check', 'src/health/health.controller.ts', 8,
   0, 'returned', '[]', '{"type":"object","preview":"{ status: \"ok\" }"}', NULL, NULL,
   200000, 1500000, 1793342101000, 1793342101002);

-- The user object (obj_3) followed across steps: the data journey in v2
INSERT INTO object_refs (request_id, step_id, object_id, role, path, type_name, created_at) VALUES
  ('req_01JBSEED000000000000000001', 'stp_01JBSEED000000000000000002', 'obj_2', 'return', 'return',  'CreateOrderDto', 1793342105123),
  ('req_01JBSEED000000000000000001', 'stp_01JBSEED000000000000000003', 'obj_2', 'arg',    'args[0]', 'CreateOrderDto', 1793342105123),
  ('req_01JBSEED000000000000000001', 'stp_01JBSEED000000000000000004', 'obj_2', 'arg',    'args[0]', 'CreateOrderDto', 1793342105123),
  ('req_01JBSEED000000000000000001', 'stp_01JBSEED000000000000000005', 'obj_3', 'return', 'return',  'User',           1793342105165),
  ('req_01JBSEED000000000000000001', 'stp_01JBSEED000000000000000008', 'obj_3', 'arg',    'args[0]', 'User',           1793342105166),
  ('req_01JBSEED000000000000000001', 'stp_01JBSEED000000000000000007', 'obj_4', 'arg',    'args[0]', 'Array',          1793342105165);
