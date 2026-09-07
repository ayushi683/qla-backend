from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.user import AppUser, UserLoginEvent
from app.schemas import LoginRequest, TokenResponse, UserOut
from app.security import verify_password, create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(AppUser).filter_by(email=email).first()

    event = UserLoginEvent(
        user_id=user.user_id if user else None,
        email_attempted=email,
        login_method="PASSWORD",
        success=False,
    )

    def fail(reason: str, message: str):
        event.failure_reason = reason
        db.add(event)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=message)

    if user is None:
        fail("UNKNOWN_USER", "Invalid email or password.")
    if not user.allow_password_login or user.role != "ADMIN":
        # Same rule as the DB check constraint: only ADMIN may use a password.
        fail("METHOD_NOT_ALLOWED", "This account must sign in via Outlook.")
    if not user.is_enabled:
        fail("DISABLED", "This account has been disabled.")
    if not user.password_hash or not verify_password(payload.password, user.password_hash):
        fail("BAD_PASSWORD", "Invalid email or password.")

    event.success = True
    user.last_login_at = datetime.now(timezone.utc)
    user.last_login_method = "PASSWORD"
    db.add(event)
    db.commit()

    token = create_access_token(user.user_id, user.role)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user: AppUser = Depends(get_current_user)):
    return UserOut.model_validate(current_user)
