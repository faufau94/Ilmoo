import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/app_config.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

/// Account linking screen — NOT the first-launch login.
/// Shown from profile or when accessing a feature that requires a linked account.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _loading = false;
  String? _error;

  // Username step
  bool _showUsernamePicker = false;
  final _usernameController = TextEditingController();
  String? _usernameError;

  Future<void> _linkGoogle() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final authService = context.read<AuthService>();
      await authService.linkWithGoogle();
      if (!mounted) return;
      setState(() => _showUsernamePicker = true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _linkEmail() async {
    // Show email/password dialog
    final result = await showDialog<_EmailCredentials>(
      context: context,
      builder: (_) => const _EmailLinkDialog(),
    );
    if (result == null || !mounted) return;

    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final authService = context.read<AuthService>();
      await authService.linkWithEmail(result.email, result.password);
      if (!mounted) return;
      setState(() => _showUsernamePicker = true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submitUsername() async {
    final username = _usernameController.text.trim();
    if (username.length < 3) {
      setState(() => _usernameError = 'Minimum 3 caractères');
      return;
    }

    setState(() {
      _loading = true;
      _usernameError = null;
    });

    final api = context.read<ApiService>();
    final result = await api.linkAccount(
      username: username,
      email: '', // already set during linking
    );

    if (!mounted) return;

    if (result == null) {
      setState(() {
        _usernameError = 'Ce pseudo est déjà pris';
        _loading = false;
      });
      return;
    }

    // Success — go back
    Navigator.of(context).pop(true);
  }

  @override
  void dispose() {
    _usernameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final config = context.read<AppConfig>();

    return Scaffold(
      body: Container(
        decoration: AppTheme.backgroundGradient(config),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: _showUsernamePicker
                ? _buildUsernamePicker(config)
                : _buildLinkOptions(config),
          ),
        ),
      ),
    );
  }

  Widget _buildLinkOptions(AppConfig config) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.link_rounded, size: 56, color: config.accentPositive),
        const SizedBox(height: 24),
        const Text(
          'Connecte-toi pour sauvegarder\nta progression',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'Tes points, badges et niveaux seront conservés',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 14,
            color: Colors.white.withAlpha(160),
          ),
        ),
        const SizedBox(height: 48),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _loading ? null : _linkGoogle,
            icon: const Icon(Icons.g_mobiledata, size: 28),
            label: const Text('Continuer avec Google'),
          ),
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: _loading ? null : _linkEmail,
            icon: const Icon(Icons.email_outlined),
            label: const Text('Continuer avec email'),
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.white,
              side: BorderSide(color: Colors.white.withAlpha(60)),
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: 24),
          Text(_error!, style: TextStyle(color: config.accentNegative)),
        ],
        const SizedBox(height: 24),
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Plus tard'),
        ),
      ],
    );
  }

  Widget _buildUsernamePicker(AppConfig config) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.person_outline, size: 56, color: config.accentPositive),
        const SizedBox(height: 24),
        const Text(
          'Choisis ton pseudo',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 32),
        TextField(
          controller: _usernameController,
          maxLength: 30,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            hintText: 'Pseudo',
            errorText: _usernameError,
          ),
        ),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _loading ? null : _submitUsername,
            child: _loading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Text('Valider'),
          ),
        ),
      ],
    );
  }
}

// ── Email/password dialog ──

class _EmailCredentials {
  final String email;
  final String password;
  _EmailCredentials(this.email, this.password);
}

class _EmailLinkDialog extends StatefulWidget {
  const _EmailLinkDialog();

  @override
  State<_EmailLinkDialog> createState() => _EmailLinkDialogState();
}

class _EmailLinkDialogState extends State<_EmailLinkDialog> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Connexion par email'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(hintText: 'Email'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _passwordController,
            obscureText: true,
            decoration: const InputDecoration(hintText: 'Mot de passe'),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Annuler'),
        ),
        ElevatedButton(
          onPressed: () {
            final email = _emailController.text.trim();
            final password = _passwordController.text;
            if (email.isNotEmpty && password.length >= 6) {
              Navigator.pop(context, _EmailCredentials(email, password));
            }
          },
          child: const Text('Continuer'),
        ),
      ],
    );
  }
}
