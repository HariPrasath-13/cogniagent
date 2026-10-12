import os
import sys
import time
import secrets
import requests
import smtplib
import sqlite3
import hashlib
import hmac
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from pathlib import Path
from contextlib import asynccontextmanager

# Ensure both project root and backend directory are in sys.path
_current_dir = Path(__file__).resolve().parent
_root_dir = _current_dir.parent
if str(_root_dir) not in sys.path:
    sys.path.insert(0, str(_root_dir))
if str(_current_dir) not in sys.path:
    sys.path.insert(0, str(_current_dir))

from fastapi import FastAPI, HTTPException, status, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))


PORT = int(os.getenv("PORT", "8000"))
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
SECRET_KEY = os.getenv("SECRET_KEY", "cogniagent-development-secret-key-9876543210")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "fakeharish13@gmail.com")
SENDER_APP_PASSWORD = os.getenv("SENDER_APP_PASSWORD", "")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "CogniAgent <onboarding@resend.dev>")
DATABASE_PATH = os.path.join(os.path.dirname(__file__), os.getenv("DATABASE_PATH", "auth.db"))


OTP_EXPIRY_SECONDS = 300  # 5 minutes
OTP_COOLDOWN_SECONDS = 60  # 1 minute between resends
MAX_OTP_ATTEMPTS = 3

# ----------------- Database Setup -----------------
def init_db():
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    # Users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            is_verified INTEGER DEFAULT 0,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        )
    """)
    # OTPs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS otps (
            email TEXT PRIMARY KEY,
            otp_code TEXT NOT NULL,
            otp_type TEXT NOT NULL, -- 'registration' or 'login'
            expires_at REAL NOT NULL,
            attempts INTEGER DEFAULT 0,
            last_sent_at REAL NOT NULL
        )
    """)
    # Sessions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            email TEXT NOT NULL,
            created_at REAL NOT NULL,
            expires_at REAL NOT NULL
        )
    """)
    conn.commit()
    conn.close()

def get_db():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# ----------------- Security Helpers -----------------
def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()
    return f"{salt}${key}"

def verify_password(stored_password_hash: str, provided_password: str) -> bool:
    try:
        salt, key = stored_password_hash.split('$')
        new_key = hashlib.pbkdf2_hmac(
            'sha256',
            provided_password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        ).hex()
        return hmac.compare_digest(key, new_key)
    except Exception:
        return False

def generate_otp() -> str:
    # 6-digit numeric OTP
    return f"{secrets.randbelow(900000) + 100000}"

def create_session_token(user_id: str, email: str) -> str:
    token = secrets.token_urlsafe(32)
    conn = get_db()
    cursor = conn.cursor()
    now = time.time()
    expires_at = now + (86400 * 7)  # 7 days
    cursor.execute(
        "INSERT INTO sessions (token, user_id, email, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
        (token, user_id, email, now, expires_at)
    )
    conn.commit()
    conn.close()
    return token

# ----------------- Email Delivery Helper -----------------
def send_email_otp(recipient_email: str, otp_code: str, purpose: str = "Verification") -> tuple[bool, str]:
    """
    Delivers OTP code to recipient via configured email providers.
    Order of preference:
      1. Resend HTTP API (if RESEND_API_KEY is configured)
      2. Gmail SMTP via STARTTLS/SSL (if SENDER_APP_PASSWORD and SENDER_EMAIL are configured)
    Returns (True, message) on success, or (False, safe_error_message) on failure.
    Security: NEVER returns the OTP in failure messages.
    """
    subject = f"Your CogniAgent {purpose} Code"
    body_text = f"""Hello,

Your CogniAgent {purpose.lower()} code is:

    {otp_code}

This code will expire in 5 minutes. If you did not request this code, you can safely ignore this email.

