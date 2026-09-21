import pyodbc

conn = pyodbc.connect("DRIVER={ODBC Driver 18 for SQL Server};SERVER=10.0.1.211;DATABASE=PTPLDATA;UID=sa;PWD=Ganesh&1984;TrustServerCertificate=yes;Encrypt=no;")
cursor = conn.cursor()

lines = []
for table in ["DOCU_IN", "DOCU_OUT", "InternalDocument", "GenLtrs", "RevFileWith"]:
    lines.append("=== " + table + " ===")
    try:
        cursor.execute("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ?", table)
        cols = cursor.fetchall()
        col_list = ", ".join([c[0] + ":" + c[1] for c in cols])
        lines.append("COLUMNS: " + col_list)

        cursor.execute("SELECT TOP 1 * FROM " + table)
        row = cursor.fetchone()
        if row:
            col_names = [d[0] for d in cursor.description]
            sample = ", ".join([cn + "=" + str(val) for cn, val in zip(col_names, row)])
            lines.append("SAMPLE: " + sample)
        else:
            lines.append("SAMPLE: (table is empty)")
    except Exception as e:
        lines.append("ERROR: " + str(e))
    lines.append("")

output = "\n".join(lines)
with open("docs_structure.txt", "w", encoding="utf-8") as f:
    f.write(output)

conn.close()
print("Wrote to docs_structure.txt")