CREATE TYPE "public"."property_fact_proposal_status" AS ENUM('pending', 'conflict', 'accepted', 'corrected', 'rejected', 'needs_review');--> statement-breakpoint
CREATE TYPE "public"."property_source_status" AS ENUM('upload_pending', 'uploaded', 'scanning', 'quarantined', 'queued', 'processing', 'review_ready', 'failed', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."property_source_job_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "extraction_callback_nonces" (
	"nonce" text PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_fact_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_project_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"external_key" text NOT NULL,
	"fact_key" text NOT NULL,
	"label" text NOT NULL,
	"category" text NOT NULL,
	"value_type" text NOT NULL,
	"value" jsonb,
	"unit" text,
	"confidence" double precision NOT NULL,
	"evidence_text" text NOT NULL,
	"evidence_locator" jsonb NOT NULL,
	"status" "property_fact_proposal_status" DEFAULT 'pending' NOT NULL,
	"conflicts_with_fact_id" uuid,
	"decided_by_user_id" text,
	"decision_note" text,
	"decision" jsonb,
	"decision_fingerprint" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "property_fact_proposals_confidence_range" CHECK ("property_fact_proposals"."confidence" >= 0 AND "property_fact_proposals"."confidence" <= 1)
);
--> statement-breakpoint
CREATE TABLE "property_sources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_project_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"media_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum_sha256" text NOT NULL,
	"status" "property_source_status" DEFAULT 'upload_pending' NOT NULL,
	"error_code" text,
	"error_message" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "property_sources_size_positive" CHECK ("property_sources"."size_bytes" > 0)
);
--> statement-breakpoint
CREATE TABLE "property_source_processing_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_project_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "property_source_job_status" DEFAULT 'queued' NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"model_id" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"estimated_cost_usd" numeric(12, 6),
	"error_code" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "property_source_jobs_attempt_positive" CHECK ("property_source_processing_jobs"."attempt" > 0)
);
--> statement-breakpoint
ALTER TABLE "extraction_callback_nonces" ADD CONSTRAINT "extraction_callback_nonces_job_id_property_source_processing_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."property_source_processing_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_fact_proposals" ADD CONSTRAINT "property_fact_proposals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_fact_proposals" ADD CONSTRAINT "property_fact_proposals_property_project_id_property_projects_id_fk" FOREIGN KEY ("property_project_id") REFERENCES "public"."property_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_fact_proposals" ADD CONSTRAINT "property_fact_proposals_source_id_property_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."property_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_fact_proposals" ADD CONSTRAINT "property_fact_proposals_job_id_property_source_processing_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."property_source_processing_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_fact_proposals" ADD CONSTRAINT "property_fact_proposals_conflicts_with_fact_id_property_facts_id_fk" FOREIGN KEY ("conflicts_with_fact_id") REFERENCES "public"."property_facts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_sources" ADD CONSTRAINT "property_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_sources" ADD CONSTRAINT "property_sources_property_project_id_property_projects_id_fk" FOREIGN KEY ("property_project_id") REFERENCES "public"."property_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_source_processing_jobs" ADD CONSTRAINT "property_source_processing_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_source_processing_jobs" ADD CONSTRAINT "property_source_processing_jobs_property_project_id_property_projects_id_fk" FOREIGN KEY ("property_project_id") REFERENCES "public"."property_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_source_processing_jobs" ADD CONSTRAINT "property_source_processing_jobs_source_id_property_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."property_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "extraction_callback_nonces_expiry_idx" ON "extraction_callback_nonces" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "property_fact_proposals_job_external_key_idx" ON "property_fact_proposals" USING btree ("job_id","external_key");--> statement-breakpoint
CREATE INDEX "property_fact_proposals_project_status_created_idx" ON "property_fact_proposals" USING btree ("property_project_id","status","created_at");--> statement-breakpoint
CREATE INDEX "property_fact_proposals_source_created_idx" ON "property_fact_proposals" USING btree ("source_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "property_sources_project_storage_key_idx" ON "property_sources" USING btree ("property_project_id","storage_key");--> statement-breakpoint
CREATE INDEX "property_sources_org_project_created_idx" ON "property_sources" USING btree ("organization_id","property_project_id","created_at");--> statement-breakpoint
CREATE INDEX "property_sources_project_status_idx" ON "property_sources" USING btree ("property_project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "property_source_jobs_idempotency_idx" ON "property_source_processing_jobs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "property_source_jobs_source_created_idx" ON "property_source_processing_jobs" USING btree ("source_id","created_at");