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

  // Gameplay (modifiable from admin)
  final int freeDailyMatches;
  final int roundCount;
  final int timerSeconds;
  final bool bonusRoundEnabled;
  final int matchmakingTimeoutSeconds;

  // Scoring (modifiable from admin)
  final int pointsPerRound;
  final int pointsBonusRound;
  final double speedWeight;
  final double baseWeight;
  final int minCorrectPoints;

  // Progression (modifiable from admin)
  final int xpBaseMatch;
  final int xpWinBonus;
  final int xpPerfectBonus;
  final int xpStreakMultiplier;
  final int levelFormulaDivisor;
  final Map<String, int> badgeThresholds;

  // Texts (modifiable from admin)
  final Map<String, String> texts;

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
    this.freeDailyMatches = 5,
    this.roundCount = 7,
    this.timerSeconds = 10,
    this.bonusRoundEnabled = true,
    this.matchmakingTimeoutSeconds = 15,
    this.pointsPerRound = 20,
    this.pointsBonusRound = 40,
    this.speedWeight = 0.70,
    this.baseWeight = 0.30,
    this.minCorrectPoints = 5,
    this.xpBaseMatch = 10,
    this.xpWinBonus = 15,
    this.xpPerfectBonus = 25,
    this.xpStreakMultiplier = 2,
    this.levelFormulaDivisor = 100,
    this.badgeThresholds = const {
      'bronze': 0,
      'silver': 500,
      'gold': 2000,
      'expert': 5000,
      'grand_master': 10000,
    },
    this.texts = const {},
    this.isActive = true,
    this.maintenanceMessage,
    this.minAppVersion,
    this.appStoreUrl,
    this.playStoreUrl,
    required this.appDescription,
    required this.supportEmail,
  });

  /// Access texts with fallback to key itself
  String text(String key) => texts[key] ?? key;

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

      freeDailyMatches: json['freeDailyMatches'] as int? ?? fallback.freeDailyMatches,
      roundCount: json['roundCount'] as int? ?? fallback.roundCount,
      timerSeconds: json['timerSeconds'] as int? ?? fallback.timerSeconds,
      bonusRoundEnabled: json['bonusRoundEnabled'] as bool? ?? fallback.bonusRoundEnabled,
      matchmakingTimeoutSeconds: json['matchmakingTimeoutSeconds'] as int? ?? fallback.matchmakingTimeoutSeconds,

      pointsPerRound: json['pointsPerRound'] as int? ?? fallback.pointsPerRound,
      pointsBonusRound: json['pointsBonusRound'] as int? ?? fallback.pointsBonusRound,
      speedWeight: (json['speedWeight'] as num?)?.toDouble() ?? fallback.speedWeight,
      baseWeight: (json['baseWeight'] as num?)?.toDouble() ?? fallback.baseWeight,
      minCorrectPoints: json['minCorrectPoints'] as int? ?? fallback.minCorrectPoints,

      xpBaseMatch: json['xpBaseMatch'] as int? ?? fallback.xpBaseMatch,
      xpWinBonus: json['xpWinBonus'] as int? ?? fallback.xpWinBonus,
      xpPerfectBonus: json['xpPerfectBonus'] as int? ?? fallback.xpPerfectBonus,
      xpStreakMultiplier: json['xpStreakMultiplier'] as int? ?? fallback.xpStreakMultiplier,
      levelFormulaDivisor: json['levelFormulaDivisor'] as int? ?? fallback.levelFormulaDivisor,
      badgeThresholds: (json['badgeThresholds'] as Map<String, dynamic>?)
              ?.map((k, v) => MapEntry(k, v as int)) ??
          fallback.badgeThresholds,

      texts: (json['texts'] as Map<String, dynamic>?)
              ?.map((k, v) => MapEntry(k, v as String)) ??
          fallback.texts,

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
