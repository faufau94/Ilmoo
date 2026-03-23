import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/app_config.dart';
import '../models/category.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import 'match_screen.dart';

class CategoryScreen extends StatefulWidget {
  const CategoryScreen({super.key});

  @override
  State<CategoryScreen> createState() => _CategoryScreenState();
}

class _CategoryScreenState extends State<CategoryScreen> {
  List<Category> _categories = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadCategories();
  }

  Future<void> _loadCategories() async {
    final api = context.read<ApiService>();
    final config = context.read<AppConfig>();
    final data = await api.getCategories();

    var categories = data.map((e) => Category.fromJson(e)).toList();

    // Filter by enabled category IDs if configured
    if (config.enabledCategoryIds != null) {
      categories = categories
          .where((c) => config.enabledCategoryIds!.contains(c.id))
          .toList();
    }

    if (mounted) setState(() { _categories = categories; _loading = false; });
  }

  void _onCategoryTap(Category category) {
    if (category.subcategoriesCount > 0) {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => _SubcategoryScreen(parent: category),
        ),
      );
    } else {
      _startMatch(category);
    }
  }

  void _startMatch(Category category) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => MatchScreen(
          categoryId: category.id,
          categoryName: category.name,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final config = context.read<AppConfig>();

    if (_loading) {
      return Center(
        child: CircularProgressIndicator(color: config.accentPositive),
      );
    }

    if (_categories.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.category_outlined, size: 48, color: Colors.white24),
            const SizedBox(height: 12),
            Text(
              'Aucune catégorie disponible',
              style: TextStyle(color: Colors.white54, fontSize: 16),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadCategories,
      color: config.accentPositive,
      child: GridView.builder(
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 0.85,
        ),
        itemCount: _categories.length,
        itemBuilder: (context, index) {
          return _CategoryCard(
            category: _categories[index],
            config: config,
            onTap: () => _onCategoryTap(_categories[index]),
          );
        },
      ),
    );
  }
}

// ── Category card ──

class _CategoryCard extends StatelessWidget {
  final Category category;
  final AppConfig config;
  final VoidCallback onTap;

  const _CategoryCard({
    required this.category,
    required this.config,
    required this.onTap,
  });

  Color get _categoryColor {
    final hex = category.color.replaceFirst('#', '');
    final intVal = int.tryParse(hex, radix: 16);
    if (intVal == null) return config.accentPositive;
    return Color(0xFF000000 | intVal);
  }

  IconData get _categoryIcon {
    const icons = <String, IconData>{
      'science': Icons.science_outlined,
      'geography': Icons.public_outlined,
      'history': Icons.history_edu_outlined,
      'sport': Icons.sports_soccer_outlined,
      'cinema': Icons.movie_outlined,
      'music': Icons.music_note_outlined,
      'art': Icons.palette_outlined,
      'literature': Icons.menu_book_outlined,
      'nature': Icons.eco_outlined,
      'technology': Icons.computer_outlined,
      'food': Icons.restaurant_outlined,
      'quiz': Icons.quiz_outlined,
    };
    return icons[category.iconName] ?? Icons.quiz_outlined;
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white.withAlpha(15),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _categoryColor.withAlpha(60), width: 1),
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Icon circle
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _categoryColor.withAlpha(30),
              ),
              child: Icon(_categoryIcon, color: _categoryColor, size: 28),
            ),
            const SizedBox(height: 12),

            // Name
            Text(
              category.name,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 6),

            // Subtitle
            if (category.subcategoriesCount > 0)
              Text(
                '${category.subcategoriesCount} sous-catégories',
                style: TextStyle(color: Colors.white54, fontSize: 12),
              ),

            // Premium badge
            if (category.isPremium) ...[
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.amber.withAlpha(30),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'PREMIUM',
                  style: TextStyle(color: Colors.amber, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Subcategory list screen ──

class _SubcategoryScreen extends StatefulWidget {
  final Category parent;
  const _SubcategoryScreen({required this.parent});

  @override
  State<_SubcategoryScreen> createState() => _SubcategoryScreenState();
}

class _SubcategoryScreenState extends State<_SubcategoryScreen> {
  List<Category> _subcategories = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<ApiService>();
    final data = await api.getSubcategories(widget.parent.slug);
    if (mounted) {
      setState(() {
        _subcategories = data.map((e) => Category.fromJson(e)).toList();
        _loading = false;
      });
    }
  }

  void _startMatch(String categoryId, String categoryName) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => MatchScreen(
          categoryId: categoryId,
          categoryName: categoryName,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final config = context.read<AppConfig>();

    return Scaffold(
      body: Container(
        decoration: AppTheme.backgroundGradient(config),
        child: SafeArea(
          child: Column(
            children: [
              // Header
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        widget.parent.name.toUpperCase(),
                        style: TextStyle(
                          color: config.accentPositive,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 2,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // "All questions" button
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: GestureDetector(
                  onTap: () => _startMatch(widget.parent.id, widget.parent.name),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    decoration: BoxDecoration(
                      color: config.accentPositive.withAlpha(20),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: config.accentPositive.withAlpha(60)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.play_arrow_rounded, color: config.accentPositive),
                        const SizedBox(width: 8),
                        Text(
                          'Toutes les questions',
                          style: TextStyle(
                            color: config.accentPositive,
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 16),

              // Subcategories list
              Expanded(
                child: _loading
                    ? Center(child: CircularProgressIndicator(color: config.accentPositive))
                    : ListView.separated(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: _subcategories.length,
                        separatorBuilder: (context, index) => const SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final sub = _subcategories[index];
                          return GestureDetector(
                            onTap: () => _startMatch(sub.id, sub.name),
                            child: Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: Colors.white.withAlpha(15),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          sub.name,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 15,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                      ],
                                    ),
                                  ),
                                  Icon(Icons.chevron_right, color: Colors.white38),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
