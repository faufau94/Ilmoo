import 'dart:ui';

class AppConfig {
  final String appName;
  final String appId;
  final String flavorSlug;
  final String apiBaseUrl;

  // Theme (modifiable from admin)
  final Color primaryColor;
  final Color primaryDark;
  final Color accentPositive;
  final Color accentNegative;

  // Categories
  final List<String>? enabledCategoryIds; // null = all

  // Feature flags (modifiable from admin)
  final bool adsEnabled;
  final bool premiumEnabled;
  final bool tournamentsEnabled;
  final bool friendsEnabled;

  // Maintenance
  final bool isActive;
  final String? maintenanceMessage;
  final String? minAppVersion;

  // Store
  final String? appStoreUrl;
  final String? playStoreUrl;

  // Info
  final String appDescription;
  final String supportEmail;

  const AppConfig({
    required this.appName,
    required this.appId,
    required this.flavorSlug,
    required this.apiBaseUrl,
    required this.primaryColor,
    required this.primaryDark,
    required this.accentPositive,
    required this.accentNegative,
    this.enabledCategoryIds,
    this.adsEnabled = true,
    this.premiumEnabled = true,
    this.tournamentsEnabled = true,
    this.friendsEnabled = true,
    this.isActive = true,
    this.maintenanceMessage,
    this.minAppVersion,
    this.appStoreUrl,
    this.playStoreUrl,
    required this.appDescription,
    required this.supportEmail,
  });

  /// Merge API response with fallback defaults.
  /// Any non-null API value overrides the fallback.
  factory AppConfig.fromApi(Map<String, dynamic> json, AppConfig fallback) {
    return AppConfig(
      // These never come from the API — always use fallback
      appId: fallback.appId,
      flavorSlug: fallback.flavorSlug,
      apiBaseUrl: fallback.apiBaseUrl,

      appName: json['appName'] as String? ?? fallback.appName,
      appDescription:
          json['appDescription'] as String? ?? fallback.appDescription,
      supportEmail: json['supportEmail'] as String? ?? fallback.supportEmail,

      primaryColor: _parseColor(json['primaryColor']) ?? fallback.primaryColor,
      primaryDark: _parseColor(json['primaryDark']) ?? fallback.primaryDark,
      accentPositive:
          _parseColor(json['accentPositive']) ?? fallback.accentPositive,
      accentNegative:
          _parseColor(json['accentNegative']) ?? fallback.accentNegative,

      enabledCategoryIds:
          (json['enabledCategoryIds'] as List?)?.cast<String>() ??
              fallback.enabledCategoryIds,

      adsEnabled: json['adsEnabled'] as bool? ?? fallback.adsEnabled,
      premiumEnabled:
          json['premiumEnabled'] as bool? ?? fallback.premiumEnabled,
      tournamentsEnabled:
          json['tournamentsEnabled'] as bool? ?? fallback.tournamentsEnabled,
      friendsEnabled:
          json['friendsEnabled'] as bool? ?? fallback.friendsEnabled,

      isActive: json['isActive'] as bool? ?? fallback.isActive,
      maintenanceMessage:
          json['maintenanceMessage'] as String? ?? fallback.maintenanceMessage,
      minAppVersion:
          json['minAppVersion'] as String? ?? fallback.minAppVersion,

      appStoreUrl: json['appStoreUrl'] as String? ?? fallback.appStoreUrl,
      playStoreUrl: json['playStoreUrl'] as String? ?? fallback.playStoreUrl,
    );
  }

  static Color? _parseColor(dynamic value) {
    if (value is! String) return null;
    final hex = value.replaceFirst('#', '');
    if (hex.length != 6) return null;
    final intValue = int.tryParse(hex, radix: 16);
    if (intValue == null) return null;
    return Color(0xFF000000 | intValue);
  }
}
