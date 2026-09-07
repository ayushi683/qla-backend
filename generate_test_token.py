"""
TEST ONLY — generates a login token for any user by email, bypassing
the password requirement entirely. Use this to test category-based
filtering as a real engineer (who has no password, by design).

Usage: python generate_test_token.py mktg5@punetechtrol.com
"""
import sys
from app.database import SessionLocal
from app.models.user import AppUser
from app.security import create_access_token

email = sys.argv[1] if len(sys.argv) > 1 else "mktg5@punetechtrol.com"

db = SessionLocal()
user = db.query(AppUser).filter_by(email=email).first()
if not user:
    print(f"No user found with email {email}")
else:
    token = create_access_token(user.user_id, user.role)
    print(f"\nUser: {user.display_name} ({user.role}, category={user.category})")
    print(f"\nToken:\n{token}")
    print("\nTo use in the browser:")
    print("1. Open DevTools (F12) -> Console tab")
    print("2. Paste this exact line and press Enter:")
    print(f'   localStorage.setItem("qla_token", "{token}"); localStorage.setItem("qla_user", JSON.stringify({{"user_id":{user.user_id},"email":"{user.email}","display_name":"{user.display_name}","role":"{user.role}"}}));')
    print("3. Refresh the page (F5) — you'll be logged in as this user.")