CREATE TYPE "public"."property_actor_type" AS ENUM('user', 'ai', 'integration');--> statement-breakpoint
CREATE TYPE "public"."property_address_mode" AS ENUM('exact', 'approximate', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."property_fact_status" AS ENUM('confirmed', 'declared', 'inferred', 'conflicting', 'missing', 'not_applicable');--> statement-breakpoint
CREATE TYPE "public"."property_fact_visibility" AS ENUM('internal', 'client', 'public');--> statement-breakpoint
CREATE TYPE "public"."organization_role" AS ENUM('owner', 'admin', 'agent', 'marketer', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."property_stage" AS ENUM('draft', 'collecting', 'verification', 'ready', 'marketing', 'under_offer', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('apartment', 'house', 'plot', 'commercial', 'premises', 'other');--> statement-breakpoint
CREATE TYPE "public"."property_transaction_type" AS ENUM('sale', 'rent');--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "organization_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_memberships_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_project_id" uuid,
	"actor_type" "property_actor_type" NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_project_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"category" text NOT NULL,
	"value_type" text NOT NULL,
	"value" jsonb,
	"unit" text,
	"status" "property_fact_status" NOT NULL,
	"visibility" "property_fact_visibility" DEFAULT 'internal' NOT NULL,
	"source_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_type" "property_actor_type" NOT NULL,
	"created_by_id" text NOT NULL,
	"confirmed_by_user_id" text,
	"confirmed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_by_user_id" text NOT NULL,
	"title" text NOT NULL,
	"property_type" "property_type" NOT NULL,
	"transaction_type" "property_transaction_type" NOT NULL,
	"stage" "property_stage" DEFAULT 'draft' NOT NULL,
	"city" text NOT NULL,
	"district" text,
	"address_mode" "property_address_mode" NOT NULL,
	"address" text,
	"plot_identifier" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_audit_events" ADD CONSTRAINT "property_audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_audit_events" ADD CONSTRAINT "property_audit_events_property_project_id_property_projects_id_fk" FOREIGN KEY ("property_project_id") REFERENCES "public"."property_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_facts" ADD CONSTRAINT "property_facts_property_project_id_property_projects_id_fk" FOREIGN KEY ("property_project_id") REFERENCES "public"."property_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_projects" ADD CONSTRAINT "property_projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_memberships_user_idx" ON "organization_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_owner_user_idx" ON "organizations" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "property_audit_property_created_idx" ON "property_audit_events" USING btree ("property_project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "property_facts_project_key_idx" ON "property_facts" USING btree ("property_project_id","key");--> statement-breakpoint
CREATE INDEX "property_facts_project_status_idx" ON "property_facts" USING btree ("property_project_id","status");--> statement-breakpoint
CREATE INDEX "property_projects_org_updated_idx" ON "property_projects" USING btree ("organization_id","updated_at");