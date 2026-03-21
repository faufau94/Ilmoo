class Question {
  final String id;
  final String categoryId;
  final String questionText;
  final List<String> answers;
  final int correctIndex;
  final String difficulty;
  final String? explanation;

  const Question({
    required this.id,
    required this.categoryId,
    required this.questionText,
    required this.answers,
    required this.correctIndex,
    this.difficulty = 'medium',
    this.explanation,
  });

  factory Question.fromJson(Map<String, dynamic> json) {
    return Question(
      id: json['id'] as String,
      categoryId: json['category_id'] as String,
      questionText: json['question_text'] as String,
      answers: (json['answers'] as List).cast<String>(),
      correctIndex: json['correct_index'] as int,
      difficulty: json['difficulty'] as String? ?? 'medium',
      explanation: json['explanation'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'category_id': categoryId,
        'question_text': questionText,
        'answers': answers,
        'correct_index': correctIndex,
        'difficulty': difficulty,
        'explanation': explanation,
      };
}
