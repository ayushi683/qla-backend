from app.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("""
        ALTER TABLE product_recommendation
        ADD decided_by NVARCHAR(120) NULL
        """))
    conn.commit()
print("Column added")