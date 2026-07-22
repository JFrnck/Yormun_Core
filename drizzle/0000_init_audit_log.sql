CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"request_id" uuid NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"action_type" text NOT NULL,
	"tool_name" text,
	"inputs_hash" text NOT NULL,
	"plan_summary" text,
	"approval_status" text NOT NULL,
	"approver" text,
	"external_inputs_summary" text,
	"prev_hash" text NOT NULL,
	"current_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_approvals" (
	"request_id" uuid PRIMARY KEY NOT NULL,
	"tool_name" text NOT NULL,
	"level" text NOT NULL,
	"inputs_hash" text NOT NULL,
	"plan_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_approved_at" timestamp with time zone,
	"first_approver" text,
	"available_at" timestamp with time zone,
	"escalated_at" timestamp with time zone
);
