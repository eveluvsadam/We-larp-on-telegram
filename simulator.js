const { dbRun, dbAll, dbGet } = require('./database');

let simulationRunning = false;
let simulationSpeed = 1;
let simulationInterval = null;

async function getSettings() {
  const settings = await dbGet('SELECT * FROM settings WHERE id = 1');
  return settings;
}

async function updateSettings(updates) {
  const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
  const values = Object.values(updates);
  await dbRun(`UPDATE settings SET ${setClause} WHERE id = 1`, values);
}

async function getRandomMembers(count) {
  const members = await dbAll(
    `SELECT * FROM members ORDER BY RANDOM() LIMIT ?`,
    [count]
  );
  return members;
}

async function simulatePostViews(postId) {
  const settings = await getSettings();
  const post = await dbGet('SELECT * FROM posts WHERE id = ?', [postId]);

  if (!post) return;

  // Get all members
  const members = await dbAll('SELECT * FROM members');

  // Simulate views
  let newViews = 0;
  for (const member of members) {
    const randomValue = Math.random();
    const viewProb = member.view_probability || settings.view_probability;

    if (randomValue < viewProb) {
      newViews++;
    }
  }

  // Update view count
  const totalViews = (post.views || 0) + newViews;
  await dbRun('UPDATE posts SET views = ? WHERE id = ?', [totalViews, postId]);

  return newViews;
}

async function simulateReactions(postId) {
  const settings = await getSettings();
  const reactionTypes = ['❤️', '👍', '😂', '🔥', '😢', '😡'];

  const post = await dbGet('SELECT * FROM posts WHERE id = ?', [postId]);
  if (!post) return;

  // Get all members
  const members = await dbAll('SELECT * FROM members');

  // Simulate reactions
  const reactionCounts = {};
  reactionTypes.forEach(type => {
    reactionCounts[type] = 0;
  });

  for (const member of members) {
    const randomValue = Math.random();
    const reactionProb = member.reaction_probability || settings.reaction_probability;

    if (randomValue < reactionProb) {
      const randomReaction = reactionTypes[Math.floor(Math.random() * reactionTypes.length)];
      reactionCounts[randomReaction]++;
    }
  }

  // Update or create reactions
  for (const [reactionType, count] of Object.entries(reactionCounts)) {
    if (count > 0) {
      const existing = await dbGet(
        'SELECT * FROM reactions WHERE post_id = ? AND reaction_type = ?',
        [postId, reactionType]
      );

      if (existing) {
        await dbRun(
          'UPDATE reactions SET count = ?, updated_at = ? WHERE post_id = ? AND reaction_type = ?',
          [existing.count + count, new Date().toISOString(), postId, reactionType]
        );
      } else {
        await dbRun(
          'INSERT INTO reactions (post_id, reaction_type, count, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [postId, reactionType, count, new Date().toISOString(), new Date().toISOString()]
        );
      }
    }
  }

  return reactionCounts;
}

async function simulateReplies(postId) {
  const settings = await getSettings();
  const post = await dbGet('SELECT * FROM posts WHERE id = ?', [postId]);

  if (!post) return;

  // Get all members
  const members = await dbAll('SELECT * FROM members');

  // Simulate replies
  let newReplies = 0;
  for (const member of members) {
    const randomValue = Math.random();
    const replyProb = member.reply_probability || settings.reply_probability;

    if (randomValue < replyProb) {
      newReplies++;
    }
  }

  // Update or create reply count
  const existing = await dbGet('SELECT * FROM reply_counts WHERE post_id = ?', [postId]);

  if (existing) {
    await dbRun(
      'UPDATE reply_counts SET reply_count = ?, updated_at = ? WHERE post_id = ?',
      [existing.reply_count + newReplies, new Date().toISOString(), postId]
    );
  } else {
    await dbRun(
      'INSERT INTO reply_counts (post_id, reply_count, updated_at) VALUES (?, ?, ?)',
      [postId, newReplies, new Date().toISOString()]
    );
  }

  return newReplies;
}

