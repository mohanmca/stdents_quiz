from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Tuple

from flask import Blueprint, current_app, jsonify, request

from ..db import db
from ..models import QuizResult
from .auth import token_required

quizzes_bp = Blueprint("quizzes", __name__)

QUIZ_DIR = Path(__file__).resolve().parent.parent / "quizzes"


def load_quizzes() -> dict:
    quizzes = {}
    for quiz_file in QUIZ_DIR.glob("*.json"):
        with open(quiz_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            quiz_id = data.get("id") or quiz_file.stem
            quizzes[quiz_id] = data
    return quizzes


def sanitize_quiz(quiz: dict) -> dict:
    # Hide correct answers so the client only gets choices.
    questions = []
    for question in quiz.get("questions", []):
        scrubbed = {k: v for k, v in question.items() if k != "correct_option"}
        questions.append(scrubbed)
    return {
        "id": quiz.get("id"),
        "title": quiz.get("title"),
        "description": quiz.get("description"),
        "time_limit_seconds": quiz.get("time_limit_seconds"),
        "questions": questions,
    }


@quizzes_bp.route("/quizzes", methods=["GET"])
def list_quizzes() -> Tuple[dict, int]:
    quizzes = load_quizzes()
    return jsonify({"quizzes": [sanitize_quiz(q) for q in quizzes.values()]}), 200


@quizzes_bp.route("/quizzes/<quiz_id>", methods=["GET"])
def get_quiz(quiz_id: str) -> Tuple[dict, int]:
    quizzes = load_quizzes()
    quiz = quizzes.get(quiz_id)
    if not quiz:
        return jsonify({"error": "Quiz not found"}), 404
    return jsonify({"quiz": sanitize_quiz(quiz)}), 200


def calculate_score(quiz: dict, answers: Dict[str, str]) -> tuple[int, int]:
    correct = 0
    questions = quiz.get("questions", [])
    for question in questions:
        question_id = str(question.get("id"))
        if question_id in answers and answers[question_id] == question.get("correct_option"):
            correct += 1
    return correct, len(questions)


@quizzes_bp.route("/quizzes/<quiz_id>/submit", methods=["POST"])
@token_required
def submit_quiz(user, quiz_id: str) -> Tuple[dict, int]:
    payload = request.get_json() or {}
    answers = payload.get("answers") or {}
    started_at_raw = payload.get("started_at")
    completed_at_raw = payload.get("completed_at") or datetime.utcnow().isoformat()

    quizzes = load_quizzes()
    quiz = quizzes.get(quiz_id)
    if not quiz:
        return jsonify({"error": "Quiz not found"}), 404

    correct_count, total_questions = calculate_score(quiz, answers)
    score = (correct_count / total_questions) * 100 if total_questions else 0.0

    def parse_dt(value):
        if not value:
            return None
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None

    started_at = parse_dt(started_at_raw)
    completed_at = parse_dt(completed_at_raw) or datetime.utcnow()

    result = QuizResult(
        user_id=user.id,
        quiz_id=quiz.get("id") or quiz_id,
        quiz_title=quiz.get("title", "Untitled Quiz"),
        responses=answers,
        score=score,
        total_questions=total_questions,
        correct_count=correct_count,
        started_at=started_at,
        completed_at=completed_at,
    )
    db.session.add(result)
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Submission recorded",
                "result": result.to_dict(),
            }
        ),
        201,
    )


@quizzes_bp.route("/results", methods=["GET"])
@token_required
def list_results(user) -> Tuple[dict, int]:
    results = QuizResult.query.filter_by(user_id=user.id).order_by(QuizResult.created_at.desc()).all()
    return jsonify({"results": [r.to_dict() for r in results]}), 200
