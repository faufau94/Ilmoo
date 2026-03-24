CREATE TYPE "public"."badge_tier" AS ENUM('bronze', 'silver', 'gold', 'expert', 'grand_master');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('waiting', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."match_type" AS ENUM('ranked', 'friendly', 'solo', 'tournament');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('pending', 'resolved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('wrong_answer', 'duplicate', 'inappropriate', 'other');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('free', 'premium', 'expired');--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('draft', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('player', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'banned');--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(500) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app_flavors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(50) NOT NULL,
	"app_name" varchar(100) NOT NULL,
	"app_description" text,
	"support_email" varchar(255),
	"primary_color" varchar(7) NOT NULL,
	"primary_dark" varchar(7) NOT NULL,
	"accent_positive" varchar(7) NOT NULL,
	"accent_negative" varchar(7) NOT NULL,
	"enabled_category_ids" uuid[],
	"ads_enabled" boolean DEFAULT true,
	"premium_enabled" boolean DEFAULT true,
	"tournaments_enabled" boolean DEFAULT true,
	"friends_enabled" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"maintenance_message" text,
	"min_app_version" varchar(20),
	"app_store_url" varchar(500),
	"play_store_url" varchar(500),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "app_flavors_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"parent_id" uuid,
	"description" text,
	"icon_name" varchar(50) NOT NULL,
	"color" varchar(7) NOT NULL,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"is_premium" boolean DEFAULT false,
	"is_thematic" boolean DEFAULT false,
	"question_count" integer DEFAULT 0,
	"match_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"friend_id" uuid NOT NULL,
	"accepted" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "friendships_user_id_friend_id_unique" UNIQUE("user_id","friend_id")
);
--> statement-breakpoint
CREATE TABLE "match_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"round_number" smallint NOT NULL,
	"is_bonus" boolean DEFAULT false,
	"p1_answer_index" smallint,
	"p1_is_correct" boolean,
	"p1_time_ms" integer,
	"p1_points" integer DEFAULT 0,
	"p2_answer_index" smallint,
	"p2_is_correct" boolean,
	"p2_time_ms" integer,
	"p2_points" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"match_type" "match_type" DEFAULT 'ranked',
	"status" "match_status" DEFAULT 'waiting',
	"tournament_id" uuid,
	"player1_id" uuid NOT NULL,
	"player2_id" uuid,
	"player1_score" integer DEFAULT 0,
	"player2_score" integer DEFAULT 0,
	"winner_id" uuid,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"total_rounds" smallint DEFAULT 7,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "question_flavors" (
	"question_id" uuid NOT NULL,
	"flavor_slug" varchar(50) NOT NULL,
	CONSTRAINT "question_flavors_question_id_flavor_slug_pk" PRIMARY KEY("question_id","flavor_slug")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"question_text" text NOT NULL,
	"answers" jsonb NOT NULL,
	"correct_index" smallint NOT NULL,
	"difficulty" "difficulty" DEFAULT 'medium',
	"explanation" text,
	"times_played" integer DEFAULT 0,
	"times_correct" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"is_verified" boolean DEFAULT false,
	"submitted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"report_type" "report_type" NOT NULL,
	"status" "report_status" DEFAULT 'pending',
	"question_id" uuid,
	"reported_user_id" uuid,
	"description" text,
	"admin_note" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tournament_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"score" integer DEFAULT 0,
	"matches_played" integer DEFAULT 0,
	"matches_won" integer DEFAULT 0,
	"joined_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "tournament_participants_tournament_id_user_id_unique" UNIQUE("tournament_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"status" "tournament_status" DEFAULT 'draft',
	"category_ids" uuid[] NOT NULL,
	"max_players" integer,
	"rounds_per_match" smallint DEFAULT 7,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"sponsor_name" varchar(200),
	"sponsor_url" varchar(500),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_category_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"matches_played" integer DEFAULT 0,
	"matches_won" integer DEFAULT 0,
	"xp" integer DEFAULT 0,
	"badge" "badge_tier" DEFAULT 'bronze',
	"correct_answers" integer DEFAULT 0,
	"total_answers" integer DEFAULT 0,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_category_stats_user_id_category_id_unique" UNIQUE("user_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "user_seen_questions" (
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_seen_questions_user_id_question_id_pk" PRIMARY KEY("user_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firebase_uid" varchar(128) NOT NULL,
	"username" varchar(30),
	"email" varchar(255),
	"role" "user_role" DEFAULT 'player',
	"status" "user_status" DEFAULT 'active',
	"subscription" "subscription_status" DEFAULT 'free',
	"is_anonymous" boolean DEFAULT true,
	"app_flavor" varchar(50),
	"fcm_token" varchar(500),
	"total_matches" integer DEFAULT 0,
	"total_wins" integer DEFAULT 0,
	"total_xp" integer DEFAULT 0,
	"level" integer DEFAULT 1,
	"win_streak" integer DEFAULT 0,
	"best_streak" integer DEFAULT 0,
	"daily_matches" integer DEFAULT 0,
	"last_match_date" date,
	"password_hash" varchar(255),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_friend_id_users_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_rounds" ADD CONSTRAINT "match_rounds_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_rounds" ADD CONSTRAINT "match_rounds_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player1_id_users_id_fk" FOREIGN KEY ("player1_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player2_id_users_id_fk" FOREIGN KEY ("player2_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_id_users_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_flavors" ADD CONSTRAINT "question_flavors_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_flavors" ADD CONSTRAINT "question_flavors_flavor_slug_app_flavors_slug_fk" FOREIGN KEY ("flavor_slug") REFERENCES "public"."app_flavors"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_category_stats" ADD CONSTRAINT "user_category_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_category_stats" ADD CONSTRAINT "user_category_stats_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_seen_questions" ADD CONSTRAINT "user_seen_questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_seen_questions" ADD CONSTRAINT "user_seen_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_admin_sessions_token" ON "admin_sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_categories_slug" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_categories_parent" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_categories_active" ON "categories" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE INDEX "idx_friendships_user" ON "friendships" USING btree ("user_id","accepted");--> statement-breakpoint
CREATE INDEX "idx_friendships_friend" ON "friendships" USING btree ("friend_id","accepted");--> statement-breakpoint
CREATE INDEX "idx_rounds_match" ON "match_rounds" USING btree ("match_id","round_number");--> statement-breakpoint
CREATE INDEX "idx_matches_player1" ON "matches" USING btree ("player1_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_matches_player2" ON "matches" USING btree ("player2_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_matches_category" ON "matches" USING btree ("category_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_matches_status" ON "matches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_question_flavors_slug" ON "question_flavors" USING btree ("flavor_slug");--> statement-breakpoint
CREATE INDEX "idx_question_flavors_question" ON "question_flavors" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "idx_questions_category" ON "questions" USING btree ("category_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_questions_difficulty" ON "questions" USING btree ("category_id","difficulty");--> statement-breakpoint
CREATE INDEX "idx_questions_active" ON "questions" USING btree ("is_active","is_verified");--> statement-breakpoint
CREATE INDEX "idx_reports_status" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_tournament_participants_score" ON "tournament_participants" USING btree ("tournament_id","score");--> statement-breakpoint
CREATE INDEX "idx_tournaments_status" ON "tournaments" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "idx_user_cat_stats_user" ON "user_category_stats" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_cat_stats_xp" ON "user_category_stats" USING btree ("category_id","xp");--> statement-breakpoint
CREATE INDEX "idx_users_firebase_uid" ON "users" USING btree ("firebase_uid");--> statement-breakpoint
CREATE INDEX "idx_users_username" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_users_total_xp" ON "users" USING btree ("total_xp");--> statement-breakpoint
CREATE INDEX "idx_users_status" ON "users" USING btree ("status");