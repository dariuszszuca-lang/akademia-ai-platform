CREATE TABLE "studio_product_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"property_project_id" uuid,
	"name" text NOT NULL,
	"contract_version" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "studio_product_events" ADD CONSTRAINT "studio_product_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_product_events" ADD CONSTRAINT "studio_product_events_property_project_id_property_projects_id_fk" FOREIGN KEY ("property_project_id") REFERENCES "public"."property_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "studio_events_org_created_idx" ON "studio_product_events" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "studio_events_project_created_idx" ON "studio_product_events" USING btree ("property_project_id","created_at");