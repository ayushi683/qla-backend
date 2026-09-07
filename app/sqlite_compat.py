"""
The shared schema (app/models/*) uses BigInteger for primary keys,
which is correct for a real production DB (Postgres/MySQL/etc).

On SQLite specifically, a primary key column must compile to the exact
type "INTEGER" for SQLite to treat it as an alias for its internal
rowid and auto-increment it. BigInteger compiles to "BIGINT" by
default, which breaks autoincrement on SQLite only.

This file patches ONLY the sqlite DDL compilation of BigInteger to
render as INTEGER. It does not change the model files, and has no
effect on any other database engine (Postgres, MySQL, etc. still get
proper BIGINT). Import this once, before db.create_all() runs.
"""

from sqlalchemy import BigInteger
from sqlalchemy.ext.compiler import compiles


@compiles(BigInteger, "sqlite")
def _bigint_as_integer_on_sqlite(type_, compiler, **kw):
    return "INTEGER"
