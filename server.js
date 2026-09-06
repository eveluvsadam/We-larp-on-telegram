const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const dotenv = require('dotenv');
const { dbRun, dbGet, dbAll } = require('./database');
const simulator = require('./simulator');
const telegramBot = require('./telegram-bot');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes

// Get dashboard stats
app.get('/api/stats', async (req, res) => {
  try {
    const memberCount = await dbGet('SELECT COUNT(*) as count FROM members');
    const onlineCount = await dbGet('SELECT COUNT(*) as count FROM members WHERE is_online = 1');
    const totalViews = await dbGet('SELECT COALESCE(SUM(views), 0) as total FROM posts');
    const totalReactions = await dbGet('SELECT COALESCE(SUM(count), 0) as total FROM reactions');
    const postCount = await dbGet('SELECT COUNT(*) as count FROM posts');

    // Count new members today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();
    const newMembersToday = await dbGet('SELECT COUNT(*) as count FROM members WHERE join_date > ?', [todayStr]);

    // Calculate engagement rate
    const engagementRate = memberCount.count > 0 ? ((totalReactions.total / memberCount.count) * 100).toFixed(2) : 0;

    // Get last 24 hours of stats
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const activityData = await dbAll(
      'SELECT timestamp, online_count FROM stats WHERE timestamp > ? ORDER BY timestamp ASC LIMIT 100',
      [yesterday]
    );

    res.json({
      memberCount: memberCount.count,
      onlineCount: onlineCount.count,
      totalViews: totalViews.total,
      totalReactions: totalReactions.total,
      engagementRate: parseFloat(engagementRate),
      newMembersToday: newMembersToday.count,
      postCount: postCount.count,
      activityData: activityData,
      isSimulationRunning: simulator.isSimulationRunning()
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get settings
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await simulator.getSettings();
    res.json(settings);
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update settings
app.post('/api/settings', async (req, res) => {
  try {
    const {
      channel_name, channel_description, member_count,
      simulation_speed, min_views, min_reactions,
      reaction_delay, randomness, available_emojis
    } = req.body;

    const updates = {};
    if (channel_name !== undefined) updates.channel_name = channel_name;
    if (channel_description !== undefined) updates.channel_description = channel_description;
    if (member_count !== undefined) updates.member_count = member_count;
    if (simulation_speed !== undefined) {
      updates.simulation_speed = simulation_speed;
      simulator.setSimulationSpeed(simulation_speed);
    }
    if (min_views !== undefined) updates.min_views = min_views;
    if (min_reactions !== undefined) updates.min_reactions = min_reactions;
    if (reaction_delay !== undefined) updates.reaction_delay = reaction_delay;
    if (randomness !== undefined) updates.randomness = randomness;
    if (available_emojis !== undefined) updates.available_emojis = available_emojis;

    await simulator.updateSettings(updates);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create post
app.post('/api/posts', async (req, res) => {
  try {
    const { text, imageUrl } = req.body;

    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Post text is required' });
    }

    const result = await dbRun(
      'INSERT INTO posts (author_id, text, image_url, timestamp, created_at) VALUES (?, ?, ?, ?, ?)',
      [1, text, imageUrl || null, new Date().toISOString(), new Date().toISOString()]
    );

    // Initialize post engagement with realistic numbers
    await simulator.initializePostEngagement(result.id);

    // Start simulation if not already running
    if (!simulator.isSimulationRunning()) {
      await simulator.startSimulation();
    }

    res.json({ success: true, postId: result.id });
  } catch (err) {
    console.error('Error creating post:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get posts
app.get('/api/posts', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = 20;
    const offset = page * limit;

    const posts = await dbAll(
      `SELECT p.*, COALESCE(rc.reply_count, 0) as reply_count
       FROM posts p
       LEFT JOIN reply_counts rc ON p.id = rc.post_id
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    // Get reactions for each post
    for (const post of posts) {
      const reactions = await dbAll(
        'SELECT reaction_type, count FROM reactions WHERE post_id = ? AND count > 0 ORDER BY count DESC',
        [post.id]
      );
      post.reactions = reactions;
    }

    const totalCount = await dbGet('SELECT COUNT(*) as count FROM posts');

    res.json({
      posts,
      totalCount: totalCount.count,
      page,
      limit
    });
  } catch (err) {
    console.error('Error fetching posts:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single post
app.get('/api/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const post = await dbGet(
      `SELECT p.*, COALESCE(rc.reply_count, 0) as reply_count
       FROM posts p
       LEFT JOIN reply_counts rc ON p.id = rc.post_id
       WHERE p.id = ?`,
      [id]
    );

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const reactions = await dbAll(
      'SELECT reaction_type, count FROM reactions WHERE post_id = ? ORDER BY count DESC',
      [id]
    );

    const engagementStatus = await simulator.getPostEngagementStatus(id);

    post.reactions = reactions;
    post.engagement = engagementStatus;

    res.json(post);
  } catch (err) {
    console.error('Error fetching post:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get post engagement status
app.get('/api/posts/:id/engagement', async (req, res) => {
  try {
    const { id } = req.params;
    const status = await simulator.getPostEngagementStatus(id);

    if (!status) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json(status);
  } catch (err) {
    console.error('Error fetching engagement status:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get members
app.get('/api/members', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const search = req.query.search || '';
    const limit = 50;
    const offset = page * limit;

    let query = 'SELECT * FROM members';
    let params = [];

    if (search) {
      query += ' WHERE display_name LIKE ? OR username LIKE ?';
      const searchPattern = `%${search}%`;
      params = [searchPattern, searchPattern];
    }

    const countQuery = search
      ? 'SELECT COUNT(*) as count FROM members WHERE display_name LIKE ? OR username LIKE ?'
      : 'SELECT COUNT(*) as count FROM members';

    const countResult = await dbGet(countQuery, params);

    query += ' ORDER BY activity_score DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const members = await dbAll(query, params);

    res.json({
      members,
      totalCount: countResult.count,
      page,
      limit
    });
  } catch (err) {
    console.error('Error fetching members:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start simulation
app.post('/api/simulation/start', async (req, res) => {
  try {
    await simulator.startSimulation();
    res.json({ success: true, message: 'Simulation started' });
  } catch (err) {
    console.error('Error starting simulation:', err);
    res.status(500).json({ error: err.message });
  }
});

// Stop simulation
app.post('/api/simulation/stop', async (req, res) => {
  try {
    await simulator.stopSimulation();
    res.json({ success: true, message: 'Simulation stopped' });
  } catch (err) {
    console.error('Error stopping simulation:', err);
    res.status(500).json({ error: err.message });
  }
});

// Reset simulation
app.post('/api/simulation/reset', async (req, res) => {
  try {
    // Stop simulation
    if (simulator.isSimulationRunning()) {
      await simulator.stopSimulation();
    }

    // Clear all data
    await dbRun('DELETE FROM posts');
    await dbRun('DELETE FROM reactions');
    await dbRun('DELETE FROM reply_counts');
    await dbRun('DELETE FROM stats');
    await dbRun('DELETE FROM members');

    // Update online counts to 0
    await dbRun('UPDATE members SET is_online = 0');

    res.json({ success: true, message: 'Simulation reset. Please reseed members.' });
  } catch (err) {
    console.error('Error resetting simulation:', err);
    res.status(500).json({ error: err.message });
  }
});

// Telegram bot status
app.get('/api/telegram/status', async (req, res) => {
  try {
    const status = await telegramBot.getBotStatus();
    res.json(status);
  } catch (err) {
    console.error('Error getting telegram status:', err);
    res.status(500).json({ error: err.message });
  }
});

// Test Telegram connection
app.post('/api/telegram/test', async (req, res) => {
  try {
    const status = await telegramBot.getBotStatus();
    res.json({
      success: status.connected,
      message: status.connected ? '🟢 Telegram connection working' : '🔴 Telegram connection failed',
      status
    });
  } catch (err) {
    console.error('Error testing telegram connection:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create test post (without Telegram)
app.post('/api/test/create-post', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Post text is required' });
    }

    const result = await dbRun(
      'INSERT INTO posts (author_id, text, timestamp, created_at) VALUES (?, ?, ?, ?)',
      [1, text, new Date().toISOString(), new Date().toISOString()]
    );

    // Initialize post engagement
    await simulator.initializePostEngagement(result.id);

    // Start simulation if not already running
    if (!simulator.isSimulationRunning()) {
      await simulator.startSimulation();
    }

    res.json({
      success: true,
      postId: result.id,
      message: 'Test post created. Engagement will start in 10 seconds.'
    });
  } catch (err) {
    console.error('Error creating test post:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get posts with telegram source info
app.get('/api/posts/with-source', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = 20;
    const offset = page * limit;

    const posts = await dbAll(
      `SELECT p.*, tp.telegram_message_id, tp.real_post_text,
              CASE WHEN tp.id IS NOT NULL THEN 'telegram' ELSE 'local' END as source
       FROM posts p
       LEFT JOIN telegram_posts tp ON p.id = tp.local_simulation_id
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    // Get reactions for each post
    for (const post of posts) {
      const reactions = await dbAll(
        'SELECT reaction_type, count FROM reactions WHERE post_id = ? AND count > 0 ORDER BY count DESC',
        [post.id]
      );
      post.reactions = reactions;
    }

    const totalCount = await dbGet('SELECT COUNT(*) as count FROM posts');

    res.json({
      posts,
      totalCount: totalCount.count,
      page,
      limit
    });
  } catch (err) {
    console.error('Error fetching posts with source:', err);
    res.status(500).json({ error: err.message });
  }
});

// Reseed members
app.post('/api/simulation/reseed', async (req, res) => {
  try {
    const { count } = req.body;
    const memberCount = count || 20000;

    // Delete existing members
    await dbRun('DELETE FROM members');

    const firstNames = [
      'Alex', 'Jordan', 'Taylor', 'Casey', 'Morgan', 'Riley', 'Quinn', 'Avery',
      'Sky', 'Phoenix', 'Blake', 'Drew', 'Sydney', 'Vale', 'Gray', 'Dana',
      'Devon', 'Lane', 'Elliott', 'Fox', 'Harper', 'Rory', 'Scout', 'Sage',
      'Storm', 'River', 'Dakota', 'Brooklyn', 'Austin', 'Echo', 'Jorie', 'Cody'
    ];

    const lastNames = [
      'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
      'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
      'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
      'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Young'
    ];

    const adjectives = [
      'swift', 'cosmic', 'neon', 'cyber', 'void', 'blaze', 'frost', 'echo',
      'quantum', 'solar', 'lunar', 'ghost', 'shadow', 'crystal', 'pixel',
      'binary', 'hologram', 'plasma', 'nebula', 'storm', 'silent', 'mystic',
      'ethereal', 'spectral', 'phantom', 'chrome', 'prism', 'vortex'
    ];

    const nouns = [
      'phoenix', 'dragon', 'wolf', 'tiger', 'eagle', 'serpent', 'raven', 'kitsune',
      'cipher', 'sentinel', 'vanguard', 'nexus', 'forge', 'beacon', 'oracle',
      'matrix', 'vector', 'spectre', 'phantom', 'wraith', 'shadow', 'echo',
      'whisper', 'silence', 'thunder', 'inferno', 'glacier', 'obsidian', 'onyx'
    ];

    const bios = [
      '📱 Tech enthusiast | 🎮 Gamer | ☕ Coffee lover',
      'Developer | Open source contributor | Love anime',
      '🎨 Designer | Photographer | Travel addict',
      'Student | Music producer | Always learning',
      '🚀 Startup founder | Investor | Entrepreneur',
      '📚 Reader | Writer | Philosophy nerd',
      '🎬 Film enthusiast | Cinephile | Movie reviewer',
      '🏋️ Fitness | Health | Wellness advocate',
      '🌍 Digital nomad | Traveler | Explorer',
      '💻 Code monkey | Linux fan | Open source',
      '🎵 Musician | Composer | Audio engineer',
      '📸 Photographer | Visual artist | Creator',
      '🌱 Eco-friendly | Sustainability advocate | Green living',
      '🎓 Academic | Researcher | Knowledge seeker',
      ''
    ];

    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#AED6F1',
      '#F5B7B1', '#A9DFBF', '#F9E79F', '#D7BDE2', '#ABEBC6'
    ];

    const usedUsernames = new Set();
    const batchSize = 500;

    for (let i = 0; i < memberCount; i += batchSize) {
      for (let j = 0; j < batchSize && i + j < memberCount; j++) {
        let username;
        do {
          const style = Math.floor(Math.random() * 4);
          if (style === 0) {
            username = `${adjectives[Math.floor(Math.random() * adjectives.length)]}_${nouns[Math.floor(Math.random() * nouns.length)]}`;
          } else if (style === 1) {
            username = `${firstNames[Math.floor(Math.random() * firstNames.length)]}${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
          } else if (style === 2) {
            username = `${firstNames[Math.floor(Math.random() * firstNames.length)]}_${Math.floor(Math.random() * 9999)}`;
          } else {
            username = `user_${Math.floor(Math.random() * 999999)}`;
          }
        } while (usedUsernames.has(username));
        usedUsernames.add(username);

        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        const displayName = `${firstName} ${lastName}`;
        const bio = bios[Math.floor(Math.random() * bios.length)];
        const color = colors[Math.floor(Math.random() * colors.length)];

        const joinDate = new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000);
        const joinDateStr = joinDate.toISOString();

        const activityScore = 0.1 + Math.random() * 0.9;
        const viewProb = Math.min(0.95, 0.2 + activityScore * 0.6);
        const reactionProb = Math.min(0.8, 0.1 + activityScore * 0.5);
        const replyProb = Math.min(0.3, 0.02 + activityScore * 0.2);

        const avatar = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='${encodeURIComponent(color)}' width='200' height='200'/%3E%3Ctext x='50%' y='50%' font-size='80' fill='white' text-anchor='middle' dy='.3em' font-family='Arial'%3E${displayName.charAt(0)}%3C/text%3E%3C/svg%3E`;

        await dbRun(
          `INSERT INTO members (username, display_name, bio, avatar, join_date, activity_score, view_probability, reaction_probability, reply_probability)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [username, displayName, bio, avatar, joinDateStr, activityScore, viewProb, reactionProb, replyProb]
        );
      }

      process.stdout.write(`\r✨ Seeded ${Math.min(i + batchSize, memberCount)}/${memberCount} members`);
    }

    console.log('\n✅ Members reseeded successfully!');
    res.json({ success: true, memberCount });
  } catch (err) {
    console.error('Error reseeding members:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`
╔════════════════════════════════════════╗
║      🎉 Premmo's Cave Simulator 🎉     ║
╚════════════════════════════════════════╝

🚀 Server running at http://localhost:${PORT}
📊 Open your browser and start simulating!

Tips:
  - First-time setup: Click "Reseed Members" on Settings
  - Then use "Start Simulation" to watch activity
  - Create posts to see simulated engagement
  - Adjust speed and probabilities as needed

Press Ctrl+C to stop the server.
  `);

  // Initialize Telegram bot if configured
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const channelId = process.env.TELEGRAM_CHANNEL_ID;

  if (botToken && channelId) {
    console.log('\n🤖 Initializing Telegram Bot...');
    const initialized = await telegramBot.initializeTelegramBot(botToken, parseInt(channelId));
    if (initialized) {
      console.log('✅ Telegram bot is listening to your channel');
    } else {
      console.log('⚠️  Telegram bot initialization failed. Check your .env configuration.');
    }
  } else {
    console.log('\n⚠️  Telegram bot not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID in .env to enable.');
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down gracefully...');
  if (simulator.isSimulationRunning()) {
    simulator.stopSimulation();
  }
  process.exit(0);
});
