/**
 * Seed categories & subcategories (style QuizUp).
 * Run standalone: npx tsx src/db/seed-categories.ts
 */
import { db } from './index.js';
import { sql } from 'drizzle-orm';

interface Category {
  name: string;
  slug: string;
  icon_name: string;
  color: string;
  subcategories: { name: string; slug: string; icon_name: string }[];
}

const categories: Category[] = [
  {
    name: 'Sciences & Nature',
    slug: 'sciences-nature',
    icon_name: 'flask',
    color: '#2ECC71',
    subcategories: [
      { name: 'Biologie', slug: 'biologie', icon_name: 'dna' },
      { name: 'Chimie', slug: 'chimie', icon_name: 'beaker' },
      { name: 'Physique', slug: 'physique', icon_name: 'atom' },
      { name: 'Astronomie', slug: 'astronomie', icon_name: 'telescope' },
      { name: 'Sciences de la Terre', slug: 'sciences-terre', icon_name: 'globe' },
      { name: 'Corps humain', slug: 'corps-humain', icon_name: 'heart-pulse' },
      { name: 'Animaux', slug: 'animaux', icon_name: 'paw-print' },
      { name: 'Dinosaures', slug: 'dinosaures', icon_name: 'bone' },
      { name: 'Mathématiques', slug: 'mathematiques', icon_name: 'calculator' },
      { name: 'Océans & Vie marine', slug: 'oceans-vie-marine', icon_name: 'fish' },
    ],
  },
  {
    name: 'Géographie',
    slug: 'geographie',
    icon_name: 'earth',
    color: '#3498DB',
    subcategories: [
      { name: 'Pays du monde', slug: 'pays-du-monde', icon_name: 'flag' },
      { name: 'Capitales', slug: 'capitales', icon_name: 'landmark' },
      { name: 'Drapeaux', slug: 'drapeaux', icon_name: 'flag-triangle-right' },
      { name: 'Fleuves & Rivières', slug: 'fleuves-rivieres', icon_name: 'waves' },
      { name: 'Montagnes', slug: 'montagnes', icon_name: 'mountain' },
      { name: 'Continents & Régions', slug: 'continents-regions', icon_name: 'map' },
      { name: 'Villes célèbres', slug: 'villes-celebres', icon_name: 'building-2' },
      { name: 'Monuments du monde', slug: 'monuments-du-monde', icon_name: 'castle' },
      { name: 'Géographie de la France', slug: 'geographie-france', icon_name: 'map-pin' },
    ],
  },
  {
    name: 'Histoire',
    slug: 'histoire',
    icon_name: 'scroll-text',
    color: '#8E44AD',
    subcategories: [
      { name: 'Antiquité', slug: 'antiquite', icon_name: 'columns' },
      { name: 'Moyen Âge', slug: 'moyen-age', icon_name: 'swords' },
      { name: 'Renaissance', slug: 'renaissance', icon_name: 'palette' },
      { name: 'Révolution française', slug: 'revolution-francaise', icon_name: 'flame' },
      { name: 'Première Guerre mondiale', slug: 'premiere-guerre-mondiale', icon_name: 'shield' },
      { name: 'Seconde Guerre mondiale', slug: 'seconde-guerre-mondiale', icon_name: 'shield-alert' },
      { name: 'Guerre froide', slug: 'guerre-froide', icon_name: 'snowflake' },
      { name: 'Histoire de France', slug: 'histoire-de-france', icon_name: 'crown' },
      { name: 'Grandes civilisations', slug: 'grandes-civilisations', icon_name: 'pyramid' },
      { name: 'Personnages historiques', slug: 'personnages-historiques', icon_name: 'user' },
    ],
  },
  {
    name: 'Sport',
    slug: 'sport',
    icon_name: 'trophy',
    color: '#E67E22',
    subcategories: [
      { name: 'Football', slug: 'football', icon_name: 'circle-dot' },
      { name: 'Basketball', slug: 'basketball', icon_name: 'circle' },
      { name: 'Tennis', slug: 'tennis', icon_name: 'racquet' },
      { name: 'Jeux Olympiques', slug: 'jeux-olympiques', icon_name: 'medal' },
      { name: 'Formule 1', slug: 'formule-1', icon_name: 'car' },
      { name: 'Rugby', slug: 'rugby', icon_name: 'oval' },
      { name: 'Boxe & Arts martiaux', slug: 'boxe-arts-martiaux', icon_name: 'swords' },
      { name: 'Cyclisme', slug: 'cyclisme', icon_name: 'bike' },
      { name: 'Natation', slug: 'natation', icon_name: 'waves' },
      { name: 'Athlétisme', slug: 'athletisme', icon_name: 'timer' },
    ],
  },
  {
    name: 'Cinéma',
    slug: 'cinema',
    icon_name: 'clapperboard',
    color: '#E74C3C',
    subcategories: [
      { name: 'Films d\'action', slug: 'films-action', icon_name: 'flame' },
      { name: 'Films d\'horreur', slug: 'films-horreur', icon_name: 'skull' },
      { name: 'Comédies', slug: 'comedies', icon_name: 'smile' },
      { name: 'Disney & Pixar', slug: 'disney-pixar', icon_name: 'sparkles' },
      { name: 'Marvel & DC', slug: 'marvel-dc', icon_name: 'zap' },
      { name: 'Oscars & Récompenses', slug: 'oscars-recompenses', icon_name: 'award' },
      { name: 'Acteurs & Actrices', slug: 'acteurs-actrices', icon_name: 'star' },
      { name: 'Réalisateurs', slug: 'realisateurs', icon_name: 'video' },
      { name: 'Cinéma français', slug: 'cinema-francais', icon_name: 'film' },
      { name: 'Classiques du cinéma', slug: 'classiques-cinema', icon_name: 'projector' },
    ],
  },
  {
    name: 'Séries TV',
    slug: 'series-tv',
    icon_name: 'tv',
    color: '#9B59B6',
    subcategories: [
      { name: 'Séries Netflix', slug: 'series-netflix', icon_name: 'play' },
      { name: 'Sitcoms', slug: 'sitcoms', icon_name: 'smile' },
      { name: 'Anime & Manga', slug: 'anime-manga', icon_name: 'sparkles' },
      { name: 'Séries policières', slug: 'series-policieres', icon_name: 'search' },
      { name: 'Séries fantastiques', slug: 'series-fantastiques', icon_name: 'wand' },
      { name: 'Téléréalité', slug: 'telerealite', icon_name: 'camera' },
      { name: 'Séries françaises', slug: 'series-francaises', icon_name: 'clapperboard' },
      { name: 'Dessins animés', slug: 'dessins-animes', icon_name: 'palette' },
    ],
  },
  {
    name: 'Musique',
    slug: 'musique',
    icon_name: 'music',
    color: '#1ABC9C',
    subcategories: [
      { name: 'Rock', slug: 'rock', icon_name: 'guitar' },
      { name: 'Hip-Hop & Rap', slug: 'hip-hop-rap', icon_name: 'mic' },
      { name: 'Pop', slug: 'pop', icon_name: 'headphones' },
      { name: 'Musique classique', slug: 'musique-classique', icon_name: 'piano' },
      { name: 'Musique française', slug: 'musique-francaise', icon_name: 'music-2' },
      { name: 'Instruments', slug: 'instruments', icon_name: 'drum' },
      { name: 'Années 80 & 90', slug: 'annees-80-90', icon_name: 'disc' },
      { name: 'R&B & Soul', slug: 'rnb-soul', icon_name: 'heart' },
      { name: 'Electro & DJ', slug: 'electro-dj', icon_name: 'radio' },
    ],
  },
  {
    name: 'Art & Littérature',
    slug: 'art-litterature',
    icon_name: 'book-open',
    color: '#F39C12',
    subcategories: [
      { name: 'Peinture', slug: 'peinture', icon_name: 'paintbrush' },
      { name: 'Littérature classique', slug: 'litterature-classique', icon_name: 'book' },
      { name: 'Littérature française', slug: 'litterature-francaise', icon_name: 'book-open' },
      { name: 'Poésie', slug: 'poesie', icon_name: 'feather' },
      { name: 'Mythologie', slug: 'mythologie', icon_name: 'shield' },
      { name: 'Sculpture & Architecture', slug: 'sculpture-architecture', icon_name: 'building' },
      { name: 'Bandes dessinées', slug: 'bandes-dessinees', icon_name: 'layout' },
      { name: 'Philosophie', slug: 'philosophie', icon_name: 'brain' },
    ],
  },
  {
    name: 'Gastronomie',
    slug: 'gastronomie',
    icon_name: 'utensils',
    color: '#D35400',
    subcategories: [
      { name: 'Cuisine française', slug: 'cuisine-francaise', icon_name: 'chef-hat' },
      { name: 'Cuisines du monde', slug: 'cuisines-du-monde', icon_name: 'globe' },
      { name: 'Vins & Fromages', slug: 'vins-fromages', icon_name: 'wine' },
      { name: 'Pâtisserie', slug: 'patisserie', icon_name: 'cake' },
      { name: 'Épices & Ingrédients', slug: 'epices-ingredients', icon_name: 'leaf' },
      { name: 'Fast-food & Street food', slug: 'fast-food-street-food', icon_name: 'pizza' },
      { name: 'Cocktails & Boissons', slug: 'cocktails-boissons', icon_name: 'glass-water' },
    ],
  },
  {
    name: 'Technologie',
    slug: 'technologie',
    icon_name: 'cpu',
    color: '#2C3E50',
    subcategories: [
      { name: 'Informatique', slug: 'informatique', icon_name: 'monitor' },
      { name: 'Internet & Réseaux sociaux', slug: 'internet-reseaux-sociaux', icon_name: 'wifi' },
      { name: 'Smartphones & Gadgets', slug: 'smartphones-gadgets', icon_name: 'smartphone' },
      { name: 'Inventions', slug: 'inventions', icon_name: 'lightbulb' },
      { name: 'Jeux vidéo', slug: 'jeux-video', icon_name: 'gamepad-2' },
      { name: 'Intelligence artificielle', slug: 'intelligence-artificielle', icon_name: 'brain' },
      { name: 'Espace & Exploration', slug: 'espace-exploration', icon_name: 'rocket' },
      { name: 'Robotique', slug: 'robotique', icon_name: 'bot' },
    ],
  },
  {
    name: 'Divertissement',
    slug: 'divertissement',
    icon_name: 'gamepad',
    color: '#E91E63',
    subcategories: [
      { name: 'Jeux de société', slug: 'jeux-de-societe', icon_name: 'dice-5' },
      { name: 'Célébrités', slug: 'celebrites', icon_name: 'star' },
      { name: 'Comics & Super-héros', slug: 'comics-super-heros', icon_name: 'zap' },
      { name: 'YouTube & Influenceurs', slug: 'youtube-influenceurs', icon_name: 'play' },
      { name: 'Logos & Marques', slug: 'logos-marques', icon_name: 'tag' },
      { name: 'Culture pop', slug: 'culture-pop', icon_name: 'sparkles' },
      { name: 'Émojis & Internet', slug: 'emojis-internet', icon_name: 'smile' },
    ],
  },
  {
    name: 'Langues',
    slug: 'langues',
    icon_name: 'languages',
    color: '#00BCD4',
    subcategories: [
      { name: 'Français', slug: 'francais', icon_name: 'spell-check' },
      { name: 'Anglais', slug: 'anglais', icon_name: 'book-a' },
      { name: 'Espagnol', slug: 'espagnol', icon_name: 'book-a' },
      { name: 'Origines des mots', slug: 'origines-des-mots', icon_name: 'scroll' },
      { name: 'Expressions & Proverbes', slug: 'expressions-proverbes', icon_name: 'quote' },
      { name: 'Grammaire & Orthographe', slug: 'grammaire-orthographe', icon_name: 'check' },
    ],
  },
];

