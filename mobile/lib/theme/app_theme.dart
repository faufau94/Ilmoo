import 'package:flutter/material.dart';
import '../config/app_config.dart';

class AppTheme {
  AppTheme._();

  static ThemeData buildTheme(AppConfig config) {
    final primary = config.primaryColor;
    final primaryDark = config.primaryDark;
    final accent = config.accentPositive;

    final colorScheme = ColorScheme.dark(
      primary: primary,
      primaryContainer: primaryDark,
      secondary: accent,
      secondaryContainer: accent.withAlpha(80),
      surface: primaryDark,
      error: config.accentNegative,
      onPrimary: Colors.white,
      onSecondary: Colors.white,
      onSurface: Colors.white,
      onError: Colors.white,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: primaryDark,
      fontFamily: 'Roboto',

      // AppBar
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: const TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: Colors.white,
        ),
        iconTheme: const IconThemeData(color: Colors.white),
      ),

      // Cards — semi-transparent white
      cardTheme: CardThemeData(
        color: Colors.white.withAlpha(15),
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      ),

      // Elevated buttons
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: accent,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),

      // Text buttons
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: accent,
        ),
      ),

      // Input fields
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white.withAlpha(15),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
        hintStyle: TextStyle(color: Colors.white.withAlpha(100)),
      ),

      // Bottom nav
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: primaryDark,
        selectedItemColor: accent,
        unselectedItemColor: Colors.white.withAlpha(120),
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),

      // Dividers
      dividerTheme: DividerThemeData(
        color: Colors.white.withAlpha(20),
        thickness: 1,
      ),
    );
  }

  /// Background gradient used as scaffold decoration.
  static BoxDecoration backgroundGradient(AppConfig config) {
    return BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [config.primaryColor, config.primaryDark],
      ),
    );
  }
}
