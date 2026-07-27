ALTER TYPE "public"."property_source_job_status" ADD VALUE 'waiting_external' BEFORE 'succeeded';--> statement-breakpoint
ALTER TYPE "public"."property_source_job_status" ADD VALUE 'needs_manual_review' BEFORE 'cancelled';--> statement-breakpoint
ALTER TABLE "property_source_processing_jobs" ADD COLUMN "pipeline_version" text DEFAULT 'property-source-v1' NOT NULL;--> statement-breakpoint
ALTER TABLE "property_source_processing_jobs" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "property_source_processing_jobs" ADD COLUMN "provider_cost_microunits" bigint;--> statement-breakpoint
ALTER TABLE "property_source_processing_jobs" ADD COLUMN "currency" text;--> statement-breakpoint
ALTER TABLE "property_source_processing_jobs" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "property_source_processing_jobs" ADD CONSTRAINT "property_source_jobs_provider_cost_nonnegative" CHECK ("property_source_processing_jobs"."provider_cost_microunits" IS NULL OR "property_source_processing_jobs"."provider_cost_microunits" >= 0);
