import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/app_config.dart';
import '../models/question.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import 'result_screen.dart';

class MatchScreen extends StatefulWidget {
  final String categoryId;
  final String categoryName;

  const MatchScreen({
    super.key,
    required this.categoryId,
    required this.categoryName,
  });

  @override
  State<MatchScreen> createState() => _MatchScreenState();
}

class _MatchScreenState extends State<MatchScreen>
    with TickerProviderStateMixin {
  late AppConfig _config;

  // Match state
  List<Question> _questions = [];
  bool _loading = true;
  int _currentRound = 0;
  int _playerScore = 0;
  int _botScore = 0;
  final List<int?> _playerAnswers = [];
  final List<int?> _botAnswers = [];
  final List<int> _playerPoints = [];
  final List<int> _botPoints = [];

  // Round state
  int? _selectedAnswer;
  bool _answered = false;
  int _answerTimeMs = 0;
  late Stopwatch _stopwatch;

  // Timer
  late AnimationController _timerController;

  // Bot
  final _random = Random();
  String _botName = '';
  int _botLevel = 1;

  @override
  void initState() {
    super.initState();
    _config = context.read<AppConfig>();
    _timerController = AnimationController(
      vsync: this,
      duration: Duration(seconds: _config.timerSeconds),
    );
    _timerController.addStatusListener((status) {
      if (status == AnimationStatus.completed && !_answered) {
        _onTimeout();
      }
    });
    _stopwatch = Stopwatch();
    _generateBot();
    _loadQuestions();
  }

  void _generateBot() {
    const names = [
      'Alex_M', 'Sara_K', 'Youssef_A', 'Lina_B', 'Omar_Z',
      'Ines_T', 'Karim_H', 'Nadia_R', 'Mehdi_S', 'Fatima_L',
    ];
    _botName = names[_random.nextInt(names.length)];
    _botLevel = _random.nextInt(40) + 10;
  }

  Future<void> _loadQuestions() async {
    final api = context.read<ApiService>();
    final data = await api.getRandomQuestions(
      widget.categoryId,
      count: _config.roundCount,
    );

    if (!mounted) return;

    if (data.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Pas encore de questions dans cette catégorie'),
          backgroundColor: _config.accentNegative,
        ),
      );
      Navigator.pop(context);
      return;
    }

    setState(() {
      _questions = data.map((e) => Question.fromJson(e)).toList();
      _loading = false;
    });

    _startRound();
  }

  void _startRound() {
    _selectedAnswer = null;
    _answered = false;
    _stopwatch.reset();
    _stopwatch.start();
    _timerController.forward(from: 0);
  }

  void _onTimeout() {
    if (_answered) return;
    _stopwatch.stop();
    _answerTimeMs = _config.timerSeconds * 1000;
    _processAnswer(null);
  }

  void _onAnswerTap(int index) {
    if (_answered) return;
    _stopwatch.stop();
    _answerTimeMs = _stopwatch.elapsedMilliseconds;
    _selectedAnswer = index;
    _processAnswer(index);
  }

  void _processAnswer(int? playerAnswer) {
    final question = _questions[_currentRound];
    final isCorrect = playerAnswer == question.correctIndex;

    // Calculate player points
    int playerPts = 0;
    if (isCorrect) {
      final isBonus = _currentRound == _config.roundCount - 1 && _config.bonusRoundEnabled;
      final maxPts = isBonus ? _config.pointsBonusRound : _config.pointsPerRound;
      final timeFactor = 1 - _answerTimeMs / (_config.timerSeconds * 1000);
      playerPts = (maxPts * timeFactor * _config.speedWeight +
              maxPts * _config.baseWeight)
          .round();
      if (playerPts < _config.minCorrectPoints) {
        playerPts = _config.minCorrectPoints;
      }
    }

    // Bot answer (random, ~60% chance correct)
    int botAnswer;
    if (_random.nextDouble() < 0.6) {
      botAnswer = question.correctIndex;
    } else {
      botAnswer = _random.nextInt(4);
    }
    final botCorrect = botAnswer == question.correctIndex;
    int botPts = 0;
    if (botCorrect) {
      final botTime = _random.nextInt((_config.timerSeconds * 800).round()) + 500;
      final isBonus = _currentRound == _config.roundCount - 1 && _config.bonusRoundEnabled;
      final maxPts = isBonus ? _config.pointsBonusRound : _config.pointsPerRound;
      final timeFactor = 1 - botTime / (_config.timerSeconds * 1000);
      botPts = (maxPts * timeFactor * _config.speedWeight +
              maxPts * _config.baseWeight)
          .round();
      if (botPts < _config.minCorrectPoints) botPts = _config.minCorrectPoints;
    }

    setState(() {
      _answered = true;
      _timerController.stop();
      _playerAnswers.add(playerAnswer);
      _botAnswers.add(botAnswer);
      _playerPoints.add(playerPts);
      _botPoints.add(botPts);
      _playerScore += playerPts;
      _botScore += botPts;
    });

    // Auto advance after delay
    Future.delayed(const Duration(milliseconds: 2000), () {
      if (!mounted) return;
      if (_currentRound < _questions.length - 1) {
        setState(() => _currentRound++);
        _startRound();
      } else {
        _showResults();
      }
    });
  }

  void _showResults() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => ResultScreen(
          categoryName: widget.categoryName,
          categoryId: widget.categoryId,
          playerScore: _playerScore,
          botScore: _botScore,
          botName: _botName,
          questions: _questions,
          playerAnswers: _playerAnswers,
          botAnswers: _botAnswers,
          playerPoints: _playerPoints,
          botPoints: _botPoints,
        ),
      ),
    );
  }

  @override
  void dispose() {
    _timerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        body: Container(
          decoration: AppTheme.backgroundGradient(_config),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircularProgressIndicator(color: _config.accentPositive),
                const SizedBox(height: 20),
                Text(
                  'Chargement des questions...',
                  style: TextStyle(color: Colors.white54, fontSize: 15),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final question = _questions[_currentRound];

    return Scaffold(
      body: Container(
        decoration: AppTheme.backgroundGradient(_config),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              children: [
                const SizedBox(height: 8),

                // Category name
                Text(
                  widget.categoryName.toUpperCase(),
                  style: TextStyle(
                    color: _config.accentPositive,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 2,
                  ),
                ),
                const SizedBox(height: 16),

                // Players header
                _PlayersHeader(
                  config: _config,
                  playerScore: _playerScore,
                  botScore: _botScore,
                  botName: _botName,
                  botLevel: _botLevel,
                ),
                const SizedBox(height: 16),

                // Round dots
                _RoundDots(
                  config: _config,
                  totalRounds: _questions.length,
                  currentRound: _currentRound,
                  playerAnswers: _playerAnswers,
                  questions: _questions,
                ),
                const SizedBox(height: 12),

                // Timer bar
                AnimatedBuilder(
                  animation: _timerController,
                  builder: (context, _) {
                    return _TimerBar(
                      config: _config,
                      progress: 1 - _timerController.value,
                    );
                  },
                ),
                const SizedBox(height: 24),

                // Question card
                _QuestionCard(
                  config: _config,
                  question: question,
                  roundNumber: _currentRound + 1,
                  totalRounds: _questions.length,
                ),
                const SizedBox(height: 20),

                // Answer buttons
                Expanded(
                  child: ListView.separated(
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: question.answers.length,
                    separatorBuilder: (context, index) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      return _AnswerButton(
                        config: _config,
                        label: String.fromCharCode(65 + index), // A, B, C, D
                        text: question.answers[index],
                        index: index,
                        correctIndex: question.correctIndex,
                        selectedAnswer: _selectedAnswer,
                        botAnswer: _answered ? _botAnswers.last : null,
                        answered: _answered,
                        points: _answered && _selectedAnswer == index && index == question.correctIndex
                            ? _playerPoints.last
                            : null,
                        botName: _botName,
                        onTap: () => _onAnswerTap(index),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Players header with avatars and scores ──

class _PlayersHeader extends StatelessWidget {
  final AppConfig config;
  final int playerScore;
  final int botScore;
  final String botName;
  final int botLevel;

  const _PlayersHeader({
    required this.config,
    required this.playerScore,
    required this.botScore,
    required this.botName,
    required this.botLevel,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        // Player 1
        _PlayerAvatar(
          initials: 'ME',
          name: 'Moi',
          level: 1,
          color: config.accentPositive,
        ),

        // Scores
        Row(
          children: [
            Text(
              '$playerScore',
              style: TextStyle(
                color: Colors.white,
                fontSize: 32,
                fontWeight: FontWeight.bold,
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Text(
                '–',
                style: TextStyle(color: Colors.white38, fontSize: 28),
              ),
            ),
            Text(
              '$botScore',
              style: TextStyle(
                color: config.accentPositive,
                fontSize: 32,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),

        // Player 2 (bot)
        _PlayerAvatar(
          initials: botName.length >= 2
              ? '${botName[0]}${botName.contains('_') ? botName.split('_').last[0] : botName[1]}'
              : botName,
          name: botName,
          level: botLevel,
          color: const Color(0xFFCD8032), // Bronze/orange
        ),
      ],
    );
  }
}

class _PlayerAvatar extends StatelessWidget {
  final String initials;
  final String name;
  final int level;
  final Color color;

  const _PlayerAvatar({
    required this.initials,
    required this.name,
    required this.level,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: color, width: 2.5),
            color: color.withAlpha(25),
          ),
          child: Center(
            child: Text(
              initials.toUpperCase(),
              style: TextStyle(
                color: color,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          name,
          style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
        ),
        Text(
          'Niveau $level',
          style: TextStyle(color: Colors.white54, fontSize: 11),
        ),
      ],
    );
  }
}

// ── Round indicator dots ──

class _RoundDots extends StatelessWidget {
  final AppConfig config;
  final int totalRounds;
  final int currentRound;
  final List<int?> playerAnswers;
  final List<Question> questions;

  const _RoundDots({
    required this.config,
    required this.totalRounds,
    required this.currentRound,
    required this.playerAnswers,
    required this.questions,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(totalRounds, (i) {
        Color dotColor;
        if (i < playerAnswers.length) {
          final correct = playerAnswers[i] == questions[i].correctIndex;
          dotColor = correct ? config.accentPositive : config.accentNegative;
        } else if (i == currentRound) {
          dotColor = Colors.white;
        } else {
          dotColor = Colors.white24;
        }

        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: dotColor,
          ),
        );
      }),
    );
  }
}

// ── Timer bar ──

class _TimerBar extends StatelessWidget {
  final AppConfig config;
  final double progress; // 1.0 = full, 0.0 = empty

  const _TimerBar({required this.config, required this.progress});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 6,
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(15),
        borderRadius: BorderRadius.circular(3),
      ),
      child: FractionallySizedBox(
        alignment: Alignment.centerLeft,
        widthFactor: progress.clamp(0, 1),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(3),
            gradient: LinearGradient(
              colors: [config.accentPositive, config.accentPositive.withAlpha(150)],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Question card ──

class _QuestionCard extends StatelessWidget {
  final AppConfig config;
  final Question question;
  final int roundNumber;
  final int totalRounds;

  const _QuestionCard({
    required this.config,
    required this.question,
    required this.roundNumber,
    required this.totalRounds,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(15),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withAlpha(20)),
      ),
      child: Column(
        children: [
          Text(
            'Question $roundNumber/$totalRounds',
            style: TextStyle(color: config.accentPositive.withAlpha(180), fontSize: 13),
          ),
          const SizedBox(height: 12),
          Text(
            question.questionText,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 17,
              fontWeight: FontWeight.w600,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Answer button ──

class _AnswerButton extends StatelessWidget {
  final AppConfig config;
  final String label; // A, B, C, D
  final String text;
  final int index;
  final int correctIndex;
  final int? selectedAnswer;
  final int? botAnswer;
  final bool answered;
  final int? points;
  final String botName;
  final VoidCallback onTap;

  const _AnswerButton({
    required this.config,
    required this.label,
    required this.text,
    required this.index,
    required this.correctIndex,
    required this.selectedAnswer,
    required this.botAnswer,
    required this.answered,
    required this.points,
    required this.botName,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    Color borderColor = Colors.white.withAlpha(20);
    Color labelBg = Colors.white.withAlpha(20);
    Color labelColor = Colors.white54;
    String? trailingText;

    if (answered) {
      if (index == correctIndex) {
        // Correct answer
        borderColor = config.accentPositive;
        labelBg = config.accentPositive;
        labelColor = Colors.white;
        if (selectedAnswer == index && points != null) {
          trailingText = '+$points pts';
        }
      } else if (index == selectedAnswer && index != correctIndex) {
        // Player chose wrong
        borderColor = config.accentNegative;
        labelBg = config.accentNegative;
        labelColor = Colors.white;
      }
      // Show bot's wrong answer
      if (index == botAnswer && botAnswer != correctIndex) {
        borderColor = config.accentNegative.withAlpha(150);
        trailingText = botName;
      }
    }

    return GestureDetector(
      onTap: answered ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white.withAlpha(10),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: borderColor, width: answered ? 1.5 : 1),
        ),
        child: Row(
          children: [
            // Letter circle
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: labelBg,
              ),
              child: Center(
                child: Text(
                  label,
                  style: TextStyle(
                    color: labelColor,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),

            // Answer text
            Expanded(
              child: Text(
                text,
                style: const TextStyle(color: Colors.white, fontSize: 15),
              ),
            ),

            // Trailing (points or bot name)
            if (trailingText != null)
              Text(
                trailingText,
                style: TextStyle(
                  color: index == correctIndex
                      ? config.accentPositive
                      : config.accentNegative,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
