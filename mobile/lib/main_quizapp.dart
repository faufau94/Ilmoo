import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'config/quizapp_defaults.dart';
import 'app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  runApp(QuizApp(defaults: QuizBattleDefaults.config));
}
