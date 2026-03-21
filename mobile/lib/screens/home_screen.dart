import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/app_config.dart';
import '../services/auth_service.dart';
import '../theme/app_theme.dart';
import 'login_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;
  bool _bannerDismissed = false;
  int _matchesPlayed = 0;
  bool _linkPromptShown = false;

  @override
  void initState() {
    super.initState();
    _loadMatchCount();
  }

  Future<void> _loadMatchCount() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _matchesPlayed = prefs.getInt('matches_played') ?? 0;
      _bannerDismissed = prefs.getBool('link_banner_dismissed') ?? false;
    });
  }

  Future<void> _dismissBanner() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('link_banner_dismissed', true);
    setState(() => _bannerDismissed = true);
  }

  void _showLinkPrompt() {
    if (_linkPromptShown) return;
    _linkPromptShown = true;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        final config = context.read<AppConfig>();
        return Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: config.primaryDark,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.shield_outlined, size: 40, color: config.accentPositive),
              const SizedBox(height: 16),
              const Text(
                'Sauvegarde ta progression',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Crée un compte pour ne pas perdre tes points et badges',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white.withAlpha(160)),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const LoginScreen()),
                    );
                  },
                  child: const Text('Créer un compte'),
                ),
              ),
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Plus tard'),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final config = context.read<AppConfig>();
    final authService = context.read<AuthService>();
    final isAnonymous = authService.isAnonymous;

    // After 3 matches, show a soft prompt for anonymous users
    if (isAnonymous && _matchesPlayed >= 3 && !_linkPromptShown) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _showLinkPrompt());
    }

    final tabs = _buildTabs(config);

    return Scaffold(
      body: Container(
        decoration: AppTheme.backgroundGradient(config),
        child: SafeArea(
          child: Column(
            children: [
              // Anonymous banner
              if (isAnonymous && !_bannerDismissed)
                _AnonBanner(
                  config: config,
                  onDismiss: _dismissBanner,
                  onLink: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const LoginScreen()),
                  ),
                ),
              // Page content
              Expanded(child: tabs[_currentIndex].body),
            ],
          ),
        ),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
        items: tabs.map((t) => t.navItem).toList(),
      ),
    );
  }

  List<_Tab> _buildTabs(AppConfig config) {
    final tabs = <_Tab>[
      _Tab(
        navItem: const BottomNavigationBarItem(
          icon: Icon(Icons.home_rounded),
          label: 'Accueil',
        ),
        body: const _PlaceholderPage(title: 'Accueil'),
      ),
      _Tab(
        navItem: const BottomNavigationBarItem(
          icon: Icon(Icons.sports_esports_rounded),
          label: 'Match',
        ),
        body: const _PlaceholderPage(title: 'Match'),
      ),
      _Tab(
        navItem: const BottomNavigationBarItem(
          icon: Icon(Icons.leaderboard_rounded),
          label: 'Classement',
        ),
        body: const _PlaceholderPage(title: 'Classement'),
      ),
    ];

    if (config.friendsEnabled) {
      tabs.add(
        _Tab(
          navItem: const BottomNavigationBarItem(
            icon: Icon(Icons.people_rounded),
            label: 'Amis',
          ),
          body: const _PlaceholderPage(title: 'Amis'),
        ),
      );
    }

    tabs.add(
      _Tab(
        navItem: const BottomNavigationBarItem(
          icon: Icon(Icons.person_rounded),
          label: 'Profil',
        ),
        body: const _PlaceholderPage(title: 'Profil'),
      ),
    );

    return tabs;
  }
}

class _Tab {
  final BottomNavigationBarItem navItem;
  final Widget body;
  const _Tab({required this.navItem, required this.body});
}

// ── Anonymous banner ──

class _AnonBanner extends StatelessWidget {
  final AppConfig config;
  final VoidCallback onDismiss;
  final VoidCallback onLink;

  const _AnonBanner({
    required this.config,
    required this.onDismiss,
    required this.onLink,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: config.accentPositive.withAlpha(30),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(Icons.info_outline, size: 18, color: config.accentPositive),
          const SizedBox(width: 8),
          Expanded(
            child: GestureDetector(
              onTap: onLink,
              child: Text(
                'Crée un compte pour sauvegarder ta progression',
                style: TextStyle(fontSize: 13, color: config.accentPositive),
              ),
            ),
          ),
          GestureDetector(
            onTap: onDismiss,
            child: Icon(Icons.close, size: 16, color: config.accentPositive),
          ),
        ],
      ),
    );
  }
}

// ── Placeholder for tabs not yet implemented ──

class _PlaceholderPage extends StatelessWidget {
  final String title;
  const _PlaceholderPage({required this.title});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        title,
        style: const TextStyle(fontSize: 24, color: Colors.white54),
      ),
    );
  }
}
