import os
from datetime import timedelta

from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS

from .config import get_config
from .db import db
from .routes.auth import auth_bp
from .routes.quizzes import quizzes_bp


load_dotenv()


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(get_config())

    CORS(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=True,
    )

    db.init_app(app)

    # Ensure tables exist on startup for simple environments. For larger projects,
    # prefer migrations.
    with app.app_context():
        db.create_all()

    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(quizzes_bp, url_prefix="/api")

    @app.route("/api/health", methods=["GET"])
    def health() -> tuple[dict, int]:
        return jsonify({"status": "ok"}), 200

    return app


if __name__ == "__main__":
    app = create_app()
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "5000"))
    app.run(host=host, port=port, debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
