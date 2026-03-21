import 'dart:ui';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/config/app_config.dart';
import 'package:mobile/config/ilmoo_defaults.dart';
import 'package:mobile/config/quizapp_defaults.dart';

void main() {
  group('IlmooDefaults', () {
    test('has correct identity', () {
      final config = IlmooDefaults.config;
      expect(config.appName, 'Ilmoo');
      expect(config.appId, 'com.ilmoo.app');
      expect(config.flavorSlug, 'ilmoo');
    });

    test('has green color palette', () {
      final config = IlmooDefaults.config;
      expect(config.primaryColor, const Color(0xFF1B4332));
      expect(config.primaryDark, const Color(0xFF081C15));
      expect(config.accentPositive, const Color(0xFF52B788));
      expect(config.accentNegative, const Color(0xFFF4845F));
    });

    test('has all features enabled', () {
      final config = IlmooDefaults.config;
      expect(config.adsEnabled, true);
      expect(config.premiumEnabled, true);
      expect(config.tournamentsEnabled, true);
      expect(config.friendsEnabled, true);
    });

    test('has null enabledCategoryIds (all categories)', () {
      expect(IlmooDefaults.config.enabledCategoryIds, isNull);
    });
  });

  group('QuizBattleDefaults', () {
    test('has correct identity', () {
      final config = QuizBattleDefaults.config;
      expect(config.appName, 'QuizBattle');
      expect(config.appId, 'com.quizbattle.app');
      expect(config.flavorSlug, 'quizapp');
    });

    test('has blue color palette', () {
      final config = QuizBattleDefaults.config;
      expect(config.primaryColor, const Color(0xFF1A365D));
      expect(config.accentPositive, const Color(0xFF4299E1));
    });
  });

  group('AppConfig.fromApi', () {
    final fallback = IlmooDefaults.config;

    test('merges API values with fallback', () {
      final merged = AppConfig.fromApi({
        'appName': 'Ilmoo Updated',
        'primaryColor': '#FF0000',
      }, fallback);

      expect(merged.appName, 'Ilmoo Updated');
      expect(merged.primaryColor, const Color(0xFFFF0000));
      // Unchanged fields use fallback
      expect(merged.primaryDark, fallback.primaryDark);
      expect(merged.accentPositive, fallback.accentPositive);
    });

    test('keeps fallback for null API fields', () {
      final merged = AppConfig.fromApi({
        'appName': null,
        'primaryColor': null,
      }, fallback);

      expect(merged.appName, fallback.appName);
      expect(merged.primaryColor, fallback.primaryColor);
    });

    test('never overrides appId, flavorSlug, apiBaseUrl', () {
      final merged = AppConfig.fromApi({
        'appId': 'com.hacked.app',
        'flavorSlug': 'hacked',
        'apiBaseUrl': 'https://evil.com',
      }, fallback);

      expect(merged.appId, fallback.appId);
      expect(merged.flavorSlug, fallback.flavorSlug);
      expect(merged.apiBaseUrl, fallback.apiBaseUrl);
    });

    test('merges feature flags', () {
      final merged = AppConfig.fromApi({
        'adsEnabled': false,
        'tournamentsEnabled': false,
      }, fallback);

      expect(merged.adsEnabled, false);
      expect(merged.tournamentsEnabled, false);
      // Unchanged flags
      expect(merged.premiumEnabled, true);
      expect(merged.friendsEnabled, true);
    });

    test('merges enabledCategoryIds', () {
      final merged = AppConfig.fromApi({
        'enabledCategoryIds': ['cat-1', 'cat-2'],
      }, fallback);

      expect(merged.enabledCategoryIds, ['cat-1', 'cat-2']);
    });

    test('merges gameplay values', () {
      final merged = AppConfig.fromApi({
        'roundCount': 10,
        'timerSeconds': 15,
        'freeDailyMatches': 3,
      }, fallback);

      expect(merged.roundCount, 10);
      expect(merged.timerSeconds, 15);
      expect(merged.freeDailyMatches, 3);
      // Unchanged
      expect(merged.pointsPerRound, fallback.pointsPerRound);
    });

    test('merges scoring values', () {
      final merged = AppConfig.fromApi({
        'pointsPerRound': 30,
        'speedWeight': 0.5,
      }, fallback);

      expect(merged.pointsPerRound, 30);
      expect(merged.speedWeight, 0.5);
    });

    test('merges maintenance values', () {
      final merged = AppConfig.fromApi({
        'isActive': false,
        'maintenanceMessage': 'Maintenance en cours',
      }, fallback);

      expect(merged.isActive, false);
      expect(merged.maintenanceMessage, 'Maintenance en cours');
    });

    test('handles empty API response', () {
      final merged = AppConfig.fromApi({}, fallback);

      expect(merged.appName, fallback.appName);
      expect(merged.primaryColor, fallback.primaryColor);
      expect(merged.roundCount, fallback.roundCount);
      expect(merged.isActive, fallback.isActive);
    });

    test('parses invalid color gracefully (falls back)', () {
      final merged = AppConfig.fromApi({
        'primaryColor': 'not-a-color',
      }, fallback);

      expect(merged.primaryColor, fallback.primaryColor);
    });
  });

  group('AppConfig.text()', () {
    test('returns text value for known key', () {
      final config = AppConfig.fromApi({
        'texts': {'matchWin': 'Victoire !'},
      }, IlmooDefaults.config);

      expect(config.text('matchWin'), 'Victoire !');
    });

    test('returns key itself for unknown key', () {
      final config = IlmooDefaults.config;
      expect(config.text('unknownKey'), 'unknownKey');
    });
  });
}
