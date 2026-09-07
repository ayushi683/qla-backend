import os
from datetime import datetime, timedelta, timezone

import jwt
from werkzeug.security import check_password_hash, generate_password_hash

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 12


def hash_password(password: str) -> str:
    return generate_password_hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return check_password_hash(password_hash, password)


def create_access_token(user_id: int, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {"sub": str(user_id), "role": role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


# Separate from user login: the Outlook listener is a backend SERVICE,
# not a human logging in, so it authenticates with a shared API key
# instead of a username/password + JWT. Set this in production via
# the INGESTION_API_KEY env var and give that value to whoever owns
# the Outlook listener service — do not use the same value as SECRET_KEY.
INGESTION_API_KEY = os.environ.get("INGESTION_API_KEY", "dev-ingestion-key-change-me")