— The CogniAgent Team
"""
    body_html = f"""<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px;">
  <div style="max-width: 480px; margin: auto; background-color: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0; text-align: center;">
    <h2 style="color: #4f46e5; margin-bottom: 8px;">CogniAgent</h2>
    <p style="color: #64748b; font-size: 14px; margin-top: 0;">AI-Powered Personalized Learning</p>
    <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
    <p style="color: #1e293b; font-size: 16px; font-weight: 600;">Your {purpose} Code</p>
    <div style="background-color: #f1f5f9; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #4338ca;">
      {otp_code}
    </div>
    <p style="color: #64748b; font-size: 13px;">This code will expire in <strong>5 minutes</strong>.</p>
    <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">If you did not request this email, please disregard it.</p>
  </div>
</body>
</html>"""

    delivery_errors = []

    # Priority 1: Resend HTTP API (Independent of SMTP password)
    if RESEND_API_KEY and RESEND_API_KEY.strip():
        try:
            resend_payload = {
                "from": RESEND_FROM_EMAIL or f"CogniAgent <onboarding@resend.dev>",
                "to": [recipient_email],
                "subject": f"Your CogniAgent {purpose} Code: {otp_code}",
                "html": body_html,
                "text": body_text
            }
            resp = requests.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY.strip()}",
                    "Content-Type": "application/json"
                },
                json=resend_payload,
                timeout=8
            )
            if resp.status_code in (200, 201):
                print(f"[AUTH RESEND] OTP email dispatched to {recipient_email} via Resend", flush=True)
                return True, "Verification email delivered to your inbox."
            else:
                err_data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
                err_msg = err_data.get("message", resp.text)
                print(f"[AUTH RESEND WARNING] HTTP {resp.status_code}: {err_msg}", flush=True)
                delivery_errors.append(f"Resend HTTP {resp.status_code}: {err_msg}")
        except Exception as rex:
            print(f"[AUTH RESEND ERROR] {rex}", flush=True)
            delivery_errors.append(f"Resend request error: {str(rex)}")

    # Priority 2: Direct SMTP (Gmail)
    if SENDER_APP_PASSWORD and SENDER_APP_PASSWORD.strip() and SENDER_EMAIL and SENDER_EMAIL.strip():
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Your CogniAgent {purpose} Code: {otp_code}"
        msg["From"] = f"CogniAgent <{SENDER_EMAIL}>"
        msg["To"] = recipient_email
        msg.attach(MIMEText(body_text, "plain"))
        msg.attach(MIMEText(body_html, "html"))

        # Attempt: Port 587 (STARTTLS)
        try:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=6) as server:
                server.starttls()
                server.login(SENDER_EMAIL, SENDER_APP_PASSWORD)
                server.sendmail(SENDER_EMAIL, recipient_email, msg.as_string())
            print(f"[AUTH SMTP] OTP email sent to {recipient_email} via SMTP (587)", flush=True)
            return True, "Verification email sent successfully."
        except Exception as e:
            print(f"[AUTH SMTP] Port 587 failed: {e}. Trying SSL port 465...", flush=True)
            delivery_errors.append(f"SMTP 587: {str(e)}")

        # Attempt: Port 465 (Direct SSL)
        try:
            with smtplib.SMTP_SSL(SMTP_HOST, 465, timeout=6) as server:
                server.login(SENDER_EMAIL, SENDER_APP_PASSWORD)
                server.sendmail(SENDER_EMAIL, recipient_email, msg.as_string())
            print(f"[AUTH SMTP] OTP email sent to {recipient_email} via SSL (465)", flush=True)
            return True, "Verification email sent successfully via SSL (465)."
        except Exception as e:
            print(f"[AUTH SMTP ERROR] Port 465 failed: {e}", flush=True)
            delivery_errors.append(f"SMTP 465: {str(e)}")

    # Failure: Log diagnostic server-side only; NEVER expose the OTP code to client
    err_summary = "; ".join(delivery_errors) if delivery_errors else "No email provider configured"
    print(f"[AUTH EMAIL FAILED] Could not send OTP to {recipient_email}. Reason: {err_summary}", flush=True)
    return False, "Unable to deliver email verification code. Please check your email configuration or click resend."

from fastapi.openapi.docs import get_swagger_ui_html

# ----------------- Lifespan -----------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(
    title="CogniAgent API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url="/redoc"
)

# CORS setup
allowed_origins_env = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
origins = list(set([FRONTEND_ORIGIN, "http://localhost:3000", "http://127.0.0.1:3000"] + allowed_origins_env))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|.*\.vercel\.app)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": "CogniAgent API", "version": "1.0.0"}


@app.get("/api/debug-ai", tags=["Health"])
def debug_ai():
    groq_key = os.getenv("GROQ_API_KEY", "").strip()
    resend_key = os.getenv("RESEND_API_KEY", "").strip()

    groq_test = "No key"
    if groq_key:
        try:
            r_models = requests.get(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": f"Bearer {groq_key}"},
                timeout=5
            )
            available = [m.get("id") for m in r_models.json().get("data", [])] if r_models.status_code == 200 else []
            # Choose best available model
            preferred = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
            test_model = "openai/gpt-oss-120b"
            for p in preferred:
                if p in available:
                    test_model = p
                    break

            r = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                json={
                    "model": test_model,
                    "messages": [
                        {"role": "system", "content": "You are a helpful assistant."},
                        {"role": "user", "content": "ping"}
                    ],
                    "temperature": 0.1
                },
                timeout=10
            )
            groq_test = {
                "tested_model": test_model,
                "status_code": r.status_code,
                "available_models": available,
                "body": r.json() if r.status_code == 200 else r.text[:250]
            }
        except Exception as e:
            groq_test = f"Exception: {str(e)}"

    return {
        "groq_key_configured": bool(groq_key),
        "groq_key_preview": (groq_key[:7] + "..." + groq_key[-4:]) if len(groq_key) > 11 else "invalid_length",
        "groq_test": groq_test,
        "resend_key_configured": bool(resend_key)
    }





@app.get("/docs", include_in_schema=False)
def custom_swagger_ui_html():
    return get_swagger_ui_html(
        openapi_url="/openapi.json",
        title="CogniAgent API - Swagger Documentation",
        swagger_js_url="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.js",
        swagger_css_url="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css",
        swagger_favicon_url="https://fastapi.tiangolo.com/img/favicon.png",
    )


# ----------------- Pydantic Models -----------------
class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)

class VerifyRegistrationRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class SendLoginOtpRequest(BaseModel):
    email: EmailStr

class VerifyLoginOtpRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=6)

class ResendOtpRequest(BaseModel):
    email: EmailStr
    otp_type: Optional[str] = "registration"

# ----------------- API Endpoints -----------------

@app.get("/health")
def health_check():
    has_app_password = bool(SENDER_APP_PASSWORD and SENDER_APP_PASSWORD.strip())
    has_resend = bool(RESEND_API_KEY and RESEND_API_KEY.strip())
    is_ready = has_resend or has_app_password
    return {
        "status": "healthy",
        "service": "CogniAgent Authentication Backend",
        "authorized_sender": SENDER_EMAIL,
        "smtp_configured": has_app_password,
        "resend_configured": has_resend,
        "message": (
            "Backend is running. Email delivery is configured."
            if is_ready
            else "Backend is running. Note: No email provider configured."
        )
    }

@app.post("/register")
def register_user(req: RegisterRequest):
    email = req.email.strip().lower()
    name = req.name.strip()
    now = time.time()

    conn = get_db()
    cursor = conn.cursor()

    # Check if user already exists
    cursor.execute("SELECT id, is_verified FROM users WHERE email = ?", (email,))
    existing_user = cursor.fetchone()

    if existing_user and existing_user["is_verified"] == 1:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please sign in."
        )

    # Check rate limit on OTP
    cursor.execute("SELECT last_sent_at FROM otps WHERE email = ?", (email,))
    existing_otp = cursor.fetchone()
    if existing_otp and (now - existing_otp["last_sent_at"]) < OTP_COOLDOWN_SECONDS:
        remaining = int(OTP_COOLDOWN_SECONDS - (now - existing_otp["last_sent_at"]))
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {remaining} seconds before requesting another verification code."
        )

    pwd_hash = hash_password(req.password)
    otp_code = generate_otp()
    expires_at = now + OTP_EXPIRY_SECONDS

    # Create or update unverified user
    if existing_user:
        user_id = existing_user["id"]
        cursor.execute(
            "UPDATE users SET name = ?, password_hash = ?, updated_at = ? WHERE id = ?",
            (name, pwd_hash, now, user_id)
        )
    else:
        user_id = secrets.token_hex(16)
        cursor.execute(
            "INSERT INTO users (id, name, email, password_hash, is_verified, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)",
            (user_id, name, email, pwd_hash, now, now)
        )

    # Store OTP
    cursor.execute(
        """
        INSERT INTO otps (email, otp_code, otp_type, expires_at, attempts, last_sent_at)
        VALUES (?, ?, 'registration', ?, 0, ?)
        ON CONFLICT(email) DO UPDATE SET
            otp_code = excluded.otp_code,
            otp_type = excluded.otp_type,
            expires_at = excluded.expires_at,
            attempts = 0,
            last_sent_at = excluded.last_sent_at
        """,
        (email, otp_code, expires_at, now)
    )
    conn.commit()
    conn.close()

    # Send email
    email_sent, email_msg = send_email_otp(email, otp_code, purpose="Registration Verification")

    return {
        "success": True,
        "message": f"Verification code sent to {email}." if email_sent else "Account created, but verification email could not be delivered. Please click resend.",
        "email": email,
        "email_sent": email_sent,
        "delivery_notice": None if email_sent else "Verification email could not be delivered. Please verify your email address or click Resend."
    }

@app.post("/verify-registration")
def verify_registration(req: VerifyRegistrationRequest):
    email = req.email.strip().lower()
    otp_input = req.otp.strip()
    now = time.time()

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM otps WHERE email = ? AND otp_type = 'registration'", (email,))
    otp_record = cursor.fetchone()

    if not otp_record:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending registration found for this email. Please sign up first."
        )

    if now > otp_record["expires_at"]:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code."
        )

    if otp_record["attempts"] >= MAX_OTP_ATTEMPTS:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many invalid attempts. Please request a new verification code."
        )

    if otp_record["otp_code"] != otp_input:
        cursor.execute("UPDATE otps SET attempts = attempts + 1 WHERE email = ?", (email,))
        conn.commit()
        remaining = MAX_OTP_ATTEMPTS - (otp_record["attempts"] + 1)
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid verification code. {remaining} attempt(s) remaining."
        )

    # Mark user as verified
    cursor.execute("SELECT id, name FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    cursor.execute("UPDATE users SET is_verified = 1, updated_at = ? WHERE email = ?", (now, email))
    # Delete verified OTP
    cursor.execute("DELETE FROM otps WHERE email = ?", (email,))
    conn.commit()

    token = create_session_token(user["id"], email)
    conn.close()

    return {
        "success": True,
        "message": "Email successfully verified. You are now logged in.",
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": email
        }
    }

@app.post("/login")
def login_with_password(req: LoginRequest):
    email = req.email.strip().lower()
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id, name, email, password_hash, is_verified FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    conn.close()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    if not verify_password(user["password_hash"], req.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    if user["is_verified"] != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before logging in."
        )

    token = create_session_token(user["id"], email)

    return {
        "success": True,
        "message": "Login successful.",
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"]
        }
    }

@app.post("/send-login-otp")
def send_login_otp(req: SendLoginOtpRequest):
    email = req.email.strip().lower()
    now = time.time()

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id, name, is_verified FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()

    if not user:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account registered with this email. Please sign up."
        )

    if user["is_verified"] != 1:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has not been verified yet. Please complete registration verification."
        )

    # Check cooldown
    cursor.execute("SELECT last_sent_at FROM otps WHERE email = ?", (email,))
    existing_otp = cursor.fetchone()
    if existing_otp and (now - existing_otp["last_sent_at"]) < OTP_COOLDOWN_SECONDS:
        remaining = int(OTP_COOLDOWN_SECONDS - (now - existing_otp["last_sent_at"]))
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {remaining} seconds before requesting a new login code."
        )

    otp_code = generate_otp()
    expires_at = now + OTP_EXPIRY_SECONDS

    cursor.execute(
        """
        INSERT INTO otps (email, otp_code, otp_type, expires_at, attempts, last_sent_at)
        VALUES (?, ?, 'login', ?, 0, ?)
        ON CONFLICT(email) DO UPDATE SET
            otp_code = excluded.otp_code,
            otp_type = excluded.otp_type,
            expires_at = excluded.expires_at,
            attempts = 0,
            last_sent_at = excluded.last_sent_at
        """,
        (email, otp_code, expires_at, now)
    )
    conn.commit()
    conn.close()

    email_sent, email_msg = send_email_otp(email, otp_code, purpose="Sign-In")

    return {
        "success": True,
        "message": f"Login code sent to {email}." if email_sent else "Login code generated, but email could not be delivered. Please click resend.",
        "email": email,
        "email_sent": email_sent,
        "delivery_notice": None if email_sent else "Email could not be delivered. Please verify your connection or click Resend."
    }

@app.post("/verify-login-otp")
def verify_login_otp(req: VerifyLoginOtpRequest):
    email = req.email.strip().lower()
    otp_input = req.otp.strip()
    now = time.time()

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM otps WHERE email = ? AND otp_type = 'login'", (email,))
    otp_record = cursor.fetchone()

    if not otp_record:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active login code request found. Please request a new code."
        )

    if now > otp_record["expires_at"]:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Login code has expired. Please request a new code."
        )

    if otp_record["attempts"] >= MAX_OTP_ATTEMPTS:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many invalid attempts. Please request a new code."
        )

    if otp_record["otp_code"] != otp_input:
        cursor.execute("UPDATE otps SET attempts = attempts + 1 WHERE email = ?", (email,))
        conn.commit()
        remaining = MAX_OTP_ATTEMPTS - (otp_record["attempts"] + 1)
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid login code. {remaining} attempt(s) remaining."
        )

    cursor.execute("SELECT id, name FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    cursor.execute("DELETE FROM otps WHERE email = ?", (email,))
    conn.commit()

    token = create_session_token(user["id"], email)
    conn.close()

    return {
        "success": True,
        "message": "Login verified successfully.",
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": email
        }
    }

@app.get("/me")
def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

    token = authorization.split(" ")[1]
    now = time.time()

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT user_id, email, expires_at FROM sessions WHERE token = ?",
        (token,)
    )
    session = cursor.fetchone()

    if not session or session["expires_at"] < now:
        conn.close()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired or invalid.")

    cursor.execute("SELECT id, name, email FROM users WHERE id = ?", (session["user_id"],))
    user = cursor.fetchone()
    conn.close()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    return {
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"]
        }
    }

@app.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    email = req.email.strip().lower()
    now = time.time()

    conn = get_db()
    cursor = conn.cursor()

    # Look up user
    cursor.execute("SELECT id, name, is_verified FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()

    if user:
        # Check rate limit (30s cooldown between requests)
        cursor.execute("SELECT last_sent_at FROM otps WHERE email = ? AND otp_type = 'password_reset'", (email,))
        existing_otp = cursor.fetchone()
        if existing_otp and (now - existing_otp["last_sent_at"]) < 30:
            conn.close()
            return {
                "success": True,
                "message": "If an account exists with this email, a password reset code has been sent."
            }

        otp_code = generate_otp()
        expires_at = now + OTP_EXPIRY_SECONDS

        cursor.execute(
            """
            INSERT INTO otps (email, otp_code, otp_type, expires_at, attempts, last_sent_at)
            VALUES (?, ?, 'password_reset', ?, 0, ?)
            ON CONFLICT(email) DO UPDATE SET
                otp_code = excluded.otp_code,
                otp_type = excluded.otp_type,
                expires_at = excluded.expires_at,
                attempts = 0,
                last_sent_at = excluded.last_sent_at
            """,
            (email, otp_code, expires_at, now)
        )
        conn.commit()
        conn.close()

        # Send email with reset OTP
        send_email_otp(email, otp_code, purpose="Password Reset")
    else:
        conn.close()

    # Generic security message: never reveal whether account exists
    return {
        "success": True,
        "message": "If an account exists with this email, a password reset code has been sent."
    }

@app.post("/reset-password")
def reset_password(req: ResetPasswordRequest):
    email = req.email.strip().lower()
    otp_input = req.otp.strip()
    new_password = req.new_password.strip()
    now = time.time()

    if len(new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM otps WHERE email = ? AND otp_type = 'password_reset'", (email,))
    otp_record = cursor.fetchone()

    if not otp_record:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active password reset request found for this email. Please request a new code."
        )

    if now > otp_record["expires_at"]:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset code has expired. Please request a new reset code."
        )

    if otp_record["attempts"] >= MAX_OTP_ATTEMPTS:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many invalid attempts. Please request a new password reset code."
        )

    if otp_record["otp_code"] != otp_input:
        cursor.execute("UPDATE otps SET attempts = attempts + 1 WHERE email = ?", (email,))
        conn.commit()
        remaining = MAX_OTP_ATTEMPTS - (otp_record["attempts"] + 1)
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid verification code. {remaining} attempt(s) remaining."
        )

    cursor.execute("SELECT id, name FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User account not found.")

    # Update password and mark verified
    new_hash = hash_password(new_password)
    cursor.execute(
        "UPDATE users SET password_hash = ?, is_verified = 1, updated_at = ? WHERE email = ?",
        (new_hash, now, email)
    )

    # Delete used reset OTP
    cursor.execute("DELETE FROM otps WHERE email = ?", (email,))

    # Invalidate all prior sessions for security
    cursor.execute("DELETE FROM sessions WHERE user_id = ? OR email = ?", (user["id"], email))
    conn.commit()
    conn.close()

    return {
        "success": True,
        "message": "Password has been reset successfully. Please log in with your new password."
    }

@app.post("/logout")
def logout_user(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1].strip()
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
        conn.close()
    return {"success": True, "message": "Logged out successfully."}

@app.post("/resend-otp")
def resend_otp(req: ResendOtpRequest):
    email = req.email.strip().lower()
    otp_type = (req.otp_type or "registration").strip().lower()
    now = time.time()

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id, name, is_verified FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()

    if not user:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email."
        )

    # Check cooldown (30 seconds)
    cursor.execute("SELECT last_sent_at FROM otps WHERE email = ?", (email,))
    existing_otp = cursor.fetchone()
    if existing_otp and (now - existing_otp["last_sent_at"]) < 30:
        remaining = int(30 - (now - existing_otp["last_sent_at"]))
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {remaining} seconds before requesting a new verification code."
        )

    otp_code = generate_otp()
    expires_at = now + OTP_EXPIRY_SECONDS

    cursor.execute(
        """
        INSERT INTO otps (email, otp_code, otp_type, expires_at, attempts, last_sent_at)
        VALUES (?, ?, ?, ?, 0, ?)
        ON CONFLICT(email) DO UPDATE SET
            otp_code = excluded.otp_code,
            otp_type = excluded.otp_type,
            expires_at = excluded.expires_at,
            attempts = 0,
            last_sent_at = excluded.last_sent_at
        """,
        (email, otp_code, otp_type, expires_at, now)
    )
    conn.commit()
    conn.close()

    email_sent, email_msg = send_email_otp(email, otp_code, purpose="Verification")

    return {
        "success": True,
        "message": f"Verification code sent to {email}." if email_sent else "Code regenerated, but email could not be delivered. Please check email provider configuration.",
        "email_sent": email_sent
    }

# ----------------- Assessment Router -----------------
try:
    from backend.assessment import router as assessment_router
except ImportError:
    from assessment import router as assessment_router

app.include_router(assessment_router)

