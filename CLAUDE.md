# Ilmoo — Projet Quiz Mobile Multijoueur

## Vision
Application mobile de quiz en temps réel inspirée de QuizUp de culture générale
(Sciences, Géographie, Histoire, Sport, Cinéma, etc.) avec un système de catégories
et sous-catégories. Deux flavors avec des catégories configurables depuis le backoffice :
- **Ilmoo** : version complète avec toutes les catégories activées
- **QuizBattle** (nom temporaire, modifiable depuis l'admin) : version avec une sélection de catégories différente

## Stack technique validé
- **Mobile** : Flutter (iOS + Android, une seule codebase, 2 flavors)
- **Backend** : Node.js + Fastify + Socket.io (temps réel)
- **Base de données** : PostgreSQL (données persistantes) + Redis (cache, matchmaking, leaderboards)
- **Auth** : Firebase Auth (Google, Apple, email, anonyme) — gratuit
- **Push** : Firebase Cloud Messaging (FCM)
- **Monitoring** : Sentry uniquement
- **Infra** : VPS Hostinger avec Coolify (Docker Compose)
- **Backoffice admin** : Vue 3 + Vite + Tailwind + shadcn-vue
- **Pas de CDN/stockage cloud** : icônes statiques embarquées dans le bundle Flutter

## Architecture des conteneurs Docker
- `api` (port 3000) : Fastify + Socket.io — API REST + WebSocket
- `admin` (port 3001) : Vue app servie par Nginx
- `postgres` : PostgreSQL 16 Alpine
- `redis` : Redis 7 Alpine (maxmemory 256mb, politique allkeys-lru)
- Réseau interne : `ilmoo-network` (bridge)
- Coolify gère le reverse proxy + SSL

## Structure du projet
```
ilmoo/
├── backend/           # API Fastify + Socket.io
│   ├── src/
│   │   ├── server.ts          # Point d'entrée
│   │   ├── routes/            # Routes Fastify
│   │   │   ├── auth.ts        # Login, register, verify token
│   │   │   ├── questions.ts   # CRUD questions
│   │   │   ├── categories.ts  # CRUD catégories
│   │   │   ├── matches.ts     # Historique matchs
│   │   │   ├── users.ts       # Profils, stats, classements
│   │   │   ├── admin.ts       # Routes admin protégées
│   │   │   └── tournaments.ts # Gestion tournois
│   │   ├── socket/            # Logique Socket.io
│   │   │   ├── matchmaking.ts # File d'attente Redis + pairing
│   │   │   ├── game-room.ts   # Logique de match en cours
│   │   │   └── events.ts      # Définition des événements WS
│   │   ├── middleware/
│   │   │   ├── auth.ts        # Vérification Firebase token
│   │   │   ├── admin.ts       # Middleware admin only
│   │   │   └── requireLinked.ts # Bloque les comptes anonymes sur les routes sensibles
│   │   ├── db/
│   │   │   ├── schema.sql     # Schéma PostgreSQL complet
│   │   │   ├── seed.sql       # Données initiales (catégories, questions de test)
│   │   │   └── queries.ts     # Requêtes SQL préparées
│   │   ├── services/
│   │   │   ├── redis.ts       # Connexion + helpers Redis (clés par flavor)
│   │   │   ├── firebase.ts    # Firebase Admin SDK
│   │   │   ├── scoring.ts     # Calcul des scores, XP, niveaux, badges (séparé pour testabilité)
│   │   │   └── subscription.ts # Limite quotidienne, vérif premium
│   │   └── types/             # Types TypeScript partagés
│   ├── Dockerfile
│   └── package.json
├── admin/             # Backoffice Vue 3 + Vite + shadcn-vue
│   ├── nginx.conf             # Config Nginx (proxy /api/ → backend, SPA fallback)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.vue
│   │   │   ├── Applications.vue       # Gestion des flavors (nom, couleurs, catégories, flags)
│   │   │   ├── Questions.vue          # Liste + formulaire CRUD
│   │   │   ├── Categories.vue
│   │   │   ├── Users.vue
│   │   │   ├── Matches.vue
│   │   │   ├── Reports.vue            # Signalements
│   │   │   ├── Tournaments.vue
│   │   │   └── Settings.vue
│   │   ├── components/
│   │   ├── composables/           # Logique réutilisable Vue (useAuth, useApi, etc.)
│   │   ├── router/index.ts        # Vue Router config
│   │   └── lib/api.ts             # Client API vers Fastify (fetch natif)
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── mobile/                ← App Flutter (2 flavors)
│   ├── lib/
│   │   ├── config/
│   │   │   ├── app_config.dart          # Modèle AppConfig + factory fromApi
│   │   │   ├── ilmoo_defaults.dart      # Fallback flavor Ilmoo
│   │   │   └── quizapp_defaults.dart    # Fallback flavor QuizBattle
│   │   ├── main_ilmoo.dart             # Entry point flavor Ilmoo
│   │   ├── main_quizapp.dart           # Entry point flavor QuizBattle
│   │   ├── app.dart                    # Widget racine partagé (reçoit AppConfig)
│   │   ├── screens/
│   │   │   ├── splash_screen.dart
│   │   │   ├── login_screen.dart
│   │   │   ├── home_screen.dart
│   │   │   ├── category_screen.dart
│   │   │   ├── match_screen.dart      # Écran de jeu principal
│   │   │   ├── result_screen.dart
│   │   │   ├── profile_screen.dart
│   │   │   ├── leaderboard_screen.dart
│   │   │   └── shop_screen.dart
│   │   ├── services/
│   │   │   ├── api_service.dart       # Client HTTP (utilise config.apiBaseUrl + header X-App-Flavor)
│   │   │   ├── socket_service.dart    # Client Socket.io
│   │   │   ├── auth_service.dart      # Firebase Auth (anonyme + liaison)
│   │   │   └── notification_service.dart
│   │   ├── models/
│   │   ├── widgets/
│   │   └── theme/
│   │       └── app_theme.dart         # Thème dynamique basé sur AppConfig
│   └── pubspec.yaml
├── docker-compose.yml
├── .env.example
└── CLAUDE.md          # CE FICHIER
```
```

## Multi-app (Flutter Flavors)
Le projet produit deux apps à partir du même code.
La configuration de chaque app est gérée DEPUIS LE BACKOFFICE ADMIN (table app_flavors en base).
L'app Flutter charge sa config au lancement via l'API. Les valeurs Dart sont des fallbacks.

### Table app_flavors (en base PostgreSQL)
Chaque flavor a une ligne dans la table app_flavors avec :
- slug, app_name, app_description, support_email
- Couleurs : primary_color, primary_dark, accent_positive, accent_negative
- enabled_category_ids : array d'UUIDs des catégories racines activées pour ce flavor (null = toutes)
- Feature flags : ads_enabled, premium_enabled, tournaments_enabled, friends_enabled
- Maintenance : is_active, maintenance_message, min_app_version
- Store URLs : app_store_url, play_store_url

### Route API config
```
GET /api/config/:flavorSlug
```
Retourne toute la config du flavor. Appelée au lancement de l'app.
Pas besoin d'auth (c'est public). Cachée en Redis (TTL 5 min) pour la perf.
Réponse :
```json
{
  "success": true,
  "data": {
    "appName": "Ilmoo",
    "primaryColor": "#1B4332",
    "primaryDark": "#081C15",
    "accentPositive": "#52B788",
    "accentNegative": "#F4845F",
    "enabledCategoryIds": null,
    "adsEnabled": true,
    "premiumEnabled": true,
    "tournamentsEnabled": true,
    "friendsEnabled": true,
    "isActive": true,
    "maintenanceMessage": null,
    "minAppVersion": "1.0.0",
    "appStoreUrl": "...",
    "playStoreUrl": "..."
  }
}
```

### Backoffice admin — page Applications
La page admin/src/pages/Applications.vue permet de :
- Voir les deux apps côte à côte en cards
- Cliquer sur une app pour éditer : nom, description, email support
- Modifier les couleurs avec des color pickers
- Activer/désactiver des catégories par app (checkboxes)
- Toggler les feature flags (pubs, premium, tournois, amis)
- Mettre une app en maintenance avec un message custom
- Définir la version minimum (force update)
- Modifier les URLs des stores

### Configuration centralisée : mobile/lib/config/
Les fichiers Dart contiennent les valeurs FALLBACK uniquement (utilisées si l'API ne répond pas
au lancement, par ex. premier lancement hors ligne). La vraie config vient de l'API.

```dart
// mobile/lib/config/app_config.dart — modèle de données
class AppConfig {
  final String appName;
  final String appId;
  final String flavorSlug;
  final String apiBaseUrl;

  // Thème (modifiables depuis l'admin)
  final Color primaryColor;
  final Color primaryDark;
  final Color accentPositive;
  final Color accentNegative;

  // Catégories
  final List<String>? enabledCategoryIds;  // null = toutes, sinon liste d'UUIDs

  // Feature flags (modifiables depuis l'admin)
  final bool adsEnabled;
  final bool premiumEnabled;
  final bool tournamentsEnabled;
  final bool friendsEnabled;

  // Gameplay (modifiables depuis l'admin)
  final int freeDailyMatches;
  final int roundCount;
  final int timerSeconds;
  final bool bonusRoundEnabled;
  final int matchmakingTimeoutSeconds;

  // Scoring (modifiables depuis l'admin)
  final int pointsPerRound;
  final int pointsBonusRound;
  final double speedWeight;
  final double baseWeight;
  final int minCorrectPoints;

  // Progression (modifiables depuis l'admin)
  final int xpBaseMatch;
  final int xpWinBonus;
  final int xpPerfectBonus;
  final int xpStreakMultiplier;
  final int levelFormulaDivisor;
  final Map<String, int> badgeThresholds;

  // Textes (modifiables depuis l'admin)
  final Map<String, String> texts;

  // Maintenance
  final bool isActive;
  final String? maintenanceMessage;
  final String? minAppVersion;

  // Store
  final String? appStoreUrl;
  final String? playStoreUrl;

  // Infos
  final String appDescription;
  final String supportEmail;

  AppConfig({required this.appName, ...});

  // Parse depuis la réponse API, fallback sur les valeurs par défaut
  factory AppConfig.fromApi(Map<String, dynamic> json, AppConfig fallback) { ... }

  // Accès aux textes avec fallback
  String text(String key) => texts[key] ?? key;
}
```

```dart
// mobile/lib/config/quizdeen_defaults.dart — FALLBACK uniquement
class IlmooDefaults {
  static AppConfig get config => AppConfig(
    appName: 'Ilmoo',
    appId: 'com.ilmoo.app',
    flavorSlug: 'ilmoo',
    apiBaseUrl: 'https://api.ilmoo.com',
    primaryColor: Color(0xFF1B4332),
    primaryDark: Color(0xFF081C15),
    accentPositive: Color(0xFF52B788),
    accentNegative: Color(0xFFF4845F),
    enabledCategoryIds: null,  // toutes les catégories (configuré depuis l'admin)
    adsEnabled: true,
    premiumEnabled: true,
    tournamentsEnabled: true,
    friendsEnabled: true,
    isActive: true,
    appDescription: 'Quiz culture générale multijoueur',
    supportEmail: 'support@ilmoo.com',
  );
}
```

```dart
// mobile/lib/config/quizapp_defaults.dart — FALLBACK uniquement
class QuizBattleDefaults {
  static AppConfig get config => AppConfig(
    appName: 'QuizBattle',
    appId: 'com.quizbattle.app',
    flavorSlug: 'quizapp',
    apiBaseUrl: 'https://api.quizbattle.com',
    primaryColor: Color(0xFF1A365D),
    primaryDark: Color(0xFF0A1628),
    accentPositive: Color(0xFF4299E1),
    accentNegative: Color(0xFFFC8181),
    enabledCategoryIds: null,  // configuré depuis l'admin
    adsEnabled: true,
    premiumEnabled: true,
    tournamentsEnabled: true,
    friendsEnabled: true,
    isActive: true,
    appDescription: 'Quiz culture générale multijoueur',
    supportEmail: 'support@quizbattle.com',
  );
}
```

### Flux au lancement de l'app
1. L'app démarre avec le fallback config (instantané, pas d'attente)
2. En parallèle, appel GET /api/config/{flavorSlug}
3. Si succès : merge la config API avec le fallback, met à jour le Provider
4. Si échec (offline, timeout) : continue avec le fallback
5. Si isActive = false : affiche l'écran de maintenance avec le message

### Points d'entrée par flavor
```dart
// mobile/lib/main_ilmoo.dart
void main() {
  runApp(QuizApp(defaults: IlmooDefaults.config));
}

// mobile/lib/main_quizapp.dart
void main() {
  runApp(QuizApp(defaults: QuizBattleDefaults.config));
}
```

### Structure des fichiers flavor
```
mobile/
├── lib/
│   ├── config/
│   │   ├── app_config.dart            # Modèle AppConfig + factory fromApi
│   │   ├── ilmoo_defaults.dart        # Fallback flavor Ilmoo
│   │   └── quizapp_defaults.dart      # Fallback flavor QuizBattle
│   ├── main_ilmoo.dart                # Entry point flavor Ilmoo
│   ├── main_quizapp.dart              # Entry point flavor QuizBattle
│   └── ...                            # tout le reste est partagé
├── android/app/src/
│   ├── main/                          # code Android partagé
│   ├── ilmoo/
│   │   └── res/                     # icône + nom pour Ilmoo
│   │       ├── mipmap-*/ic_launcher.png
│   │       └── values/strings.xml     # <string name="app_name">Ilmoo</string>
│   └── quizapp/
│       └── res/                       # icône + nom pour QuizBattle
│           ├── mipmap-*/ic_launcher.png
│           └── values/strings.xml     # <string name="app_name">QuizBattle</string>
├── ios/
│   ├── Runner/
│   ├── config/
│   │   ├── ilmoo/
│   │   │   └── GoogleService-Info.plist
│   │   └── quizapp/
│   │       └── GoogleService-Info.plist
│   └── Flutter/
│       ├── ilmoo.xcconfig
│       └── quizapp.xcconfig
└── pubspec.yaml
```

### Build commands
```bash
# Ilmoo (islam + culture G)
flutter run --flavor ilmoo -t lib/main_ilmoo.dart
flutter build appbundle --flavor ilmoo -t lib/main_ilmoo.dart

# QuizBattle (culture G seule)
flutter run --flavor quizapp -t lib/main_quizapp.dart
flutter build appbundle --flavor quizapp -t lib/main_quizapp.dart
```

### Côté backend : rien à dupliquer
Les deux apps utilisent la même API, la même base de données.
L'app envoie un header `X-App-Flavor` avec config.flavorSlug à chaque requête.
Le filtrage des catégories se fait côté client (enabledCategoryIds dans la config API).
Le backend peut lire le header pour des analytics séparées par flavor.

## Design de l'app mobile
### Flavor Ilmoo (toutes catégories)
- Palette principale : vert foncé (#1B4332 → #081C15) en dégradé pour le fond
- Accent positif : vert clair (#52B788, #95D5B2, #D8F3DC)
- Accent négatif : corail (#F4845F)

### Flavor QuizBattle (culture G seule)
- Palette principale : bleu foncé (#1A365D → #0A1628) en dégradé pour le fond
- Accent positif : bleu clair (#4299E1, #90CDF4, #BEE3F8)
- Accent négatif : rouge clair (#FC8181)

### Partagé entre les deux flavors
- **Style** : moderne, arrondi (border-radius 12-16px), cartes semi-transparentes (rgba blanc 6%)
- **Barre de nav** : 4 onglets (Accueil, Match, Classement, Profil)
- **Écran de match** : 2 avatars face à face, score temps réel, barre de timer, 4 choix de réponse, 7 rounds par match, indicateur de round (dots), animation vert/rouge sur les réponses

## Mécanique de jeu
- **Match** : 7 questions, 10 secondes par question, max 20 points par question (basé sur vitesse), round bonus = 40 points max
- **Matchmaking** : file Redis par catégorie, timeout 15s → proposition bot ou mode solo
- **Scoring** : réponse correcte + rapidité = plus de points. Mauvaise réponse = 0 points.
- **Progression** : XP par match → niveaux. Badges par catégorie (Bronze, Argent, Or, Expert, Grand Maître)
- **Classements** : global, par catégorie, hebdomadaire (reset chaque lundi), entre amis

## Backoffice admin (Vue 3 + shadcn-vue)
- Sidebar navigation : Dashboard, Applications, Questions, Catégories, Utilisateurs, Matchs, Signalements, Tournois, Pubs/Abo, Paramètres
- Dashboard : métriques (joueurs actifs, matchs aujourd'hui, questions totales, signalements), filtre par app (dropdown Ilmoo / QuizBattle / Toutes), table questions récentes, top catégories, signalements récents
- Applications : liste les deux flavors en cards. Cliquer ouvre un formulaire d'édition avec : nom, description, email support, couleurs (4 color pickers), catégories activées (checkboxes avec toutes les catégories), feature flags (toggles : pubs, premium, tournois, amis), gameplay (matchs/jour, rounds, timer, scoring, XP, badges), textes personnalisables, mode maintenance (toggle + message), version minimum, URLs stores
- Gestion questions : CRUD complet, import JSON en masse, stats par question (fois jouée, taux de réussite), filtres par catégorie/sous-catégorie/difficulté
- Gestion catégories : arbre parent/enfant, créer des racines et sous-catégories, réordonner, activer/désactiver, marquer premium
- Gestion users : liste avec filtres, actions (bannir, suspendre), vue détail stats joueur
- Signalements : file de traitement (question incorrecte, doublon, pseudo inapproprié)
- Tournois : création d'événements spéciaux avec règles custom

## Business model
1. **Freemium + abo** (50-60%) : 5 matchs/jour gratuit, abo "Pro" 3.99€/mois pour illimité + sans pub + stats
2. **Publicité** (20-25%) : AdMob interstitiels entre matchs + rewarded ads
3. **Cosmétiques** (10-15%) : cadres de profil, thèmes, effets victoire (pas d'avatar image)
4. **B2B éducation** (10-15%) : abos pour organisations éducatives avec dashboard enseignant
5. **Tournois sponsorisés** : événements saisonniers sponsorisés

## Système de catégories / sous-catégories
- Une catégorie peut avoir un parent_id (NULL = racine, rempli = sous-catégorie)
- Max 2 niveaux : catégorie racine → sous-catégories (pas de sous-sous-catégorie)
- Les questions sont liées à une catégorie (racine ou sous-catégorie)
- Si une question est liée à une sous-catégorie, elle appartient aussi à la catégorie parente
  (un match "Sciences" peut piocher dans Physique, Biologie, Astronomie)
- Si le joueur choisit une sous-catégorie, seules les questions de cette sous-catégorie sont piochées
- Le filtrage par flavor se fait via enabled_category_ids dans la table app_flavors :
  chaque flavor a sa propre liste de catégories racines activées, configurée depuis l'admin
  Si enabled_category_ids est null = toutes les catégories sont affichées
- Le backoffice admin permet de créer/éditer/supprimer des catégories et sous-catégories librement
- Nouvelles catégories et sous-catégories sont ajoutées exclusivement depuis le backoffice admin

## Catégories initiales (seed)
Le seed SQL contient des catégories de base : Culture générale, Géographie, Sciences (avec sous-catégories Physique, Biologie, Astronomie), Sport, Histoire.
Toutes les autres catégories sont créées depuis le backoffice admin.
Chaque catégorie/sous-catégorie avec 200+ questions minimum.

## Variables d'environnement (.env)
```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://ilmoo:motdepasse@localhost:5432/ilmoo
REDIS_URL=redis://localhost:6379
FIREBASE_PROJECT_ID=ilmoo-xxxxx
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@ilmoo-xxxxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
JWT_SECRET=une-cle-secrete-longue-et-aleatoire
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
ADMIN_EMAIL=admin@ilmoo.com
ADMIN_PASSWORD=un-mot-de-passe-fort
```

## Mécanique de scoring (valeurs par défaut, modifiables depuis l'admin)
- Match = config.roundCount rounds (défaut: 7), dernier round = bonus si config.bonusRoundEnabled
- Timer = config.timerSeconds secondes par question (défaut: 10)
- Points par round normal : si correct, score = round(config.pointsPerRound * (1 - timeMs/(config.timerSeconds*1000)) * config.speedWeight + config.pointsPerRound * config.baseWeight). Minimum config.minCorrectPoints si correct. 0 si faux ou timeout.
- Points round bonus : même formule mais avec config.pointsBonusRound au lieu de pointsPerRound
- XP gagné par match : config.xpBaseMatch + config.xpWinBonus (si victoire) + config.xpPerfectBonus (si toutes correctes) + streak * config.xpStreakMultiplier
- Seuils de niveau : level = floor(sqrt(totalXP / config.levelFormulaDivisor)) + 1
- Seuils de badges par catégorie : config.badgeThresholds (bronze/silver/gold/expert/grand_master)
- Limite quotidienne : config.freeDailyMatches matchs/jour pour les comptes gratuits (défaut: 5)
- Matchmaking timeout : config.matchmakingTimeoutSeconds (défaut: 15)

IMPORTANT : le backend ET le client Flutter lisent ces valeurs depuis la config API.
Jamais de valeurs en dur dans le code. Le backend utilise la config pour calculer les scores,
le client Flutter l'utilise pour le timer, le nombre de rounds, et les textes affichés.

## Authentification
- Mode "guest-first" : PAS de login obligatoire au lancement
- Au premier lancement : Firebase signInAnonymously() crée un compte anonyme
- L'utilisateur joue immédiatement, ses données sont liées à l'UID anonyme
- Quand il veut : il lie son compte à Google ou email (Firebase linkWithCredential)
- Aucune donnée perdue lors de la liaison (même UID, même row en base)

### Ce qui nécessite un compte lié (Google/email) :
- Apparaître dans les classements publics
- Ajouter des amis et défier quelqu'un
- Choisir un pseudo personnalisé
- Acheter un abonnement premium
- Récupérer son compte sur un autre appareil

### Ce qui fonctionne en mode anonyme :
- Jouer en solo et en multijoueur
- Accumuler des points, XP, badges, niveaux
- Voir les classements (mais pas y apparaître)
- Historique des matchs

### Incitation à créer un compte
- Après 3 matchs : notification douce "Crée un compte pour sauvegarder ta progression"
- Quand il essaie d'accéder aux amis ou classements : prompt de connexion
- Sur le classement : l'anonyme VOIT le classement mais n'y apparaît pas.
  En bas de la liste : "Tu serais #42 — connecte-toi pour y apparaître" + bouton
- Jamais de popup bloquant ou forcé

## Sécurité
- Toutes les routes API (sauf /health et /api/config/:slug) nécessitent un token Firebase valide dans le header Authorization
- Le middleware auth.ts vérifie le token via Firebase Admin SDK (verifyIdToken) à chaque requête
- Le middleware requireLinked.ts bloque l'accès aux features sensibles pour les comptes anonymes : amis, modifier pseudo, achats premium, inscription tournois
- Le middleware admin.ts vérifie role === 'admin' pour toutes les routes /api/admin/*
- Toutes les requêtes SQL sont paramétrées (jamais de string interpolation) pour empêcher les injections SQL
- Les mots de passe admin sont hashés avec bcrypt en base (jamais stockés en clair)
- Rate limiting sur les routes sensibles : /api/auth/* (max 10 req/min), /api/admin/login (max 5 req/min)
- Les WebSocket vérifient aussi le token Firebase à la connexion (pas uniquement les routes HTTP)
- Le header X-App-Flavor est lu mais jamais utilisé comme critère de sécurité (il peut être falsifié)
- CORS configuré : en prod, origin restreint aux domaines autorisés uniquement

## Matchmaking (Redis)
- Les deux apps ont des pools de joueurs SÉPARÉS (pas de cross-play)
- Queue key : `queue:{flavorSlug}:{categoryId}` (Redis List) — le flavor isole les joueurs
- Match session : `match:{matchId}` (Redis Hash avec questions, scores, état)
- Leaderboard global : `leaderboard:{flavorSlug}:global` (Redis Sorted Set, score = totalXP)
- Leaderboard par catégorie : `leaderboard:{flavorSlug}:cat:{categoryId}` (Sorted Set)
- Leaderboard hebdo : `leaderboard:{flavorSlug}:weekly` (Sorted Set, reset chaque lundi via cron)
- Config cache : `config:{flavorSlug}` (Redis String, TTL 5 min)
- Timeout matchmaking : config.matchmakingTimeoutSeconds (défaut: 15s)
- Anti-doublon : un joueur ne peut être que dans une seule queue à la fois

## Événements Socket.io
```
Client → Serveur :
  join_queue      { categoryId }
  leave_queue     {}
  answer          { roundNumber, answerIndex, timeMs }
  rejoin_match    { matchId }                    # demande à rejoindre un match en cours après reconnexion

Serveur → Client :
  queue_joined    { categoryId, position }
  match_found     { matchId, opponent: { id, username, level }, categoryId }
  round_start     { roundNumber, question: { id, text, answers[] }, isBonus, timeLimit }
  round_result    { roundNumber, correctIndex, p1: { answerIndex, correct, points, total }, p2: {...} }
  match_end       { winnerId, p1Score, p2Score, xpGained, newLevel?, newBadge? }
  opponent_disconnected  { timeout: 30 }         # l'adversaire s'est déco, timer de grâce lancé
  opponent_reconnected   {}                      # l'adversaire est revenu
  match_rejoin    { matchId, currentRound, scores, opponent, question?, timeRemaining? }  # état complet pour le joueur qui revient
  queue_timeout   {}
  error           { message, code }
```
Note : timeLimit dans round_start vient de config.timerSeconds * 1000.

## Gestion des reconnexions (Socket.io)
- Socket.io se reconnecte automatiquement côté client (backoff exponentiel, activé par défaut)
- À la reconnexion, le client s'authentifie à nouveau (token Firebase dans les headers)
- Le serveur identifie le joueur par son user ID (pas par son socket ID)
- Si le joueur a un match en cours en base (status = in_progress) :
  1. Le serveur le remet dans la room Socket.io du match
  2. Émet "match_rejoin" avec l'état complet : round actuel, scores, adversaire, question en cours, temps restant
  3. Émet "opponent_reconnected" à l'autre joueur
  4. Annule le timer de forfait
- Si le joueur était en queue de matchmaking :
  1. Le serveur le remet dans la queue
  2. Émet "queue_joined"

## Gestion des déconnexions pendant un match
- Quand un joueur se déconnecte (événement "disconnect") :
  1. Émet "opponent_disconnected" { timeout: 30 } à l'autre joueur
  2. Lance un timer de grâce (30 secondes)
  3. Pendant le round en cours : le joueur déco score 0 pour ce round
  4. Si le joueur revient avant la fin du timer → reprise normale
  5. Si le timer expire → forfait, l'autre joueur gagne, match sauvegardé en base
- Causes de déconnexion gérées :
  - Perte réseau temporaire (wifi → 4G)
  - App mise en arrière-plan (iOS/Android coupent le WebSocket)
  - Fermeture volontaire de l'app
  - Crash de l'app

## Routes API complètes
```
# Config (public, pas d'auth)
GET    /api/config/:flavorSlug     # Config complète d'un flavor (cachée Redis 5min)

# Auth
POST   /api/auth/register        # Créer un compte (appelé automatiquement au premier lancement, is_anonymous=true)
POST   /api/auth/login            # Vérifier token + retourner profil
POST   /api/auth/link             # Lier un compte anonyme à Google/email (is_anonymous → false, set username + email)
GET    /api/auth/me               # Retourne le profil courant (anonyme ou lié)

# Questions
GET    /api/questions             # Liste paginée (query: categoryId, difficulty, limit, offset)
GET    /api/questions/random      # N questions aléatoires (query: categoryId, count, userId)
GET    /api/questions/:id
POST   /api/questions             # Admin only
PUT    /api/questions/:id         # Admin only
DELETE /api/questions/:id         # Admin only (soft delete)
POST   /api/questions/import      # Admin only (batch JSON)

# Catégories
GET    /api/categories            # Liste les catégories racines (parent_id IS NULL) triées par sort_order
GET    /api/categories/:slug      # Détail d'une catégorie avec ses sous-catégories et stats
GET    /api/categories/:slug/subcategories  # Liste les sous-catégories d'une catégorie
POST   /api/categories            # Admin only (body inclut parent_id optionnel pour créer une sous-catégorie)
PUT    /api/categories/:id        # Admin only
DELETE /api/categories/:id        # Admin only (supprime aussi les sous-catégories)

# Users
GET    /api/users/me              # Mon profil + stats
PUT    /api/users/me              # Modifier username
PUT    /api/users/me/fcm-token    # Enregistrer token push
PUT    /api/users/me/subscription # Mettre à jour abo premium
GET    /api/users/me/stats        # Stats détaillées par catégorie
GET    /api/users/:id             # Profil public

# Leaderboard
GET    /api/leaderboard           # Query: categoryId?, period (weekly/alltime), limit

# Amis
GET    /api/friends               # Mes amis
POST   /api/friends/request       # Envoyer demande (body: username)
GET    /api/friends/requests      # Demandes en attente
PUT    /api/friends/:id/accept
DELETE /api/friends/:id
POST   /api/friends/:id/challenge # Créer match amical

# Matchs
GET    /api/matches/history       # Mon historique (query: limit, offset)
GET    /api/matches/:id           # Détail d'un match avec rounds

# Signalements
POST   /api/reports               # Signaler (body: reportType, questionId?, reportedUserId?, description)

# Tournois
GET    /api/tournaments           # Tournois actifs
GET    /api/tournaments/:id       # Détail + classement
POST   /api/tournaments/:id/join  # S'inscrire

# Admin
POST   /api/admin/login           # Login admin (email + password)
GET    /api/admin/stats           # Métriques dashboard (accepte ?flavor=slug pour filtrer)
GET    /api/admin/users           # Liste users avec filtres
PUT    /api/admin/users/:id/status # Changer status (ban, suspend, activate)
GET    /api/admin/reports         # Signalements pending
PUT    /api/admin/reports/:id     # Résoudre signalement
POST   /api/admin/tournaments     # Créer tournoi
PUT    /api/admin/tournaments/:id # Modifier tournoi
GET    /api/admin/flavors         # Liste des flavors
GET    /api/admin/flavors/:slug   # Détail d'un flavor
PUT    /api/admin/flavors/:slug   # Modifier un flavor (nom, couleurs, catégories, flags, maintenance)
```

## Limites freemium (configurables depuis l'admin)
- Free : config.freeDailyMatches matchs/jour (défaut: 5), pubs entre les matchs, stats basiques
- Premium (prix configurable) : matchs illimités, 0 pub, stats avancées, badge premium visible
- daily_matches se reset à minuit (cron ou check côté serveur)
- Les matchs amicaux (friendly) comptent dans la limite

## Fichiers à ne JAMAIS générer ni modifier
- .env (les secrets sont gérés manuellement et dans Coolify)
- google-services.json / GoogleService-Info.plist (Firebase config, ajoutés manuellement)
- node_modules/, .dart_tool/, build/, dist/ (générés par les outils)
- Le .gitignore est déjà configuré à la racine, ne pas le remplacer

## .gitignore (déjà en place à la racine)
```
# Dépendances
node_modules/
.dart_tool/
.packages

# Build
backend/dist/
admin/dist/
mobile/build/

# Environnement (IMPORTANT : ne jamais push les secrets)
.env
.env.local
.env.production

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Flutter
mobile/.flutter-plugins
mobile/.flutter-plugins-dependencies
mobile/ios/Pods/
mobile/ios/.symlinks/
mobile/android/.gradle/
mobile/android/local.properties
mobile/android/app/debug/
mobile/android/app/profile/
mobile/android/app/release/

# Firebase
**/google-services.json
**/GoogleService-Info.plist
**/firebase_app_id_file.json

# Sentry
*.dSYM.zip
*.dSYM

# Logs
*.log
npm-debug.log*
```

## Conventions de code
- TypeScript strict partout (backend + admin)
- Dart avec null safety (Flutter)
- ESLint + Prettier (backend + admin)
- Nommage : camelCase (TS), snake_case (SQL), camelCase (Dart)
- Commits conventionnels : feat:, fix:, chore:, docs:
- Package manager : yarn (pas npm). Toujours utiliser yarn add, yarn install, yarn dev, etc.
- Pas de console.log en production, utiliser le logger Fastify
- Toujours utiliser des requêtes SQL paramétrées (jamais de string interpolation)
- Toujours gérer les erreurs avec try/catch et retourner des codes HTTP appropriés
- Les réponses API suivent le format : { success: true, data: {...} } ou { success: false, error: "message" }

## Tests
### Backend (Vitest)
- Framework : Vitest (rapide, compatible TypeScript, même syntaxe que Jest)
- Tests unitaires : services (scoring, subscription, redis helpers, config parsing)
- Tests d'intégration : routes API (chaque route testée avec requêtes HTTP réelles contre une DB de test)
- Tests Socket.io : matchmaking, game room, déconnexions
- Base de test : PostgreSQL séparé (DB ilmoo_test), créée et vidée avant chaque suite
- Coverage minimum visé : 80% sur les services, 70% sur les routes
- Commandes :
  - `yarn test` : lance tous les tests
  - `yarn test:unit` : tests unitaires seulement
  - `yarn test:integration` : tests d'intégration seulement
  - `yarn test:coverage` : avec rapport de couverture

### Admin (Vitest + Vue Test Utils)
- Framework : Vitest + @vue/test-utils
- Tests unitaires : composables (useAuth, useApi), utilitaires, formatters
- Tests composants : pages principales (Dashboard, Questions, Applications) — vérifier le rendu, les interactions formulaire, les appels API mockés
- Commandes : `yarn test`, `yarn test:coverage`

### Mobile (Flutter test)
- Framework : flutter_test (inclus) + mocktail pour les mocks
- Tests unitaires : services (api_service, auth_service, socket_service), models (fromJson/toJson), config (AppConfig.fromApi, fallback)
- Tests widget : écrans principaux (match_screen, category_screen, profile_screen) — vérifier le rendu, les interactions, les états (anonyme vs lié)
- Commandes : `flutter test`, `flutter test --coverage`

### Structure des fichiers de test
```
backend/
├── src/
└── tests/
    ├── setup.ts                    # Config Vitest, connexion DB test, helpers
    ├── unit/
    │   ├── scoring.test.ts         # Calcul des points, XP, niveaux, badges
    │   ├── subscription.test.ts    # Limite quotidienne, vérif premium
    │   └── redis-helpers.test.ts   # Clés Redis, queue, leaderboard
    └── integration/
        ├── auth.test.ts            # Register, login, link, anonyme
        ├── questions.test.ts       # CRUD questions, random, import batch
        ├── categories.test.ts      # CRUD catégories, sous-catégories, arbre
        ├── matches.test.ts         # Historique, détail match
        ├── leaderboard.test.ts     # Classement par flavor, par catégorie, hebdo
        ├── admin.test.ts           # Stats, users, reports, flavors
        ├── config.test.ts          # GET /api/config/:slug, cache Redis
        └── socket/
            ├── matchmaking.test.ts # Join queue, find opponent, timeout, isolation flavor
            └── game-room.test.ts   # Rounds, scoring, déconnexion, fin de match

admin/
├── src/
└── tests/
    ├── unit/
    │   ├── useAuth.test.ts
    │   └── api.test.ts
    └── components/
        ├── Dashboard.test.ts
        ├── Questions.test.ts
        └── Applications.test.ts

mobile/
├── lib/
└── test/
    ├── unit/
    │   ├── app_config_test.dart    # fromApi, fallback, text()
    │   ├── scoring_test.dart       # Calcul points côté client
    │   └── api_service_test.dart   # Requêtes, headers, erreurs
    └── widget/
        ├── match_screen_test.dart  # Timer, réponses, animations
        ├── category_screen_test.dart # Filtrage par enabledCategoryIds, sous-catégories
        └── profile_screen_test.dart  # Anonyme vs lié, stats
```

## Packages npm backend
fastify, @fastify/cors, @fastify/cookie, socket.io, pg, ioredis, firebase-admin, dotenv, @sentry/node
Dev: typescript, @types/node, @types/pg, tsx, vitest, @vitest/coverage-v8, socket.io-client (pour tester les WS)

## Packages Flutter (pubspec.yaml)
socket_io_client, firebase_auth, firebase_core, http, provider, shared_preferences, google_mobile_ads, purchases_flutter
Dev: flutter_test (inclus), mocktail

## Packages npm admin
vue, vue-router, @tanstack/vue-query
+ shadcn-vue components (installé via npx shadcn-vue@latest init)
Dev: vite, @vitejs/plugin-vue, typescript, vue-tsc, tailwindcss, autoprefixer, vitest, @vue/test-utils, @testing-library/vue, jsdom

## Phases de développement
1. Fondations (1 sem) : Fastify + PostgreSQL + Redis + Docker + Firebase Auth + Flutter base + flavors
2. Moteur de quiz + admin (2 sem) : API questions/catégories, écran quiz solo, backoffice CRUD + page Applications
3. Multijoueur (2-3 sem) : Socket.io matchmaking (pools séparés par flavor) + game rooms + temps réel
4. Social (1 sem) : profils, classements (séparés par flavor), badges, amis, notifs push
5. Monétisation (1 sem) : AdMob + RevenueCat (achats in-app)
6. Beta + lancement (2 sem) : tests, corrections, stores (2 fiches par store)