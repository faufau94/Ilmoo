import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'api_service.dart';

class AuthService {
  final FirebaseAuth _auth;
  final ApiService _api;

  AuthService(this._api, [FirebaseAuth? auth])
      : _auth = auth ?? FirebaseAuth.instance;

  User? get currentUser => _auth.currentUser;
  bool get isAnonymous => _auth.currentUser?.isAnonymous ?? true;
  bool get isLinked => !isAnonymous;

  /// First launch: create an anonymous Firebase account.
  Future<User> signInAnonymous() async {
    final credential = await _auth.signInAnonymously();
    return credential.user!;
  }

  /// Link the current anonymous account to a Google credential.
  Future<User> linkWithGoogle() async {
    final googleUser = await GoogleSignIn().signIn();
    if (googleUser == null) throw Exception('Google sign-in cancelled');

    final googleAuth = await googleUser.authentication;
    final credential = GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );

    final result = await _auth.currentUser!.linkWithCredential(credential);
    final user = result.user!;

    // Notify backend
    await _api.linkAccount(
      username: '', // will be set by the username picker screen
      email: user.email ?? '',
    );

    return user;
  }

  /// Link the current anonymous account to email/password.
  Future<User> linkWithEmail(String email, String password) async {
    final credential = EmailAuthProvider.credential(
      email: email,
      password: password,
    );

    final result = await _auth.currentUser!.linkWithCredential(credential);
    final user = result.user!;

    // Notify backend
    await _api.linkAccount(
      username: '', // will be set by the username picker screen
      email: email,
    );

    return user;
  }

  Future<User?> getCurrentUser() async {
    return _auth.currentUser;
  }

  Future<void> signOut() async {
    await _auth.signOut();
  }
}
