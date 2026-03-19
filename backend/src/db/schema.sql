-- ══════════════════════════════════════════════
-- Ilmoo — Schéma PostgreSQL complet
-- ══════════════════════════════════════════════

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Types énumérés ──
CREATE TYPE difficulty AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE match_status AS ENUM ('waiting', 'in_progress', 'completed', 'cancelled');
CREATE TYPE match_type AS ENUM ('ranked', 'friendly', 'solo', 'tournament');
CREATE TYPE report_type AS ENUM ('wrong_answer', 'duplicate', 'inappropriate', 'other');
CREATE TYPE report_status AS ENUM ('pending', 'resolved', 'rejected');
CREATE TYPE badge_tier AS ENUM ('bronze', 'silver', 'gold', 'expert', 'grand_master');
CREATE TYPE tournament_status AS ENUM ('draft', 'active', 'completed', 'cancelled');
CREATE TYPE user_role AS ENUM ('player', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'banned');
CREATE TYPE subscription_status AS ENUM ('free', 'premium', 'expired');

-- ══════════════════════════════════════════════
-- FONCTION : mise à jour automatique de updated_at
-- (déclarée en premier car les triggers ci-dessous en dépendent)
-- ══════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════
-- APP FLAVORS (configuration par app gérée depuis l'admin)
-- ══════════════════════════════════════════════

CREATE TABLE app_flavors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug            VARCHAR(50) UNIQUE NOT NULL,   -- 'quizdeen' ou 'quizapp'
    app_name        VARCHAR(100) NOT NULL,
    app_description TEXT,
    support_email   VARCHAR(255),

    -- Thème (couleurs hex)
    primary_color   VARCHAR(7) NOT NULL,           -- #1B4332
    primary_dark    VARCHAR(7) NOT NULL,           -- #081C15
    accent_positive VARCHAR(7) NOT NULL,           -- #52B788
    accent_negative VARCHAR(7) NOT NULL,           -- #F4845F

    -- Catégories : liste des category IDs activées pour ce flavor
    -- Si vide/null = toutes les catégories actives sont affichées
    enabled_category_ids UUID[],

    -- Feature flags
    ads_enabled     BOOLEAN DEFAULT true,          -- afficher les pubs
    premium_enabled BOOLEAN DEFAULT true,          -- activer l'abonnement
    tournaments_enabled BOOLEAN DEFAULT true,
    friends_enabled BOOLEAN DEFAULT true,

    -- Maintenance
    is_active       BOOLEAN DEFAULT true,          -- false = app en maintenance
    maintenance_message TEXT,                       -- message affiché si maintenance
    min_app_version VARCHAR(20),                   -- force update si version < à ça

    -- Store
    app_store_url   VARCHAR(500),
    play_store_url  VARCHAR(500),

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_app_flavors_updated_at
    BEFORE UPDATE ON app_flavors FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed des deux flavors
INSERT INTO app_flavors (slug, app_name, app_description, support_email, primary_color, primary_dark, accent_positive, accent_negative) VALUES
    ('ilmoo', 'Ilmoo', 'Quiz culture générale multijoueur', 'support@ilmoo.com', '#1B4332', '#081C15', '#52B788', '#F4845F'),
    ('quizapp', 'QuizBattle', 'Quiz culture générale multijoueur', 'support@quizbattle.com', '#1A365D', '#0A1628', '#4299E1', '#FC8181');

-- ══════════════════════════════════════════════
-- UTILISATEURS
-- ══════════════════════════════════════════════

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firebase_uid    VARCHAR(128) UNIQUE NOT NULL,
    username        VARCHAR(30) UNIQUE,            -- NULL si anonyme (pas encore choisi)
    email           VARCHAR(255) UNIQUE,           -- NULL si anonyme
    role            user_role DEFAULT 'player',
    status          user_status DEFAULT 'active',
    subscription    subscription_status DEFAULT 'free',
    is_anonymous    BOOLEAN DEFAULT true,          -- true = compte guest, false = lié Google/email
    app_flavor      VARCHAR(50),                   -- 'quizdeen' ou 'quizapp' (premier lancement)

    -- Stats globales (dénormalisées pour perf)
    total_matches   INTEGER DEFAULT 0,
    total_wins      INTEGER DEFAULT 0,
    total_xp        INTEGER DEFAULT 0,
    level           INTEGER DEFAULT 1,
    win_streak      INTEGER DEFAULT 0,
    best_streak     INTEGER DEFAULT 0,
    daily_matches   INTEGER DEFAULT 0,
    last_match_date DATE,

    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ
);

CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_total_xp ON users(total_xp DESC);
CREATE INDEX idx_users_status ON users(status);

-- ══════════════════════════════════════════════
-- CATÉGORIES
-- ══════════════════════════════════════════════

CREATE TABLE categories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) UNIQUE NOT NULL,
    parent_id       UUID REFERENCES categories(id) ON DELETE CASCADE,  -- NULL = racine, rempli = sous-catégorie
    description     TEXT,
    icon_name       VARCHAR(50) NOT NULL,        -- nom de l'icône statique Flutter
    color           VARCHAR(7) NOT NULL,          -- hex color (#1B4332)
    sort_order      INTEGER DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    is_premium      BOOLEAN DEFAULT false,        -- catégorie réservée aux abonnés
    is_thematic     BOOLEAN DEFAULT false,        -- true = catégorie spécifique au flavor principal

    -- Stats (dénormalisées)
    question_count  INTEGER DEFAULT 0,
    match_count     INTEGER DEFAULT 0,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_active ON categories(is_active, sort_order);

-- ══════════════════════════════════════════════
-- QUESTIONS
-- ══════════════════════════════════════════════

CREATE TABLE questions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id     UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    question_text   TEXT NOT NULL,
    answers         JSONB NOT NULL,               -- ["réponse A", "réponse B", "réponse C", "réponse D"]
    correct_index   SMALLINT NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
    difficulty      difficulty DEFAULT 'medium',
    explanation     TEXT,                          -- explication affichée après la réponse

    -- Stats (dénormalisées)
    times_played    INTEGER DEFAULT 0,
    times_correct   INTEGER DEFAULT 0,

    -- Modération
    is_active       BOOLEAN DEFAULT true,
    is_verified     BOOLEAN DEFAULT false,        -- vérifié par l'admin
    submitted_by    UUID REFERENCES users(id),    -- si question soumise par un user

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_questions_category ON questions(category_id, is_active);
CREATE INDEX idx_questions_difficulty ON questions(category_id, difficulty);
CREATE INDEX idx_questions_active ON questions(is_active, is_verified);

-- ══════════════════════════════════════════════
-- MATCHS
-- ══════════════════════════════════════════════

CREATE TABLE matches (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id     UUID NOT NULL REFERENCES categories(id),
    match_type      match_type DEFAULT 'ranked',
    status          match_status DEFAULT 'waiting',
    tournament_id   UUID REFERENCES tournaments(id),

    -- Joueurs
    player1_id      UUID NOT NULL REFERENCES users(id),
    player2_id      UUID REFERENCES users(id),    -- NULL si solo ou en attente
    player1_score   INTEGER DEFAULT 0,
    player2_score   INTEGER DEFAULT 0,
    winner_id       UUID REFERENCES users(id),    -- NULL si nul ou pas fini

    -- Timing
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    total_rounds    SMALLINT DEFAULT 7,

    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_matches_player1 ON matches(player1_id, created_at DESC);
CREATE INDEX idx_matches_player2 ON matches(player2_id, created_at DESC);
CREATE INDEX idx_matches_category ON matches(category_id, created_at DESC);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_tournament ON matches(tournament_id) WHERE tournament_id IS NOT NULL;

-- ══════════════════════════════════════════════
-- ROUNDS (détail de chaque question dans un match)
-- ══════════════════════════════════════════════

CREATE TABLE match_rounds (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id        UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    question_id     UUID NOT NULL REFERENCES questions(id),
    round_number    SMALLINT NOT NULL,            -- 1 à 7
    is_bonus        BOOLEAN DEFAULT false,        -- round 7 = bonus

    -- Réponses joueur 1
    p1_answer_index SMALLINT,                     -- NULL si pas répondu (timeout)
    p1_is_correct   BOOLEAN,
    p1_time_ms      INTEGER,                      -- temps de réponse en ms
    p1_points       INTEGER DEFAULT 0,

    -- Réponses joueur 2
    p2_answer_index SMALLINT,
    p2_is_correct   BOOLEAN,
    p2_time_ms      INTEGER,
    p2_points       INTEGER DEFAULT 0,

    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rounds_match ON match_rounds(match_id, round_number);

-- ══════════════════════════════════════════════
-- BADGES / PROGRESSION PAR CATÉGORIE
-- ══════════════════════════════════════════════

CREATE TABLE user_category_stats (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id     UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,

    matches_played  INTEGER DEFAULT 0,
    matches_won     INTEGER DEFAULT 0,
    xp              INTEGER DEFAULT 0,
    badge           badge_tier DEFAULT 'bronze',
    correct_answers INTEGER DEFAULT 0,
    total_answers   INTEGER DEFAULT 0,

    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, category_id)
);

CREATE INDEX idx_user_cat_stats_user ON user_category_stats(user_id);
CREATE INDEX idx_user_cat_stats_xp ON user_category_stats(category_id, xp DESC);

-- ══════════════════════════════════════════════
-- AMIS
-- ══════════════════════════════════════════════

CREATE TABLE friendships (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    accepted        BOOLEAN DEFAULT false,

    created_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, friend_id),
    CHECK (user_id != friend_id)
);

CREATE INDEX idx_friendships_user ON friendships(user_id, accepted);
CREATE INDEX idx_friendships_friend ON friendships(friend_id, accepted);

-- ══════════════════════════════════════════════
-- SIGNALEMENTS
-- ══════════════════════════════════════════════

CREATE TABLE reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id     UUID NOT NULL REFERENCES users(id),
    report_type     report_type NOT NULL,
    status          report_status DEFAULT 'pending',

    -- Cible du signalement (un seul rempli)
    question_id     UUID REFERENCES questions(id),
    reported_user_id UUID REFERENCES users(id),

    description     TEXT,
    admin_note      TEXT,                         -- note de l'admin quand il traite
    resolved_at     TIMESTAMPTZ,

    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_status ON reports(status, created_at DESC);
CREATE INDEX idx_reports_question ON reports(question_id) WHERE question_id IS NOT NULL;

-- ══════════════════════════════════════════════
-- TOURNOIS
-- ══════════════════════════════════════════════

CREATE TABLE tournaments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    status          tournament_status DEFAULT 'draft',

    -- Config
    category_ids    UUID[] NOT NULL,              -- catégories autorisées
    max_players     INTEGER,
    rounds_per_match SMALLINT DEFAULT 7,

    -- Timing
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ NOT NULL,

    -- Sponsor (optionnel)
    sponsor_name    VARCHAR(200),
    sponsor_url     VARCHAR(500),

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tournaments_status ON tournaments(status, starts_at);

CREATE TABLE tournament_participants (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id   UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score           INTEGER DEFAULT 0,
    matches_played  INTEGER DEFAULT 0,
    matches_won     INTEGER DEFAULT 0,
    joined_at       TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tournament_id, user_id)
);

CREATE INDEX idx_tournament_participants_score ON tournament_participants(tournament_id, score DESC);

-- ══════════════════════════════════════════════
-- QUESTIONS JOUÉES (évite les doublons pour un joueur)
-- ══════════════════════════════════════════════

CREATE TABLE user_seen_questions (
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id     UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    seen_at         TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (user_id, question_id)
);

-- ══════════════════════════════════════════════
-- ADMIN : table simple pour le login backoffice
-- ══════════════════════════════════════════════

CREATE TABLE admin_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token           VARCHAR(500) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_sessions_token ON admin_sessions(token);

-- ══════════════════════════════════════════════
-- TRIGGERS updated_at
-- ══════════════════════════════════════════════

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_questions_updated_at
    BEFORE UPDATE ON questions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tournaments_updated_at
    BEFORE UPDATE ON tournaments FOR EACH ROW EXECUTE FUNCTION update_updated_at();