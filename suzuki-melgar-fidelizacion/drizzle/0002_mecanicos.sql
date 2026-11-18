CREATE TABLE "mechanics" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mechanics_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "mechanic_id" text;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_mechanic_id_mechanics_id_fk" FOREIGN KEY ("mechanic_id") REFERENCES "public"."mechanics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchases_mechanic_idx" ON "purchases" USING btree ("mechanic_id");