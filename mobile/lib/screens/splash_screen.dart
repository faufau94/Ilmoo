import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../config/app_config.dart';
import '../services/auth_service.dart';
import '../theme/app_theme.dart';
import 'home_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeIn;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _fadeIn = CurvedAnimation(parent: _controller, curve: Curves.easeIn);
    _controller.forward();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final authService = context.read<AuthService>();

    try {
      // Check if a Firebase user already exists
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        // First launch — sign in anonymously
        await authService.signInAnonymous();
      }
    } catch (e) {
      debugPrint('Auth bootstrap failed: $e');
    }

    // Let the animation play for at least 1.5s
    await Future.delayed(const Duration(milliseconds: 1500));

    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const HomeScreen()),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final config = context.read<AppConfig>();

    return Scaffold(
      body: Container(
        decoration: AppTheme.backgroundGradient(config),
        child: Center(
          child: FadeTransition(
            opacity: _fadeIn,
            child: Text(
              config.appName,
              style: TextStyle(
                fontSize: 42,
                fontWeight: FontWeight.bold,
                color: config.accentPositive,
                letterSpacing: 2,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
