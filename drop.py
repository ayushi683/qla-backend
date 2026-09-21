from app.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("ALTER TABLE app_user DROP CONSTRAINT ck_app_user_password_admin_only"))
    conn.commit()
print("Constraint dropped successfully.")