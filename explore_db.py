import pyodbc

conn = pyodbc.connect("DRIVER={ODBC Driver 18 for SQL Server}; SERVER=10.0.1.211;DATABASE=QLA_ADMIN_DB; UID=sa;PWD=Ganesh&1984; TrustServerCertificate=yes;Encrypt=no;")
cursor=conn.cursor()

cursor.execute("""" SELECT t.name AS table_name, p.rows AS row_count FROM sys.tables t JOIN sys.partitions p ON t.object_id=p.object_id AND p.index_id IN (0,1) ORDER BY t.name """)
tables = cursor.fetchall()

print("Found" + str(len(tables)) + "tables in PTPLDATA:\n")

for row in tables:
    line= " "+str(row.table_name)+ "--" +str(row.row_count)+"rows"
    print(line )

conn.close