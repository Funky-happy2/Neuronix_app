// One-off additive migration for the quests / trade-chat / login-code / news-admin-tag
// features. Only CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS — never destructive.
// Run with: DATABASE_URL=... node server/migrate-new-tables.cjs
const pg = require("pg");

const sql = `
ALTER TABLE news_posts ADD COLUMN IF NOT EXISTS author_is_admin boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS quest_posts (
  id serial PRIMARY KEY,
  poster_id integer NOT NULL,
  poster_name text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  reward_coins integer NOT NULL DEFAULT 0,
  reward_gems integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  assignee_id integer,
  assignee_name text,
  created_at text NOT NULL,
  completed_at text
);

CREATE TABLE IF NOT EXISTS quest_messages (
  id serial PRIMARY KEY,
  quest_id integer NOT NULL,
  sender_id integer NOT NULL,
  sender_name text NOT NULL,
  content text NOT NULL,
  created_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS trade_messages (
  id serial PRIMARY KEY,
  trade_id integer NOT NULL,
  sender_id integer NOT NULL,
  sender_name text NOT NULL,
  content text NOT NULL,
  created_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS login_codes (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  user_id integer NOT NULL,
  created_by_id integer NOT NULL,
  created_by_name text NOT NULL,
  expires_at text NOT NULL,
  used_at text,
  created_at text NOT NULL
);
`;

(async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(sql);
    console.log("Migration applied: news_posts.author_is_admin + quest_posts, quest_messages, trade_messages, login_codes");
  } catch (e) {
    console.error("Migration failed:", e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
