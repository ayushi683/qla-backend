import pyodbc

SERVER = "10.0.1.211"
DATABASE = "PTPLDATA"
USERNAME = "sa"
PASSWORD = "Ganesh&1984"

conn_str = (
    f"DRIVER={{ODBC Driver 18 for SQL Server}};"
    f"SERVER={SERVER};"
    f"DATABASE={DATABASE};"
    f"UID={USERNAME};"
    f"PWD={PASSWORD};"
    f"Connection Timeout=5;"
    f"Encrypt=no;"
    f"TrustServerCertificate=yes;"
)

try:
    print("Connecting...")
    conn = pyodbc.connect(conn_str)
    print("✅ SUCCESS — connected to the database!")
    cursor = conn.cursor()
    cursor.execute("SELECT @@VERSION")
    row = cursor.fetchone()
    print("SQL Server version:", row[0])
    conn.close()
except Exception as e:
    print("❌ FAILED to connect.")
    print("Error:", e)