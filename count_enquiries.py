import pyodbc

conn = pyodbc.connect("DRIVER={ODBC Driver 18 for SQL Server};SERVER=10.0.1.211;DATABASE=PTPLDATA;UID=sa;PWD=Ganesh&1984;TrustServerCertificate=yes;Encrypt=no;")
cursor = conn.cursor()

cursor.execute("SELECT COUNT(*) FROM QTNHEAD")
total = cursor.fetchone()[0]

cursor.execute("SELECT COUNT(*) FROM QTNHEAD WHERE QTNDT IS NULL")
pending = cursor.fetchone()[0]

cursor.execute("SELECT COUNT(*) FROM QTNHEAD WHERE QTNDT IS NOT NULL")
quoted = cursor.fetchone()[0]

print("Total quotations/enquiries in QTNHEAD:", total)
print("Pending (no quotation date yet - QTNDT IS NULL):", pending)
print("Already quoted (QTNDT filled):", quoted)

conn.close()