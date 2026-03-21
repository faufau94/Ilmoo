import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/app_config.dart';
import '../models/question.dart';
import '../theme/app_theme.dart';
import 'match_screen.dart';
import 'home_screen.dart';

class ResultScreen extends StatelessWidget {
  final String categoryName;
  final String categoryId;
  final int playerScore;
  final int botScore;
  final String botName;
  final List<Question> questions;
  final List<int?> playerAnswers;
  final List<int?> botAnswers;
  final List<int> playerPoints;
  final List<int> botPoints;

  const ResultScreen({
    super.key,
    required this.categoryName,
    required this.categoryId,
    required this.playerScore,
    required this.botScore,
    required this.botName,
    required this.questions,
    required this.playerAnswers,
    required this.botAnswers,
    required this.playerPoints,
    required this.botPoints,
  });

  bool get _playerWon => playerScore > botScore;
  bool get _isDraw => playerScore == botScore;

  @override
  Widget build(BuildContext context) {
    final config = context.read<AppConfig>();

    // Calculate XP gained
    final allCorrect = List.generate(questions.length, (i) =>
        playerAnswers[i] == questions[i].correctIndex).every((c) => c);
    int xpGained = config.xpBaseMatch;
    if (_playerWon) xpGained += config.xpWinBonus;
    if (allCorrect) xpGained += config.xpPerfectBonus;

    return Scaffold(
      body: Container(
        decoration: AppTheme.backgroundGradient(config),
        child: SafeArea(
          child: Column(
            children: [
              const SizedBox(height: 20),

              // Category
              Text(
                categoryName.toUpperCase(),
                style: TextStyle(
                  color: config.accentPositive,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 2,
                ),
              ),
              const SizedBox(height: 24),

              // Result header
              _ResultHeader(
                config: config,
                playerScore: playerScore,
                botScore: botScore,
                botName: botName,
                playerWon: _playerWon,
                isDraw: _isDraw,
              ),
              const SizedBox(height: 16),

              // XP gained
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: config.accentPositive.withAlpha(20),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '+$xpGained XP',
                  style: TextStyle(
                    color: config.accentPositive,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Round details
              Expanded(
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  itemCount: questions.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final q = questions[index];
                    final pAnswer = playerAnswers[index];
                    final pCorrect = pAnswer == q.correctIndex;
                    final pPts = playerPoints[index];
                    final bPts = botPoints[index];

                    return Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white.withAlpha(10),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: pCorrect
                              ? config.accentPositive.withAlpha(40)
                              : config.accentNegative.withAlpha(40),
                        ),
                      ),
                      child: Row(
                        children: [
                          // Round number
                          Container(
                            width: 28,
                            height: 28,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: pCorrect
                                  ? config.accentPositive.withAlpha(30)
                                  : config.accentNegative.withAlpha(30),
                            ),
                            child: Center(
                              child: Text(
                                '${index + 1}',
                                style: TextStyle(
                                  color: pCorrect
                                      ? config.accentPositive
                                      : config.accentNegative,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),

                          // Question preview
                          Expanded(
                            child: Text(
                              q.questionText,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(color: Colors.white70, fontSize: 13),
                            ),
                          ),
                          const SizedBox(width: 8),

                          // Points
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                '+$pPts',
                                style: TextStyle(
                                  color: pCorrect
                                      ? config.accentPositive
                                      : Colors.white38,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13,
                                ),
                              ),
                              Text(
                                '+$bPts',
                                style: TextStyle(
                                  color: Colors.white38,
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),

              // Action buttons
              Padding(
                padding: const EdgeInsets.all(20),
                child: Row(
                  children: [
                    // Rematch
                    Expanded(
                      child: GestureDetector(
                        onTap: () {
                          Navigator.of(context).pushReplacement(
                            MaterialPageRoute(
                              builder: (_) => MatchScreen(
                                categoryId: categoryId,
                                categoryName: categoryName,
                              ),
                            ),
                          );
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          decoration: BoxDecoration(
                            color: config.accentPositive,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Center(
                            child: Text(
                              'Revanche',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w600,
                                fontSize: 15,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Home
                    Expanded(
                      child: GestureDetector(
                        onTap: () {
                          Navigator.of(context).pushAndRemoveUntil(
                            MaterialPageRoute(builder: (_) => const HomeScreen()),
                            (route) => false,
                          );
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          decoration: BoxDecoration(
                            color: Colors.white.withAlpha(15),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.white.withAlpha(30)),
                          ),
                          child: const Center(
                            child: Text(
                              'Accueil',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w600,
                                fontSize: 15,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Result header ──

class _ResultHeader extends StatelessWidget {
  final AppConfig config;
  final int playerScore;
  final int botScore;
  final String botName;
  final bool playerWon;
  final bool isDraw;

  const _ResultHeader({
    required this.config,
    required this.playerScore,
    required this.botScore,
    required this.botName,
    required this.playerWon,
    required this.isDraw,
  });

  @override
  Widget build(BuildContext context) {
    final resultText = isDraw
        ? 'Égalité !'
        : playerWon
            ? 'Victoire !'
            : 'Défaite';

    final resultColor = isDraw
        ? Colors.white
        : playerWon
            ? config.accentPositive
            : config.accentNegative;

    return Column(
      children: [
        // Result icon
        Icon(
          isDraw
              ? Icons.handshake_outlined
              : playerWon
                  ? Icons.emoji_events_outlined
                  : Icons.sentiment_dissatisfied_outlined,
          size: 56,
          color: resultColor,
        ),
        const SizedBox(height: 12),

        // Result text
        Text(
          resultText,
          style: TextStyle(
            color: resultColor,
            fontSize: 28,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 16),

        // Score comparison
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              '$playerScore',
              style: TextStyle(
                color: Colors.white,
                fontSize: 40,
                fontWeight: FontWeight.bold,
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                '–',
                style: TextStyle(color: Colors.white38, fontSize: 32),
              ),
            ),
            Text(
              '$botScore',
              style: TextStyle(
                color: Colors.white54,
                fontSize: 40,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),

        // vs text
        Text(
          'vs $botName',
          style: TextStyle(color: Colors.white38, fontSize: 14),
        ),
      ],
    );
  }
}
