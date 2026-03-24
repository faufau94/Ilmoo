import {
  pgTable, pgEnum, uuid, varchar, text, boolean, integer, smallint,
  timestamp, date, jsonb, index, uniqueIndex, primaryKey, unique, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ── Enums ──

export const difficultyEnum = pgEnum('difficulty', ['easy', 'medium', 'hard']);
export const matchStatusEnum = pgEnum('match_status', ['waiting', 'in_progress', 'completed', 'cancelled']);
export const matchTypeEnum = pgEnum('match_type', ['ranked', 'friendly', 'solo', 'tournament']);
export const reportTypeEnum = pgEnum('report_type', ['wrong_answer', 'duplicate', 'inappropriate', 'other']);
export const reportStatusEnum = pgEnum('report_status', ['pending', 'resolved', 'rejected']);
export const badgeTierEnum = pgEnum('badge_tier', ['bronze', 'silver', 'gold', 'expert', 'grand_master']);
export const tournamentStatusEnum = pgEnum('tournament_status', ['draft', 'active', 'completed', 'cancelled']);
export const userRoleEnum = pgEnum('user_role', ['player', 'admin']);
export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'banned']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['free', 'premium', 'expired']);

// ── App Flavors ──

export const appFlavors = pgTable('app_flavors', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 50 }).unique().notNull(),
  appName: varchar('app_name', { length: 100 }).notNull(),
  appDescription: text('app_description'),
  supportEmail: varchar('support_email', { length: 255 }),

  primaryColor: varchar('primary_color', { length: 7 }).notNull(),
  primaryDark: varchar('primary_dark', { length: 7 }).notNull(),
  accentPositive: varchar('accent_positive', { length: 7 }).notNull(),
  accentNegative: varchar('accent_negative', { length: 7 }).notNull(),

  enabledCategoryIds: uuid('enabled_category_ids').array(),

  adsEnabled: boolean('ads_enabled').default(true),
  premiumEnabled: boolean('premium_enabled').default(true),
  tournamentsEnabled: boolean('tournaments_enabled').default(true),
  friendsEnabled: boolean('friends_enabled').default(true),

  isActive: boolean('is_active').default(true),
  maintenanceMessage: text('maintenance_message'),
  minAppVersion: varchar('min_app_version', { length: 20 }),

  appStoreUrl: varchar('app_store_url', { length: 500 }),
  playStoreUrl: varchar('play_store_url', { length: 500 }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ── Users ──

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  firebaseUid: varchar('firebase_uid', { length: 128 }).unique().notNull(),
  username: varchar('username', { length: 30 }).unique(),
  email: varchar('email', { length: 255 }).unique(),
  role: userRoleEnum('role').default('player'),
  status: userStatusEnum('status').default('active'),
  subscription: subscriptionStatusEnum('subscription').default('free'),
  isAnonymous: boolean('is_anonymous').default(true),
  appFlavor: varchar('app_flavor', { length: 50 }),
  fcmToken: varchar('fcm_token', { length: 500 }),

  totalMatches: integer('total_matches').default(0),
  totalWins: integer('total_wins').default(0),
  totalXp: integer('total_xp').default(0),
  level: integer('level').default(1),
  winStreak: integer('win_streak').default(0),
  bestStreak: integer('best_streak').default(0),
  dailyMatches: integer('daily_matches').default(0),
  lastMatchDate: date('last_match_date'),

  passwordHash: varchar('password_hash', { length: 255 }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
}, (t) => [
  index('idx_users_firebase_uid').on(t.firebaseUid),
  index('idx_users_username').on(t.username),
  index('idx_users_total_xp').on(t.totalXp),
  index('idx_users_status').on(t.status),
]);

// ── Categories ──

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).unique().notNull(),
  parentId: uuid('parent_id').references((): any => categories.id, { onDelete: 'cascade' }),
  description: text('description'),
  iconName: varchar('icon_name', { length: 50 }).notNull(),
  color: varchar('color', { length: 7 }).notNull(),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  isPremium: boolean('is_premium').default(false),
  isThematic: boolean('is_thematic').default(false),

  questionCount: integer('question_count').default(0),
  matchCount: integer('match_count').default(0),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('idx_categories_slug').on(t.slug),
  index('idx_categories_parent').on(t.parentId),
  index('idx_categories_active').on(t.isActive, t.sortOrder),
]);

// ── Questions ──

export const questions = pgTable('questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  questionText: text('question_text').notNull(),
  answers: jsonb('answers').notNull().$type<string[]>(),
  correctIndex: smallint('correct_index').notNull(),
  difficulty: difficultyEnum('difficulty').default('medium'),
  explanation: text('explanation'),

  timesPlayed: integer('times_played').default(0),
  timesCorrect: integer('times_correct').default(0),

  isActive: boolean('is_active').default(true),
  isVerified: boolean('is_verified').default(false),
  submittedBy: uuid('submitted_by').references(() => users.id),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('idx_questions_category').on(t.categoryId, t.isActive),
  index('idx_questions_difficulty').on(t.categoryId, t.difficulty),
  index('idx_questions_active').on(t.isActive, t.isVerified),
]);

