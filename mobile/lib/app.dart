import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'config/app_config.dart';
import 'services/api_service.dart';
import 'services/auth_service.dart';
import 'theme/app_theme.dart';
import 'screens/splash_screen.dart';
import 'screens/maintenance_screen.dart';

class QuizApp extends StatefulWidget {
  final AppConfig defaults;

  const QuizApp({super.key, required this.defaults});

  @override
  State<QuizApp> createState() => _QuizAppState();
}

class _QuizAppState extends State<QuizApp> {
  late AppConfig _config;
  late ApiService _apiService;
  late AuthService _authService;
  bool _configLoaded = false;

  @override
  void initState() {
    super.initState();
    _config = widget.defaults;
    _apiService = ApiService(_config);
    _authService = AuthService(_apiService);
    _loadRemoteConfig();
  }

  Future<void> _loadRemoteConfig() async {
    final data = await _apiService.fetchFlavorConfig();
    if (data != null && mounted) {
      setState(() {
        _config = AppConfig.fromApi(data, widget.defaults);
        _configLoaded = true;
      });
    } else if (mounted) {
      setState(() => _configLoaded = true);
    }
  }

  @override
  void dispose() {
    _apiService.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<AppConfig>.value(value: _config),
        Provider<ApiService>.value(value: _apiService),
        Provider<AuthService>.value(value: _authService),
      ],
      child: MaterialApp(
        title: _config.appName,
        debugShowCheckedModeBanner: false,
        theme: AppTheme.buildTheme(_config),
        home: _buildHome(),
      ),
    );
  }

  Widget _buildHome() {
    if (_configLoaded && !_config.isActive) {
      return MaintenanceScreen(message: _config.maintenanceMessage);
    }
    return const SplashScreen();
  }
}
