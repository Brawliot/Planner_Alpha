CREATE TABLE "plan" (
	"id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"user_id" text NOT NULL,
	"config" jsonb NOT NULL,
	"stored" jsonb NOT NULL,
	"onboarding_step" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plan_report_id_unique" UNIQUE("report_id")
);
--> statement-breakpoint
ALTER TABLE "plan" ADD CONSTRAINT "plan_report_id_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan" ADD CONSTRAINT "plan_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_userId_idx" ON "plan" USING btree ("user_id");