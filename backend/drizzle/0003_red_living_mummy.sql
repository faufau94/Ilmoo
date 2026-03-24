CREATE TABLE "category_flavors" (
	"category_id" uuid NOT NULL,
	"flavor_slug" varchar(50) NOT NULL,
	CONSTRAINT "category_flavors_category_id_flavor_slug_pk" PRIMARY KEY("category_id","flavor_slug")
);
--> statement-breakpoint
ALTER TABLE "category_flavors" ADD CONSTRAINT "category_flavors_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_flavors" ADD CONSTRAINT "category_flavors_flavor_slug_app_flavors_slug_fk" FOREIGN KEY ("flavor_slug") REFERENCES "public"."app_flavors"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_category_flavors_slug" ON "category_flavors" USING btree ("flavor_slug");--> statement-breakpoint
CREATE INDEX "idx_category_flavors_category" ON "category_flavors" USING btree ("category_id");