import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/config/app_config.dart';
import 'package:mobile/config/ilmoo_defaults.dart';

void main() {
  test('IlmooDefaults has correct flavor slug', () {
    final config = IlmooDefaults.config;
    expect(config.flavorSlug, 'ilmoo');
    expect(config.appName, 'Ilmoo');
  });

  test('AppConfig.fromApi merges with fallback', () {
    final fallback = IlmooDefaults.config;
    final apiData = <String, dynamic>{
      'appName': 'Ilmoo Updated',
      'primaryColor': '#FF0000',
    };
    final merged = AppConfig.fromApi(apiData, fallback);

    expect(merged.appName, 'Ilmoo Updated');
    expect(merged.flavorSlug, 'ilmoo'); // never overridden
    expect(merged.appDescription, fallback.appDescription); // fallback kept
  });
}
