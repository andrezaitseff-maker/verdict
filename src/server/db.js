const Database = require("better-sqlite3");

function createDb() {
  const path = process.env.VERDICT_DB_PATH || "./verdict.sqlite";
  const db = new Database(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      payload TEXT NOT NULL,
      result TEXT NOT NULL
    );
  `);
  return db;
}

module.exports = { createDb };
