#/bin/bash

echo ".quit" | sqlite3 db/tartan.db -init db/schema.sql
echo ".quit" | sqlite3 db/tartan.db -init db/migration/20170917.sql
echo ".quit" | sqlite3 db/tartan.db -init db/migration/20190228.sql
