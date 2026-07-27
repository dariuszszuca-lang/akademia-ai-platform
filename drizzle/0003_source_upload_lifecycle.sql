ALTER TYPE "public"."property_source_status" ADD VALUE 'validating' BEFORE 'queued';--> statement-breakpoint
ALTER TYPE "public"."property_source_status" ADD VALUE 'completed' BEFORE 'failed';--> statement-breakpoint
ALTER TABLE "property_sources" ADD COLUMN "uploaded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "property_sources" ADD COLUMN "processed_at" timestamp with time zone;