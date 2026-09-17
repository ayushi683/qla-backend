from app.database import SessionLocal
from app.models.user import AppUser
from app.security import hash_password

db = SessionLocal()

test_engineers = [
    ("mktg5@punetechtrol.com", "Rahul Harale", "OEM,MRO"),
    ("mktg3@punetechtrol.com", "Deepali Patharkar", "CP"),
    ("sm@punetechtrol.com", "Suvarna Munfan", "EPC,EXPORT"),
    ("mktg1@punetechtrol.com", "Samiullah Shaikh", "DISTRIBUTED_PRODUCTS"),
    ("project@punetechtrol.com", "Prakash Avhad", "PROJECT"),
    ("info@punetechtrol.com", "Sheena Damodaran", "ULTRASONIC"),
    ("mktg7@punetechtrol.com", "Manisha Bhoje", "OEM,MRO"),
    ("mktg4@punetechtrol.com", "Shweta Jagdale", "CP"),
    ("mktg6@punetechtrol.com", "Swapnil Panale", "OEM,MRO"),
]

for email, name, category in test_engineers:
    existing = db.query(AppUser).filter_by(email=email).first()
    if existing:
        existing.password_hash = hash_password("welcome123")
        existing.allow_password_login = True
        print("Updated password for: " + email)
    else:
        engineer = AppUser(
            email=email, display_name=name, role="ENGINEER", category=category,
            is_enabled=True, allow_password_login=True,
            password_hash=hash_password("welcome123"),
        )
        db.add(engineer)
        print("Created: " + email)

db.commit()
db.close()
print("Done.")