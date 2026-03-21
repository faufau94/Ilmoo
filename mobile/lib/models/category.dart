class Category {
  final String id;
  final String name;
  final String slug;
  final String? parentId;
  final String? description;
  final String iconName;
  final String color;
  final int sortOrder;
  final bool isActive;
  final bool isPremium;
  final int questionCount;
  final int matchCount;
  final int subcategoriesCount;
  final List<Category> subcategories;

  const Category({
    required this.id,
    required this.name,
    required this.slug,
    this.parentId,
    this.description,
    required this.iconName,
    required this.color,
    this.sortOrder = 0,
    this.isActive = true,
    this.isPremium = false,
    this.questionCount = 0,
    this.matchCount = 0,
    this.subcategoriesCount = 0,
    this.subcategories = const [],
  });

  factory Category.fromJson(Map<String, dynamic> json) {
    return Category(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      parentId: json['parent_id'] as String?,
      description: json['description'] as String?,
      iconName: json['icon_name'] as String? ?? 'quiz',
      color: json['color'] as String? ?? '#1B4332',
      sortOrder: json['sort_order'] as int? ?? 0,
      isActive: json['is_active'] as bool? ?? true,
      isPremium: json['is_premium'] as bool? ?? false,
      questionCount: json['question_count'] as int? ?? 0,
      matchCount: json['match_count'] as int? ?? 0,
      subcategoriesCount: json['subcategories_count'] is int
          ? json['subcategories_count'] as int
          : int.tryParse(json['subcategories_count']?.toString() ?? '0') ?? 0,
      subcategories: (json['subcategories'] as List?)
              ?.map((e) => Category.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'slug': slug,
        'parent_id': parentId,
        'description': description,
        'icon_name': iconName,
        'color': color,
        'sort_order': sortOrder,
        'is_active': isActive,
        'is_premium': isPremium,
        'question_count': questionCount,
        'match_count': matchCount,
      };
}