// ── Question Flavors (many-to-many) ──

export const questionFlavors = pgTable('question_flavors', {
  questionId: uuid('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  flavorSlug: varchar('flavor_slug', { length: 50 }).notNull().references(() => appFlavors.slug, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.questionId, t.flavorSlug] }),
  index('idx_question_flavors_slug').on(t.flavorSlug),
  index('idx_question_flavors_question').on(t.questionId),
]);

// ── Tournaments ──

export const tournaments = pgTable('tournaments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  status: tournamentStatusEnum('status').default('draft'),

  categoryIds: uuid('category_ids').array().notNull(),
  maxPlayers: integer('max_players'),
  roundsPerMatch: smallint('rounds_per_match').default(7),

  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),

  sponsorName: varchar('sponsor_name', { length: 200 }),
  sponsorUrl: varchar('sponsor_url', { length: 500 }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('idx_tournaments_status').on(t.status, t.startsAt),
]);

// ── Tournament Participants ──

export const tournamentParticipants = pgTable('tournament_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  score: integer('score').default(0),
  matchesPlayed: integer('matches_played').default(0),
  matchesWon: integer('matches_won').default(0),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  unique().on(t.tournamentId, t.userId),
  index('idx_tournament_participants_score').on(t.tournamentId, t.score),
]);

// ── Matches ──

export const matches = pgTable('matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id').notNull().references(() => categories.id),
  matchType: matchTypeEnum('match_type').default('ranked'),
  status: matchStatusEnum('status').default('waiting'),
  tournamentId: uuid('tournament_id').references(() => tournaments.id),

  player1Id: uuid('player1_id').notNull().references(() => users.id),
  player2Id: uuid('player2_id').references(() => users.id),
  player1Score: integer('player1_score').default(0),
  player2Score: integer('player2_score').default(0),
  winnerId: uuid('winner_id').references(() => users.id),

  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  totalRounds: smallint('total_rounds').default(7),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('idx_matches_player1').on(t.player1Id, t.createdAt),
  index('idx_matches_player2').on(t.player2Id, t.createdAt),
  index('idx_matches_category').on(t.categoryId, t.createdAt),
  index('idx_matches_status').on(t.status),
]);

// ── Match Rounds ──

export const matchRounds = pgTable('match_rounds', {
  id: uuid('id').primaryKey().defaultRandom(),
  matchId: uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => questions.id),
  roundNumber: smallint('round_number').notNull(),
  isBonus: boolean('is_bonus').default(false),

  p1AnswerIndex: smallint('p1_answer_index'),
  p1IsCorrect: boolean('p1_is_correct'),
  p1TimeMs: integer('p1_time_ms'),
  p1Points: integer('p1_points').default(0),

  p2AnswerIndex: smallint('p2_answer_index'),
  p2IsCorrect: boolean('p2_is_correct'),
  p2TimeMs: integer('p2_time_ms'),
  p2Points: integer('p2_points').default(0),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('idx_rounds_match').on(t.matchId, t.roundNumber),
]);

// ── User Category Stats ──

export const userCategoryStats = pgTable('user_category_stats', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),

  matchesPlayed: integer('matches_played').default(0),
  matchesWon: integer('matches_won').default(0),
  xp: integer('xp').default(0),
  badge: badgeTierEnum('badge').default('bronze'),
  correctAnswers: integer('correct_answers').default(0),
  totalAnswers: integer('total_answers').default(0),

  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  unique().on(t.userId, t.categoryId),
  index('idx_user_cat_stats_user').on(t.userId),
  index('idx_user_cat_stats_xp').on(t.categoryId, t.xp),
]);

// ── Friendships ──

export const friendships = pgTable('friendships', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  friendId: uuid('friend_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accepted: boolean('accepted').default(false),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  unique().on(t.userId, t.friendId),
  index('idx_friendships_user').on(t.userId, t.accepted),
  index('idx_friendships_friend').on(t.friendId, t.accepted),
]);

// ── Reports ──

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reporterId: uuid('reporter_id').notNull().references(() => users.id),
  reportType: reportTypeEnum('report_type').notNull(),
  status: reportStatusEnum('status').default('pending'),

  questionId: uuid('question_id').references(() => questions.id),
  reportedUserId: uuid('reported_user_id').references(() => users.id),

  description: text('description'),
  adminNote: text('admin_note'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('idx_reports_status').on(t.status, t.createdAt),
]);

// ── User Seen Questions ──

export const userSeenQuestions = pgTable('user_seen_questions', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  seenAt: timestamp('seen_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.questionId] }),
]);

// ── Admin Sessions ──

export const adminSessions = pgTable('admin_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 500 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('idx_admin_sessions_token').on(t.token),
]);
