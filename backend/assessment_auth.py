import os
import time
import sqlite3
from typing import Optional
from pathlib import Path
from fastapi import Header, HTTPException, status

_db_env = os.getenv("DATABASE_PATH", "auth.db")
DB_PATH = Path(__file__).resolve().parent / _db_env if not os.path.isabs(_db_env) else Path(_db_env)


class AuthenticatedUser:
    def __init__(self, user_id: str, email: str, name: str):
        self.id = user_id
        self.user_id = user_id
        self.email = email
        self.name = name

    def __str__(self) -> str:
        return self.email

    def __repr__(self) -> str:
        return f"AuthenticatedUser(id={self.id}, email={self.email})"

def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=20)
    conn.row_factory = sqlite3.Row
    return conn

def current_user(authorization: Optional[str] = Header(None)) -> AuthenticatedUser:
    """
    Dependency to validate session token and retrieve authenticated user.
    Enforces server-side authentication without relying on client-supplied identity.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in."
        )

    token = authorization.split(" ")[1].strip()
    now = time.time()

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT user_id, email, expires_at FROM sessions WHERE token = ?",
            (token,)
        )
        session = cursor.fetchone()

        if not session or session["expires_at"] < now:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session has expired or is invalid. Please sign in again."
            )

        cursor.execute(
            "SELECT id, name, email FROM users WHERE id = ?",
            (session["user_id"],)
        )
        user = cursor.fetchone()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Authenticated user account not found."
            )

        return AuthenticatedUser(
            user_id=user["id"],
            email=user["email"],
            name=user["name"]
        )
    finally:
        conn.close()
