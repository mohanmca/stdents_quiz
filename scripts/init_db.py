import os

from dotenv import load_dotenv

from backend.app import create_app
from backend.db import db

load_dotenv()


def main():
    app = create_app()
    with app.app_context():
        db.create_all()
        print("Database tables ensured.")


if __name__ == "__main__":
    main()
