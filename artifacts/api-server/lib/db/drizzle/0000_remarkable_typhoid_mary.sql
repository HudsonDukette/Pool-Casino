CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"email" text,
	"balance" numeric(25, 2) DEFAULT '10000.00' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"referral_code" text,
	"referred_by" integer,
	"avatar_url" text,
	"total_profit" numeric(25, 2) DEFAULT '0.00' NOT NULL,
	"biggest_win" numeric(25, 2) DEFAULT '0.00' NOT NULL,
	"biggest_bet" numeric(25, 2) DEFAULT '0.00' NOT NULL,
	"games_played" text DEFAULT '0' NOT NULL,
	"win_streak" text DEFAULT '0' NOT NULL,
	"current_streak" text DEFAULT '0' NOT NULL,
	"total_wins" text DEFAULT '0' NOT NULL,
	"total_losses" text DEFAULT '0' NOT NULL,
	"last_daily_claim" timestamp with time zone,
	"last_bet_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"crazy_games_user_id" text,
	"is_crazy_games_linked" boolean DEFAULT false NOT NULL,
	"device_id" text,
	"is_guest" boolean DEFAULT false NOT NULL,
	"suspended_until" timestamp with time zone,
	"banned_until" timestamp with time zone,
	"permanently_banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"is_owner" boolean DEFAULT false NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code"),
	CONSTRAINT "users_crazy_games_user_id_unique" UNIQUE("crazy_games_user_id"),
	CONSTRAINT "users_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "pool" (
	"id" serial PRIMARY KEY NOT NULL,
	"total_amount" numeric(15, 2) DEFAULT '1000000.00' NOT NULL,
	"biggest_win" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"biggest_bet" numeric(15, 2) DEFAULT '0.00' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"game_type" text NOT NULL,
	"bet_amount" numeric(15, 2) NOT NULL,
	"result" text NOT NULL,
	"payout" numeric(15, 2) NOT NULL,
	"multiplier" numeric(10, 4),
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friends" (
	"id" serial PRIMARY KEY NOT NULL,
	"requester_id" integer NOT NULL,
	"recipient_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"user_id" integer,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_admin_broadcast" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_room_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'public' NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "money_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"message" text,
	"amount" numeric(15, 2) DEFAULT '10000.00' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"reporter_id" integer,
	"reported_user_id" integer NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" integer
);
--> statement-breakpoint
CREATE TABLE "ban_appeals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" integer
);
--> statement-breakpoint
CREATE TABLE "badges" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text DEFAULT '🏆' NOT NULL,
	"badge_type" text DEFAULT 'permanent' NOT NULL,
	"requirement_type" text NOT NULL,
	"requirement_value" integer DEFAULT 1 NOT NULL,
	"requirement_game" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "badges_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "match_players" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"bet_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"accepted" boolean DEFAULT false NOT NULL,
	"score" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_rounds" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"round_number" integer NOT NULL,
	"game_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"winner_id" integer
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"winner_id" integer,
	"total_rounds" integer DEFAULT 3 NOT NULL,
	"final_bet" numeric(15, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "monthly_challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text DEFAULT '🎯' NOT NULL,
	"requirement_type" text NOT NULL,
	"requirement_value" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "multiplayer_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"game_type" text NOT NULL,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"badge_id" integer NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"claimed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_monthly_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"challenge_id" integer NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"claimed" boolean DEFAULT false NOT NULL,
	"claimed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "casino_bets" (
	"id" serial PRIMARY KEY NOT NULL,
	"casino_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"game_type" text NOT NULL,
	"bet_amount" numeric(15, 2) NOT NULL,
	"result" text NOT NULL,
	"payout" numeric(15, 2) NOT NULL,
	"multiplier" numeric(10, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "casino_drinks" (
	"id" serial PRIMARY KEY NOT NULL,
	"casino_id" integer NOT NULL,
	"name" text NOT NULL,
	"emoji" text DEFAULT '🍹' NOT NULL,
	"price" numeric(15, 2) DEFAULT '500.00' NOT NULL,
	"tier" text DEFAULT 'standard' NOT NULL,
	"is_available" boolean DEFAULT false NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "casino_game_odds" (
	"id" serial PRIMARY KEY NOT NULL,
	"casino_id" integer NOT NULL,
	"game_type" text NOT NULL,
	"payout_multiplier" numeric(5, 4) DEFAULT '1.0000' NOT NULL,
	"pay_table_config" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "casino_games_owned" (
	"id" serial PRIMARY KEY NOT NULL,
	"casino_id" integer NOT NULL,
	"game_type" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "casino_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"casino_id" integer NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(25, 2) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "casinos" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"emoji" text DEFAULT '🏦' NOT NULL,
	"image_url" text,
	"bankroll" numeric(25, 2) DEFAULT '0.00' NOT NULL,
	"min_bet" numeric(15, 2) DEFAULT '100.00' NOT NULL,
	"max_bet" numeric(15, 2) DEFAULT '10000.00' NOT NULL,
	"is_paused" boolean DEFAULT false NOT NULL,
	"purchase_price" numeric(25, 2) DEFAULT '0.00' NOT NULL,
	"insolvency_winner_id" integer,
	"insolvency_debt_amount" numeric(25, 2),
	"total_bets" integer DEFAULT 0 NOT NULL,
	"total_wagered" numeric(25, 2) DEFAULT '0.00' NOT NULL,
	"total_paid_out" numeric(25, 2) DEFAULT '0.00' NOT NULL,
	"cheap_storage_level" integer DEFAULT 0 NOT NULL,
	"standard_storage_level" integer DEFAULT 0 NOT NULL,
	"expensive_storage_level" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "casinos_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "monthly_tax_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"casino_id" integer NOT NULL,
	"tax_amount" numeric(25, 2) NOT NULL,
	"bankroll_before" numeric(25, 2) NOT NULL,
	"bankroll_after" numeric(25, 2) NOT NULL,
	"taxed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_drinks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"casino_id" integer NOT NULL,
	"drink_id" integer NOT NULL,
	"drink_name" text NOT NULL,
	"drink_emoji" text NOT NULL,
	"drink_price" numeric(15, 2) NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "money_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"direction" text NOT NULL,
	"amount" numeric(25, 2) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"actor_user_id" integer,
	"target_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bets" ADD CONSTRAINT "bets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friends" ADD CONSTRAINT "friends_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friends" ADD CONSTRAINT "friends_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_room_id_chat_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_room_members" ADD CONSTRAINT "chat_room_members_room_id_chat_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_room_members" ADD CONSTRAINT "chat_room_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_requests" ADD CONSTRAINT "money_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ban_appeals" ADD CONSTRAINT "ban_appeals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_rounds" ADD CONSTRAINT "match_rounds_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_rounds" ADD CONSTRAINT "match_rounds_winner_id_users_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_id_users_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "multiplayer_queue" ADD CONSTRAINT "multiplayer_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_monthly_progress" ADD CONSTRAINT "user_monthly_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_monthly_progress" ADD CONSTRAINT "user_monthly_progress_challenge_id_monthly_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."monthly_challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casino_bets" ADD CONSTRAINT "casino_bets_casino_id_casinos_id_fk" FOREIGN KEY ("casino_id") REFERENCES "public"."casinos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casino_bets" ADD CONSTRAINT "casino_bets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casino_drinks" ADD CONSTRAINT "casino_drinks_casino_id_casinos_id_fk" FOREIGN KEY ("casino_id") REFERENCES "public"."casinos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casino_game_odds" ADD CONSTRAINT "casino_game_odds_casino_id_casinos_id_fk" FOREIGN KEY ("casino_id") REFERENCES "public"."casinos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casino_games_owned" ADD CONSTRAINT "casino_games_owned_casino_id_casinos_id_fk" FOREIGN KEY ("casino_id") REFERENCES "public"."casinos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casino_transactions" ADD CONSTRAINT "casino_transactions_casino_id_casinos_id_fk" FOREIGN KEY ("casino_id") REFERENCES "public"."casinos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casinos" ADD CONSTRAINT "casinos_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casinos" ADD CONSTRAINT "casinos_insolvency_winner_id_users_id_fk" FOREIGN KEY ("insolvency_winner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_tax_logs" ADD CONSTRAINT "monthly_tax_logs_casino_id_casinos_id_fk" FOREIGN KEY ("casino_id") REFERENCES "public"."casinos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_drinks" ADD CONSTRAINT "user_drinks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_drinks" ADD CONSTRAINT "user_drinks_casino_id_casinos_id_fk" FOREIGN KEY ("casino_id") REFERENCES "public"."casinos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_drinks" ADD CONSTRAINT "user_drinks_drink_id_casino_drinks_id_fk" FOREIGN KEY ("drink_id") REFERENCES "public"."casino_drinks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_ledger" ADD CONSTRAINT "money_ledger_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_ledger" ADD CONSTRAINT "money_ledger_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;