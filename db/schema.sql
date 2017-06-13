
DROP TABLE IF EXISTS users;
-- This table exists more for namespacing.
-- Not for security.
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  display_name TEXT DEFAULT 'USER'
);

DROP TABLE IF EXISTS items;
CREATE TABLE items (
  id TEXT PRIMARY KEY NOT NULL,
  access_token TEXT,
  institution_id TEXT,
  institution_name TEXT,
  user_id INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE INDEX items_user_id ON items(user_id);

DROP TABLE IF EXISTS accounts;
CREATE TABLE accounts (
  id TEXT PRIMARY KEY NOT NULL,
  item_id TEXT,
  balance INTEGER NOT NULL,
  name TEXT,
  mask TEXT, -- last 4 digits to display
  type TEXT,
  FOREIGN KEY(item_id) REFERENCES items(id)
);
CREATE INDEX accounts_item_id ON accounts(item_id);

CREATE TABLE balance_history (
  -- represents the balance history
  -- unfortunately plaid doesn't have this historical data so we have
  -- to maintain it
  date_of DATE NOT NULL,
  account_id TEXT NOT NULL,
  balance INTEGER NOT NULL,
  PRIMARY KEY(account_id, date_of),
  FOREIGN KEY(account_id) REFERENCES accounts(id)
)

DROP TABLE IF EXISTS transactions;
CREATE TABLE transactions (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  categories TEXT, -- JSON array like ["Shopping", "Electronics"]
  category_id TEXT,
  amount INTEGER NOT NULL, -- number of cents. Can be negative
  date_of DATE NOT NULL,
  location TEXT, -- JSON
  name TEXT, -- store name?
  FOREIGN KEY(account_id) REFERENCES accounts(id)
);

CREATE INDEX transactions_account_id ON transactions(account_id);
CREATE INDEX transactions_categories ON transactions(categories);
CREATE INDEX transactions_in_time    ON transactions(date_of);
