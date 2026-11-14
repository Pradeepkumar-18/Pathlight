CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `object_refs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` text NOT NULL,
	`step_id` text,
	`object_id` text NOT NULL,
	`role` text NOT NULL,
	`path` text DEFAULT '' NOT NULL,
	`type_name` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`step_id`) REFERENCES `steps`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "object_refs_role" CHECK("object_refs"."role" IN ('arg','return','this','thrown','request')),
	CONSTRAINT "object_refs_request_role" CHECK(("object_refs"."role" = 'request') = ("object_refs"."step_id" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `idx_object_refs_object` ON `object_refs` (`request_id`,`object_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_object_refs` ON `object_refs` (`request_id`,`step_id`,`object_id`,`role`,`path`);--> statement-breakpoint
CREATE TABLE `requests` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`entry_type` text DEFAULT 'http' NOT NULL,
	`method` text,
	`path` text,
	`route` text,
	`state` text DEFAULT 'in_progress' NOT NULL,
	`http_status` integer,
	`has_error` integer DEFAULT 0 NOT NULL,
	`error_step_id` text,
	`step_count` integer DEFAULT 0 NOT NULL,
	`truncated` integer DEFAULT 0 NOT NULL,
	`request_json` text NOT NULL,
	`response_json` text,
	`unhandled_error_json` text,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`duration_ns` integer,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "requests_entry_type" CHECK("requests"."entry_type" IN ('http','test','queue','cron')),
	CONSTRAINT "requests_method" CHECK("requests"."method" IN ('GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS')),
	CONSTRAINT "requests_state" CHECK("requests"."state" IN ('in_progress','completed','incomplete')),
	CONSTRAINT "requests_has_error" CHECK("requests"."has_error" IN (0,1)),
	CONSTRAINT "requests_truncated" CHECK("requests"."truncated" IN (0,1)),
	CONSTRAINT "requests_soft_delete_finished" CHECK("requests"."deleted_at" IS NULL OR "requests"."state" <> 'in_progress'),
	CONSTRAINT "requests_http_has_method_path" CHECK("requests"."entry_type" <> 'http' OR ("requests"."method" IS NOT NULL AND "requests"."path" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `idx_requests_started_at` ON `requests` ("started_at" DESC);--> statement-breakpoint
CREATE INDEX `idx_requests_session` ON `requests` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_requests_error` ON `requests` (`has_error`,"started_at" DESC);--> statement-breakpoint
CREATE INDEX `idx_requests_route` ON `requests` (`method`,`route`);--> statement-breakpoint
CREATE INDEX `idx_requests_active` ON `requests` ("started_at" DESC) WHERE "requests"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX `idx_requests_trash` ON `requests` (`deleted_at`) WHERE "requests"."deleted_at" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`pid` integer NOT NULL,
	`command` text,
	`cwd` text NOT NULL,
	`node_version` text NOT NULL,
	`agent_version` text NOT NULL,
	`protocol_version` integer NOT NULL,
	`framework` text DEFAULT 'unknown' NOT NULL,
	`status` text DEFAULT 'connected' NOT NULL,
	`disabled_reason` text,
	`connected_at` integer NOT NULL,
	`disconnected_at` integer,
	`exit_code` integer,
	`warnings_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "sessions_framework" CHECK("sessions"."framework" IN ('nestjs','express','unknown')),
	CONSTRAINT "sessions_status" CHECK("sessions"."status" IN ('connected','disconnected','disabled'))
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_status` ON `sessions` (`status`);--> statement-breakpoint
CREATE TABLE `steps` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`parent_id` text,
	`seq` integer NOT NULL,
	`depth` integer DEFAULT 0 NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`class_name` text,
	`function_name` text,
	`file` text,
	`line` integer,
	`column` integer,
	`is_async` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`args_json` text,
	`arg_names_json` text,
	`return_json` text,
	`this_class` text,
	`error_json` text,
	`error_handling` text,
	`boundary_type` text,
	`detail_json` text,
	`on_error_path` integer DEFAULT 0 NOT NULL,
	`collapsed_count` integer DEFAULT 1 NOT NULL,
	`start_offset_ns` integer NOT NULL,
	`duration_ns` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `steps`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "steps_seq" CHECK("steps"."seq" >= 1),
	CONSTRAINT "steps_depth" CHECK("steps"."depth" >= 0),
	CONSTRAINT "steps_kind" CHECK("steps"."kind" IN ('function','method','middleware','guard','interceptor','pipe','handler','filter','boundary','constructor','callback','decision','loop')),
	CONSTRAINT "steps_is_async" CHECK("steps"."is_async" IN (0,1)),
	CONSTRAINT "steps_status" CHECK("steps"."status" IN ('running','returned','threw')),
	CONSTRAINT "steps_error_handling" CHECK("steps"."error_handling" IN ('propagated','swallowed','converted','unhandled')),
	CONSTRAINT "steps_boundary_type" CHECK("steps"."boundary_type" IN ('db','http','redis','queue','fs')),
	CONSTRAINT "steps_on_error_path" CHECK("steps"."on_error_path" IN (0,1)),
	CONSTRAINT "steps_collapsed_count" CHECK("steps"."collapsed_count" >= 1),
	CONSTRAINT "steps_boundary_iff_kind" CHECK(("steps"."kind" = 'boundary') = ("steps"."boundary_type" IS NOT NULL)),
	CONSTRAINT "steps_error_handling_threw" CHECK("steps"."error_handling" IS NULL OR "steps"."status" = 'threw')
);
--> statement-breakpoint
CREATE INDEX `idx_steps_parent` ON `steps` (`request_id`,`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_steps_error_path` ON `steps` (`request_id`,`on_error_path`);--> statement-breakpoint
CREATE INDEX `idx_steps_name` ON `steps` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_steps_request_seq` ON `steps` (`request_id`,`seq`);