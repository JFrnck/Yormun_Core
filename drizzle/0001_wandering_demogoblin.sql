CREATE TABLE "budget_daily_usage" (
	"date" date PRIMARY KEY NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_hourly_usage" (
	"hour_bucket" timestamp with time zone PRIMARY KEY NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_kill_switch" (
	"id" integer PRIMARY KEY NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"activated_at" timestamp with time zone,
	"reason" text
);
