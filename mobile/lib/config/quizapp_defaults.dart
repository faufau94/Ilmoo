import 'dart:ui';
import 'app_config.dart';

class QuizBattleDefaults {
  QuizBattleDefaults._();

  static const config = AppConfig(
    appName: 'QuizBattle',
    appId: 'com.quizbattle.app',
    flavorSlug: 'quizapp',
    apiBaseUrl: 'https://api.quizbattle.com',
    primaryColor: Color(0xFF1A365D),
    primaryDark: Color(0xFF0A1628),
    accentPositive: Color(0xFF4299E1),
    accentNegative: Color(0xFFFC8181),
    enabledCategoryIds: null, // configured from admin
    adsEnabled: true,
    premiumEnabled: true,
    tournamentsEnabled: true,
    friendsEnabled: true,
    isActive: true,
    appDescription: 'Quiz culture générale multijoueur',
    supportEmail: 'support@quizbattle.com',
  );
}