async function updateOnlineStatus() {
  // Randomly set members as online/offline
  const members = await dbAll('SELECT id FROM members');

  for (const member of members) {
    const isOnline = Math.random() < 0.3; // 30% chance of being online
    await dbRun('UPDATE members SET is_online = ?, last_seen = ? WHERE id = ?',
      [isOnline ? 1 : 0, new Date().toISOString(), member.id]);
  }

  const onlineCount = await dbGet('SELECT COUNT(*) as count FROM members WHERE is_online = 1');
  return onlineCount.count;
}

async function recordStats() {
  const onlineMembers = await dbGet('SELECT COUNT(*) as count FROM members WHERE is_online = 1');
  const totalViews = await dbGet('SELECT COALESCE(SUM(views), 0) as total FROM posts');
  const totalReactions = await dbGet('SELECT COALESCE(SUM(count), 0) as total FROM reactions');

  // Count new members (joined in last 24 hours)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const newMembers = await dbGet('SELECT COUNT(*) as count FROM members WHERE join_date > ?', [yesterday]);

  await dbRun(
    'INSERT INTO stats (timestamp, online_count, new_members, total_views, total_reactions) VALUES (?, ?, ?, ?, ?)',
    [new Date().toISOString(), onlineMembers.count, newMembers.count, totalViews.total, totalReactions.total]
  );

  return {
    onlineCount: onlineMembers.count,
    newMembers: newMembers.count,
    totalViews: totalViews.total,
    totalReactions: totalReactions.total
  };
}

async function runSimulationCycle() {
  try {
    // Get all posts
    const posts = await dbAll('SELECT id FROM posts ORDER BY created_at DESC LIMIT 10');

    // Simulate activity on each post
    for (const post of posts) {
      await simulatePostViews(post.id);
      await simulateReactions(post.id);
      await simulateReplies(post.id);
    }

    // Update online status
    await updateOnlineStatus();

    // Record stats
    await recordStats();

  } catch (err) {
    console.error('Error in simulation cycle:', err);
  }
}

async function startSimulation() {
  if (simulationRunning) {
    console.log('Simulation already running');
    return;
  }

  simulationRunning = true;
  console.log('🚀 Simulation started');

  // Run simulation cycle every 2 seconds, scaled by speed
  const baseInterval = 2000;
  const interval = baseInterval / simulationSpeed;

  simulationInterval = setInterval(() => {
    runSimulationCycle();
  }, interval);

  // Run immediately
  await runSimulationCycle();
}

async function stopSimulation() {
  if (!simulationRunning) {
    console.log('Simulation not running');
    return;
  }

  simulationRunning = false;
  clearInterval(simulationInterval);
  console.log('⏹️ Simulation stopped');
}

function setSimulationSpeed(speed) {
  simulationSpeed = speed;

  if (simulationRunning) {
    // Restart with new speed
    stopSimulation();
    startSimulation();
  }
}

function isSimulationRunning() {
  return simulationRunning;
}

async function resetSimulation() {
  console.log('🔄 Resetting simulation...');

  // Stop simulation if running
  if (simulationRunning) {
    await stopSimulation();
  }

  // Clear data
  await dbRun('DELETE FROM posts');
  await dbRun('DELETE FROM reactions');
  await dbRun('DELETE FROM reply_counts');
  await dbRun('DELETE FROM stats');
  await dbRun('DELETE FROM members');

  // Reseed members
  const { seedMembers } = require('./seed');
  // Can't easily require seed since it's a standalone script
  // Instead, just clear and let frontend reseed
  console.log('✅ Simulation reset. Please reseed members from frontend.');
}

module.exports = {
  startSimulation,
  stopSimulation,
  setSimulationSpeed,
  isSimulationRunning,
  resetSimulation,
  simulatePostViews,
  simulateReactions,
  simulateReplies,
  updateOnlineStatus,
  recordStats,
  getSettings,
  updateSettings,
  getRandomMembers
};
