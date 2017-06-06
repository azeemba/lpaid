#/bin/bash

echo ".quit" | sqlite3 db/tartan.db -init db/schema.sql

