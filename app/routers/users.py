from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.user import AppUser
from app.schemas import UserListOut, UserCreateRequest, UserUpdateRequest

router = APIRouter(prefix="/api/users", tags=["users"])


def require_admin(current_user: AppUser = Depends(get_current_user)) -> AppUser:
    if current_user.role != "ADMIN":
        raise HTTPException(403, "Only ADMIN can manage users.")
    return current_user


@router.get("", response_model=list[UserListOut], dependencies=[Depends(require_admin)])
def list_users(db: Session = Depends(get_db)):
    users = db.query(AppUser).order_by(AppUser.created_at.desc()).all()
    return [UserListOut.model_validate(u) for u in users]


@router.post("", response_model=UserListOut, dependencies=[Depends(require_admin)])
def create_user(payload: UserCreateRequest, db: Session = Depends(get_db)):
    if payload.role not in ("ADMIN", "ENGINEER"):
        raise HTTPException(400, "Role must be ADMIN or ENGINEER.")
    if db.query(AppUser).filter_by(email=payload.email.strip().lower()).first():
        raise HTTPException(409, "A user with this email already exists.")

    user = AppUser(
        email=payload.email.strip().lower(),
        display_name=payload.display_name,
        role=payload.role,
        category=payload.category.strip() if payload.category else None,
        is_enabled=True,
        allow_password_login=(payload.role == "ADMIN"),
        allow_outlook_login=True,
        password_hash=None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserListOut.model_validate(user)


@router.patch("/{user_id}", response_model=UserListOut, dependencies=[Depends(require_admin)])
def update_user(user_id: int, payload: UserUpdateRequest, db: Session = Depends(get_db)):
    user = db.get(AppUser, user_id)
    if user is None:
        raise HTTPException(404, "User not found.")

    if payload.role is not None:
        if payload.role not in ("ADMIN", "ENGINEER"):
            raise HTTPException(400, "Role must be ADMIN or ENGINEER.")
        user.role = payload.role
        user.allow_password_login = (payload.role == "ADMIN")
        if payload.role != "ADMIN":
            user.password_hash = None

    if payload.is_enabled is not None:
        user.is_enabled = payload.is_enabled

    if payload.category is not None:
        user.category = payload.category.strip() or None

    db.commit()
    db.refresh(user)
    return UserListOut.model_validate(user)

@router.delete("/{user_id}", dependencies=[Depends(require_admin)])
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: AppUser = Depends(get_current_user)):
    if user_id == current_user.user_id:
        raise HTTPException(400, "You cannot delete your own account.")

    user = db.get(AppUser, user_id)
    if user is None:
        raise HTTPException(404, "User not found.")

    db.delete(user)
    db.commit()
    return {"status": "deleted", "user_id": user_id}

