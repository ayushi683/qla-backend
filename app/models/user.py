"""App users, login methods, and permission grants.

Auth rules
----------
- ADMIN: may log in with email+password OR Outlook / Microsoft Graph (OAuth).
- All other roles: Outlook / Microsoft Graph only (no password).
- Admin enables/disables users and grants/revokes permissions.
- Never store plain passwords or Outlook tokens in these tables;
  password_hash only; tokens live in secure session / Key Vault store.
"""

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, utcnow


class AppUser(Base):
    """QLA application user (engineer portal / admin console)."""

    __tablename__ = "app_user"
    __table_args__ = (
        # Temporarily allowing password login for all roles
        # suggestion, until Outlook/Azure credentials are available.
        # Once Outlook login is implemented, this can be tightened back
        # to admin-only password login if needed.
    )

    user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="ENGINEER", index=True)
    category: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    # e.g. "OEM_MRO", "CP", "EPC_EXPORT" — comma-separated if more than one.
    # Matches the real business categories at Techtrol (not geography).

    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    # Admin toggles this — disabled users cannot log in

    allow_password_login: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # True only for ADMIN (email + password path)
    allow_outlook_login: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Outlook / Microsoft identity — required for non-admin; also allowed for admin

    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # bcrypt/argon2 hash; NULL for Outlook-only users

    outlook_oid: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    # Microsoft Entra object id (oid) from Outlook / Graph token
    outlook_tenant_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    outlook_upn: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # User principal name from token when different from email

    party_id: Mapped[int | None] = mapped_column(
        ForeignKey("party.party_id"), nullable=True, index=True
    )
    # Optional link to party (e.g. PREBY engineer)

    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login_method: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # PASSWORD | OUTLOOK

    disabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    disabled_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("app_user.user_id"), nullable=True
    )
    disable_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("app_user.user_id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    permissions: Mapped[list["UserPermission"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="UserPermission.user_id",
    )
    login_events: Mapped[list["UserLoginEvent"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="UserLoginEvent.user_id",
    )


class Permission(Base):
    """Permission catalogue — what admin can grant to users."""

    __tablename__ = "permission"

    permission_code: Mapped[str] = mapped_column(String(60), primary_key=True)
    # e.g. USER_MANAGE, CASE_VIEW, CASE_APPROVE, PRICE_VIEW, PRICE_EDIT, QUOTE_SEND
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    category: Mapped[str | None] = mapped_column(String(40), nullable=True)
    # USER | CASE | PRICE | QUOTE | PORTAL | ADMIN | AUDIT
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    grants: Mapped[list["UserPermission"]] = relationship(back_populates="permission")


class UserPermission(Base):
    """Admin-assigned permission grant (or revoke) for a user."""

    __tablename__ = "user_permission"
    __table_args__ = (
        UniqueConstraint("user_id", "permission_code", name="uq_user_permission"),
    )

    user_permission_id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False, index=True
    )
    permission_code: Mapped[str] = mapped_column(
        ForeignKey("permission.permission_code"), nullable=False, index=True
    )
    is_granted: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # False = explicit deny override if needed later
    granted_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("app_user.user_id"), nullable=True
    )
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    note: Mapped[str | None] = mapped_column(String(300), nullable=True)

    user: Mapped[AppUser] = relationship(
        back_populates="permissions", foreign_keys=[user_id]
    )
    permission: Mapped[Permission] = relationship(back_populates="grants")


class UserLoginEvent(Base):
    """Login attempt audit (success/fail) — no secrets stored."""

    __tablename__ = "user_login_event"

    login_event_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("app_user.user_id", ondelete="SET NULL"), nullable=True, index=True
    )
    email_attempted: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    login_method: Mapped[str] = mapped_column(String(20), nullable=False)
    # PASSWORD | OUTLOOK
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    failure_reason: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # DISABLED | BAD_PASSWORD | METHOD_NOT_ALLOWED | UNKNOWN_USER | OUTLOOK_TOKEN_INVALID
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[AppUser | None] = relationship(
        back_populates="login_events", foreign_keys=[user_id]
    )
