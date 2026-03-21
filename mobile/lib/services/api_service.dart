import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import '../config/app_config.dart';

class ApiService {
  final AppConfig _config;
  final http.Client _client;

  ApiService(this._config, [http.Client? client])
      : _client = client ?? http.Client();

  String get _baseUrl => _config.apiBaseUrl;

  Future<Map<String, String>> _headers() async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'X-App-Flavor': _config.flavorSlug,
    };
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      final token = await user.getIdToken();
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }
    }
    return headers;
  }

  // ── Config (public, no auth) ──

  Future<Map<String, dynamic>?> fetchFlavorConfig() async {
    try {
      final response = await _client.get(
        Uri.parse('$_baseUrl/api/config/${_config.flavorSlug}'),
        headers: {'X-App-Flavor': _config.flavorSlug},
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        if (body['success'] == true) {
          return body['data'] as Map<String, dynamic>;
        }
      }
    } catch (_) {
      // Offline or timeout — caller uses fallback
    }
    return null;
  }

  // ── Categories ──

  Future<List<Map<String, dynamic>>> getCategories() async {
    return _getList('/api/categories');
  }

  Future<Map<String, dynamic>?> getCategoryDetail(String slug) async {
    return _get('/api/categories/$slug');
  }

  Future<List<Map<String, dynamic>>> getSubcategories(String slug) async {
    return _getList('/api/categories/$slug/subcategories');
  }

  // ── Questions ──

  Future<List<Map<String, dynamic>>> getRandomQuestions(
    String categoryId, {
    int count = 7,
  }) async {
    final userId = FirebaseAuth.instance.currentUser?.uid;
    final params = <String, String>{
      'categoryId': categoryId,
      'count': count.toString(),
    };
    if (userId != null) params['userId'] = userId;
    return _getList('/api/questions/random', queryParams: params);
  }

  // ── Auth ──

  Future<Map<String, dynamic>?> linkAccount({
    required String username,
    required String email,
  }) async {
    return _post('/api/auth/link', {'username': username, 'email': email});
  }

  Future<Map<String, dynamic>?> getMe() async {
    return _get('/api/auth/me');
  }

  // ── Generic helpers ──

  Future<Map<String, dynamic>?> _get(String path) async {
    try {
      final response = await _client.get(
        Uri.parse('$_baseUrl$path'),
        headers: await _headers(),
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        if (body['success'] == true) return body['data'] as Map<String, dynamic>;
      }
    } catch (_) {}
    return null;
  }

  Future<List<Map<String, dynamic>>> _getList(
    String path, {
    Map<String, String>? queryParams,
  }) async {
    try {
      final uri = Uri.parse('$_baseUrl$path').replace(queryParameters: queryParams);
      final response = await _client.get(uri, headers: await _headers());
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        if (body['success'] == true && body['data'] is List) {
          return (body['data'] as List).cast<Map<String, dynamic>>();
        }
      }
    } catch (_) {}
    return [];
  }

  Future<Map<String, dynamic>?> _post(
    String path,
    Map<String, dynamic> body,
  ) async {
    try {
      final response = await _client.post(
        Uri.parse('$_baseUrl$path'),
        headers: await _headers(),
        body: jsonEncode(body),
      );
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body) as Map<String, dynamic>;
        if (decoded['success'] == true) {
          return decoded['data'] as Map<String, dynamic>;
        }
      }
    } catch (_) {}
    return null;
  }

  void dispose() {
    _client.close();
  }
}
