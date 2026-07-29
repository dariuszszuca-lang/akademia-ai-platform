ALTER TABLE "property_facts" ADD COLUMN "semantic_key" text;--> statement-breakpoint
-- Existing rows intentionally remain NULL. New and touched facts receive a semantic key in the repository, so pre-existing collisions are preserved instead of deleted or merged.
CREATE UNIQUE INDEX "property_facts_project_semantic_key_idx" ON "property_facts" USING btree ("property_project_id","semantic_key");
