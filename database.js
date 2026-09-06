const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'premmos.db');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database at', dbPath);
  }
});

db.serialize(() => {
  // Settings table
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY,
      channel_name TEXT DEFAULT 'premmo''s cave',
      channel_description TEXT DEFAULT 'A local community simulator',
      member_count INTEGER DEFAULT 24388,
      view_probability REAL DEFAULT 0.45,
      reaction_probability REAL DEFAULT 0.25,
      reply_probability REAL DEFAULT 0.08,
      simulation_speed REAL DEFAULT 1.0,
      min_views INTEGER DEFAULT 12483,
      min_reactions INTEGER DEFAULT 8234,
      reaction_delay INTEGER DEFAULT 10,
      randomness REAL DEFAULT 0.5,
      available_emojis TEXT DEFAULT '❤️,👍,🔥,😍,💯,😎,😭,🤯,👏,🥶,😈,👀,🙏,⭐,✨,🥰,😘'
    )
  `);

  // Initialize settings if empty
  db.run(`
    INSERT OR IGNORE INTO settings (id) VALUES (1)
  `);

  // Members table
  db.run(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE,
      display_name TEXT,
      bio TEXT,
      avatar TEXT,
      join_date TEXT,
      last_seen TEXT,
      activity_score REAL DEFAULT 0.5,
      view_probability REAL DEFAULT 0.45,
      reaction_probability REAL DEFAULT 0.25,
      reply_probability REAL DEFAULT 0.08,
      is_online INTEGER DEFAULT 0,
      total_views INTEGER DEFAULT 0,
      total_reactions INTEGER DEFAULT 0,
      total_replies INTEGER DEFAULT 0
    )
  `);

  // Posts table
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY,
      author_id INTEGER,
      text TEXT,
      image_url TEXT,
      timestamp TEXT,
      views INTEGER DEFAULT 0,
      created_at TEXT
    )
  `);

  // Reactions table
  db.run(`
    CREATE TABLE IF NOT EXISTS reactions (
      id INTEGER PRIMARY KEY,
      post_id INTEGER,
      reaction_type TEXT,
      count INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY(post_id) REFERENCES posts(id)
    )
  `);

  // Reply count tracking
  db.run(`
    CREATE TABLE IF NOT EXISTS reply_counts (
      id INTEGER PRIMARY KEY,
      post_id INTEGER,
      reply_count INTEGER DEFAULT 0,
      updated_at TEXT,
      FOREIGN KEY(post_id) REFERENCES posts(id)
    )
  `);

  // Simulation stats
  db.run(`
    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY,
      timestamp TEXT,
      online_count INTEGER,
      new_members INTEGER,
      total_views INTEGER,
      total_reactions INTEGER
    )
  `);

  // Post engagement tracking
  db.run(`
    CREATE TABLE IF NOT EXISTS post_engagement (
      id INTEGER PRIMARY KEY,
      post_id INTEGER UNIQUE,
      created_at TEXT,
      engagement_started_at TEXT,
      target_views INTEGER,
      target_reactions INTEGER,
      selected_emojis TEXT,
      emoji_distribution TEXT,
      is_active INTEGER DEFAULT 1,
      last_updated TEXT,
      FOREIGN KEY(post_id) REFERENCES posts(id)
    )
  `);

  // Telegram posts tracking (maps real Telegram posts to local simulations)
  db.run(`
    CREATE TABLE IF NOT EXISTS telegram_posts (
      id INTEGER PRIMARY KEY,
      telegram_message_id INTEGER UNIQUE,
      telegram_chat_id INTEGER,
      real_post_timestamp TEXT,
      real_post_text TEXT,
      real_post_media_type TEXT,
      local_simulation_id INTEGER,
      created_at TEXT,
      FOREIGN KEY(local_simulation_id) REFERENCES posts(id)
    )
  `);

  // Telegram bot state tracking (for duplicate prevention and reconnection)
  db.run(`
    CREATE TABLE IF NOT EXISTS telegram_bot_state (
      id INTEGER PRIMARY KEY,
      last_telegram_update_id INTEGER,
      last_update_time TEXT
    )
  `);

  // Initialize bot state if empty
  db.run(`
    INSERT OR IGNORE INTO telegram_bot_state (id, last_telegram_update_id, last_update_time)
    VALUES (1, 0, datetime('now'))
  `);
});

// Promisify database methods
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = {
  db,
  dbRun,
  dbGet,
  dbAll
};
