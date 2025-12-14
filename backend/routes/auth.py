from datetime import datetime
from functools import wraps
from typing import Callable, Tuple

from flask import Blueprint, current_app, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash

from ..db import db
from ..models import User

auth_bp = Blueprint("auth", __name__)


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="student-quiz-auth")


def generate_token(user: User) -> str:
    return _serializer().dumps({"user_id": user.id})


def decode_token(token: str) -> int | None:
    try:
        data = _serializer().loads(token, max_age=current_app.config["TOKEN_EXPIRATION_SECONDS"])
        return int(data["user_id"])
    except (SignatureExpired, BadSignature, KeyError):
        return None


def token_required(func: Callable) -> Callable:
    @wraps(func)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authorization header missing or malformed"}), 401

        token = auth_header.split(" ", 1)[1]
        user_id = decode_token(token)
        if not user_id:
            return jsonify({"error": "Invalid or expired token"}), 401

        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        return func(user, *args, **kwargs)

    return wrapper


@auth_bp.route("/register", methods=["POST"])
def register() -> Tuple[dict, int]:
    payload = request.get_json() or {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "User already exists"}), 409

    new_user = User(email=email, password_hash=generate_password_hash(password))
    db.session.add(new_user)
    db.session.commit()

    token = generate_token(new_user)
    return jsonify({"message": "Registration successful", "token": token, "user": new_user.to_dict()}), 201


@auth_bp.route("/login", methods=["POST"])
def login() -> Tuple[dict, int]:
    payload = request.get_json() or {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password")

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password or ""):
        return jsonify({"error": "Invalid credentials"}), 401

    token = generate_token(user)
    return jsonify({"message": "Login successful", "token": token, "user": user.to_dict()}), 200


@auth_bp.route("/me", methods=["GET"])
@token_required
def me(user: User) -> Tuple[dict, int]:
    return jsonify({"user": user.to_dict()}), 200
