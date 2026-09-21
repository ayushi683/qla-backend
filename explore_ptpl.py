import pyodbc

conn = pyodbc.connect("DRIVER={ODBC Driver 18 for SQL Server}; SERVER=10.0.1.211;DATABASE=PTPLDATA; UID=sa;PWD=Ganesh&1984; TrustServerCertificate=yes;Encrypt=no;")
cursor=conn.cursor()

cursor.execute("SELECT name FROM sys.tables ORDER BY name")
tables = [row[0] for row in cursor.fetchall()]

with open("ptpl_tables.txt", "w") as f:
    f.write("Found " + str(len(tables)) + "tables:\n\n")
    for t in tables:
        f.write(t + "\n")

conn.close()
print("Wrote results to ptpl_tables.txt - open that file to see the list")