export async function seedCategories() {
  console.log('Seeding categories...\n');

  let rootCount = 0;
  let subCount = 0;

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i]!;

    const result = await db.execute(sql`
      INSERT INTO categories (name, slug, icon_name, color, sort_order, parent_id)
      VALUES (${cat.name}, ${cat.slug}, ${cat.icon_name}, ${cat.color}, ${i}, NULL)
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name, icon_name = EXCLUDED.icon_name,
        color = EXCLUDED.color, sort_order = EXCLUDED.sort_order
      RETURNING id
    `);

    const parentId = (result.rows[0] as { id: string }).id;
    rootCount++;
    console.log(`✓ ${cat.name} (${cat.subcategories.length} sous-catégories)`);

    for (let j = 0; j < cat.subcategories.length; j++) {
      const sub = cat.subcategories[j]!;

      await db.execute(sql`
        INSERT INTO categories (name, slug, icon_name, color, sort_order, parent_id)
        VALUES (${sub.name}, ${sub.slug}, ${sub.icon_name}, ${cat.color}, ${j}, ${parentId})
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name, icon_name = EXCLUDED.icon_name,
          color = EXCLUDED.color, sort_order = EXCLUDED.sort_order,
          parent_id = EXCLUDED.parent_id
        RETURNING id
      `);
      subCount++;
    }
  }

  console.log(`\nDone: ${rootCount} catégories, ${subCount} sous-catégories.`);
}

// Standalone execution
if (process.argv[1]?.includes('seed-categories')) {
  const { config: dotenvConfig } = await import('dotenv');
  const { resolve } = await import('node:path');
  dotenvConfig({ path: resolve(import.meta.dirname, '../../../.env') });
  const pool = (await import('./connection.js')).default;
  seedCategories()
    .then(() => pool.end())
    .catch((err) => { console.error('Seed failed:', err); process.exit(1); });
}
