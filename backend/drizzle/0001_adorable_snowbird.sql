ALTER TABLE "app_flavors" ADD COLUMN "free_daily_matches" integer DEFAULT 5;--> statement-breakpoint
ALTER TABLE "app_flavors" ADD COLUMN "round_count" integer DEFAULT 7;--> statement-breakpoint
ALTER TABLE "app_flavors" ADD COLUMN "timer_seconds" integer DEFAULT 10;--> statement-breakpoint
ALTER TABLE "app_flavors" ADD COLUMN "bonus_round_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "app_flavors" ADD COLUMN "matchmaking_timeout_seconds" integer DEFAULT 15;--> statement-breakpoint
ALTER TABLE "app_flavors" ADD COLUMN "points_per_round" integer DEFAULT 20;--> statement-breakpoint
ALTER TABLE "app_flavors" ADD COLUMN "points_bonus_round" integer DEFAULT 40;--> statement-breakpoint
ALTER TABLE "app_flavors" ADD COLUMN "speed_weight" varchar(10) DEFAULT '0.6';--> statement-breakpoint
ALTER TABLE "app_flavors" ADD COLUMN "base_weight" varchar(10) DEFAULT '0.4';--> statement-breakpoint
ALTER TABLE "app_flavors" ADD COLUMN "min_correct_points" integer DEFAULT 5;--> statement-breakpoint
ALTER TABLE "app_flavors" ADD COLUMN "xp_base_match" integer DEFAULT 50;--> statement-breakpoint
ALTER TABLE "app_flavors" ADD COLUMN "xp_win_bonus" integer DEFAULT 25;--> statement-breakpoint
ALTER TABLE "app_flavors" ADD COLUMN "xp_perfect_bonus" integer DEFAULT 50;--> statement-breakpoint
ALTER TABLE "app_flavors" ADD COLUMN "xp_streak_multiplier" integer DEFAULT 5;--> statement-breakpoint
ALTER TABLE "app_flavors" ADD COLUMN "level_formula_divisor" integer DEFAULT 100;--> statement-breakpoint
ALTER TABLE "app_flavors" ADD COLUMN "badge_thresholds" jsonb DEFAULT '{"bronze":10,"silver":25,"gold":50,"expert":100,"grand_master":200}'::jsonb;--> statement-breakpoint
ALTER TABLE "app_flavors" ADD COLUMN "custom_texts" jsonb DEFAULT '{}'::jsonb;