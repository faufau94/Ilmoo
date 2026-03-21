import 'dart:ui';
import 'app_config.dart';

class IlmooDefaults {
  IlmooDefaults._();

  static const config = AppConfig(
    appName: 'Ilmoo',
    appId: 'com.ilmoo.app',
    flavorSlug: 'ilmoo',
    apiBaseUrl: 'https://api.ilmoo.com',
    primaryColor: Color(0xFF1B4332),
    primaryDark: Color(0xFF081C15),
    accentPositive: Color(0xFF52B788),
    accentNegative: Color(0xFFF4845F),
    enabledCategoryIds: null, // all categories
    adsEnabled: true,
    premiumEnabled: true,
    tournamentsEnabled: true,
    friendsEnabled: true,
    isActive: true,
    appDescription: 'Quiz culture générale multijoueur',
    supportEmail: 'support@ilmoo.com',
  );
}
