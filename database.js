const Database = require('better-sqlite3');
const path = require('path');

// Open a SQLite database file
const dbPath = path.resolve(__dirname, 'tasks.db');
const db = new Database(dbPath, { verbose: console.log });

// Create the table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Check if the tasks table is empty
const rowCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get();

if (rowCount.count === 0) {
  console.log('Seeding initial tasks into database...');
  const insert = db.prepare('INSERT INTO tasks (title, done, created_at, updated_at) VALUES (?, ?, ?, ?)');
  
  // Use a transaction for inserting the sample tasks
  const insertMany = db.transaction((tasks) => {
    const now = new Date().toISOString();
    for (const task of tasks) {
      insert.run(task.title, task.done ? 1 : 0, now, now);
    }
  });

  insertMany([
    { title: 'Buy milk', done: 0 },
    { title: 'Clean the room', done: 1 },
    { title: 'Prepare for API assignment', done: 0 }
  ]);
}

module.exports = db;
