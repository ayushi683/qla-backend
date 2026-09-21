import pyodbc

conn = pyodbc.connect("DRIVER={ODBC Driver 18 for SQL Server}; SERVER=10.0.1.211;DATABASE=PTPLDATA; UID=sa;PWD=Ganesh&1984; TrustServerCertificate=yes;Encrypt=no;")
cursor=conn.cursor()

with open("enquiry_structure.txt", "w", encoding="utf-8") as f:
    for table in ["EnqHead", "EnqDtl", "MSTCUST", "QTNHEAD"]:
        f.write("=" *60 + "\n")
        f.write("TABLE: " + table + "\n")
        f.write("=" * 60 + "\n")

        cursor.execute("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ?", table)
        cols = cursor.fetchall()
        f.write("Columns:\n")
        for c in cols:
            f.write(" " +c[0] + "(" +c[1] + ")\n")

        cursor.execute("SELECT TOP 2 * FROM " + table)
        rows = cursor.fetchall()
        col_names = [d[0] for d in cursor.description]
        f.write("\nSample rows:\n")
        for row in rows:
            for cn, val in zip(col_names, row):
                f.write(" "+ cn+":" + str(val) + "\n")
            f.write("--\n")
        f.write("\n\n")

conn.close()
print("Wrote to enquiry_structure")
