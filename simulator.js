const { dbRun, dbAll, dbGet } = require('./database');

let simulationRunning = false;
let simulationSpeed = 1;
let simulationInterval = null;
const activeEngagements = new Map(); // Track active post engagements

async function getSettings() {
  const settings = await dbGet('SELECT * FROM settings WHERE id = 1');
  return settings;
}

async function updateSettings(updates) {
  const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
  const values = Object.values(updates);
  await dbRun(`UPDATE settings SET ${setClause} WHERE id = 1`, values);
}

function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Engagement curve based on time elapsed (in seconds)
function getEngagementProgress(secondsElapsed, totalViewsTarget) {
  // 0-10: 0% (waiting period before engagement)
  if (secondsElapsed < 10) return 0;

  // 10-30: 10-25% (slow start)
  if (secondsElapsed < 30) {
    return 0.1 + (0.15 * (secondsElapsed - 10) / 20);
  }

  // 30-120 (2 min): 25-75% (rapid growth)
  if (secondsElapsed < 120) {
    return 0.25 + (0.5 * (secondsElapsed - 30) / 90);
  }

  // 120-600 (10 min): 75-95% (peak activity)
  if (secondsElapsed < 600) {
    return 0.75 + (0.2 * (secondsElapsed - 120) / 480);
  }

  // 600-1800 (30 min): 95-99% (slowing)
  if (secondsElapsed < 1800) {
    return 0.95 + (0.04 * (secondsElapsed - 600) / 1200);
  }

  // 1800+: 99-100% (minimal increase)
  return Math.min(0.999, 0.99 + (0.009 * Math.min((secondsElapsed - 1800) / 3600, 1)));
}

// Generate engagement for a post
async function initializePostEngagement(postId) {
  try {
    const settings = await getSettings();
    const post = await dbGet('SELECT * FROM posts WHERE id = ?', [postId]);

    if (!post) return;

    // Check if already initialized
    const existing = await dbGet('SELECT * FROM post_engagement WHERE post_id = ?', [postId]);
    if (existing) return;

    const members = await dbAll('SELECT * FROM members LIMIT ?', [settings.member_count || 24388]);
    const now = new Date().toISOString();

    // Calculate target views and reactions with randomness
    const viewRand = 0.7 + Math.random() * (settings.randomness || 0.5);
    const reactRand = 0.6 + Math.random() * (settings.randomness || 0.5);

    const targetViews = Math.floor((settings.min_views || 12483) * viewRand);
    const targetReactions = Math.floor((settings.min_reactions || 8234) * reactRand);

    // Select random emojis from available
    const availableEmojis = (settings.available_emojis || '❤️,👍,🔥,😍,💯,😎,😭,🤯,👏,🥶,😈,👀,🙏,⭐,✨,🥰,😘').split(',');
    const numEmojis = 4 + Math.floor(Math.random() * 8); // 4-11 emojis per post
    const selectedEmojis = [];

    for (let i = 0; i < numEmojis; i++) {
      const emoji = availableEmojis[Math.floor(Math.random() * availableEmojis.length)];
      if (!selectedEmojis.includes(emoji)) {
        selectedEmojis.push(emoji);
      }
    }

    // Generate realistic emoji distribution (not equal)
    const distribution = {};
    selectedEmojis.forEach(emoji => {
      distribution[emoji] = 0;
    });

    // Assign reactions unevenly to emojis
    let remaining = targetReactions;
    selectedEmojis.forEach((emoji, idx) => {
      if (idx === 0) {
        // First emoji gets biggest share
        distribution[emoji] = Math.floor(targetReactions * (0.3 + Math.random() * 0.3));
      } else if (idx === selectedEmojis.length - 1) {
        // Last emoji gets remaining
        distribution[emoji] = remaining;
      } else {
        // Middle emojis get varying shares
        const share = Math.floor(remaining * (0.3 + Math.random() * 0.4));
        distribution[emoji] = share;
        remaining -= share;
      }
    });

    // Store engagement plan
    await dbRun(
      `INSERT INTO post_engagement (post_id, created_at, engagement_started_at, target_views, target_reactions, selected_emojis, emoji_distribution, last_updated)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`,
      [postId, now, targetViews, targetReactions, selectedEmojis.join(','), JSON.stringify(distribution), now]
    );

    // Initialize all reactions with 0 count
    for (const emoji of selectedEmojis) {
      await dbRun(
        `INSERT INTO reactions (post_id, reaction_type, count, created_at, updated_at)
         VALUES (?, ?, 0, ?, ?)`,
        [postId, emoji, now, now]
      );
    }

    console.log(`📊 Post ${postId} engagement initialized: ${targetViews} views, ${targetReactions} reactions across ${selectedEmojis.length} emojis`);
  } catch (err) {
    console.error('Error initializing post engagement:', err);
  }
}

// Update post engagement progressively
async function updatePostEngagement(postId) {
  try {
    const engagement = await dbGet('SELECT * FROM post_engagement WHERE post_id = ?', [postId]);
    if (!engagement || !engagement.is_active) return;

    const createdAt = new Date(engagement.created_at).getTime();
    const now = new Date().getTime();
    const secondsElapsed = (now - createdAt) / 1000;

    // If engagement hasn't started yet, check if we've passed the delay
    if (!engagement.engagement_started_at) {
      if (secondsElapsed >= (await getSettings()).reaction_delay || 10) {
        await dbRun(
          'UPDATE post_engagement SET engagement_started_at = ? WHERE post_id = ?',
          [new Date().toISOString(), postId]
        );

        // If this is a Telegram post, add initial reactions
        const telegramPost = await dbGet(
          'SELECT * FROM telegram_posts WHERE local_simulation_id = ?',
          [postId]
        );
        if (telegramPost) {
          await addReactionsToTelegramPost(postId, telegramPost, engagement);
        }
      } else {
        return; // Still in delay period
      }
    }

    // Calculate progress
    const engagementStarted = new Date(engagement.engagement_started_at).getTime();
    const engagementSecondsElapsed = (now - engagementStarted) / 1000;

    const progress = getEngagementProgress(engagementSecondsElapsed, engagement.target_views);

    // Calculate current stats
    const currentViews = Math.floor(engagement.target_views * progress);
    const currentTotalReactions = Math.floor(engagement.target_reactions * progress);

    // Update post views
    await dbRun('UPDATE posts SET views = ? WHERE id = ?', [currentViews, postId]);

    // Distribute reactions
    const distribution = JSON.parse(engagement.emoji_distribution);
    const emojis = engagement.selected_emojis.split(',');

    for (const emoji of emojis) {
      const targetCount = distribution[emoji];
      const currentCount = Math.floor(targetCount * progress);

      await dbRun(
        'UPDATE reactions SET count = ?, updated_at = ? WHERE post_id = ? AND reaction_type = ?',
        [currentCount, new Date().toISOString(), postId, emoji]
      );
    }

    // Mark as inactive if fully completed
    if (progress >= 0.99) {
      await dbRun('UPDATE post_engagement SET is_active = 0 WHERE post_id = ?', [postId]);
    }
  } catch (err) {
    console.error('Error updating post engagement:', err);
  }
}

// Add reactions to a real Telegram post
async function addReactionsToTelegramPost(postId, telegramPost, engagement) {
  try {
    const telegramBot = require('./telegram-bot');
    const emojis = engagement.selected_emojis.split(',');

    // Add each emoji as a reaction to the real Telegram message
    for (const emoji of emojis) {
      const success = await telegramBot.addReactionToTelegramMessage(
        telegramPost.telegram_chat_id,
        telegramPost.telegram_message_id,
        emoji.trim()
      );

      if (success) {
        console.log(`✅ Added reaction ${emoji} to Telegram message ${telegramPost.telegram_message_id}`);
      }

      // Small delay between reactions to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  } catch (err) {
    console.error('Error adding reactions to Telegram post:', err);
  }
}

// Get post engagement status
async function getPostEngagementStatus(postId) {
  try {
    const engagement = await dbGet('SELECT * FROM post_engagement WHERE post_id = ?', [postId]);
    if (!engagement) return null;

    const createdAt = new Date(engagement.created_at).getTime();
    const now = new Date().getTime();
    const secondsElapsed = (now - createdAt) / 1000;

    const reactionDelay = (await getSettings()).reaction_delay || 10;

    if (secondsElapsed < reactionDelay) {
      return {
        status: 'waiting',
        secondsUntilStart: Math.max(0, reactionDelay - secondsElapsed),
        targetViews: engagement.target_views,
        targetReactions: engagement.target_reactions
      };
    }

    if (!engagement.engagement_started_at) {
      return {
        status: 'starting',
        targetViews: engagement.target_views,
        targetReactions: engagement.target_reactions
      };
    }

    const engagementStarted = new Date(engagement.engagement_started_at).getTime();
    const engagementSecondsElapsed = (now - engagementStarted) / 1000;
    const progress = getEngagementProgress(engagementSecondsElapsed, engagement.target_views);

    return {
      status: engagement.is_active ? 'active' : 'completed',
      secondsElapsed: Math.floor(engagementSecondsElapsed),
      progress: Math.round(progress * 100),
      targetViews: engagement.target_views,
      targetReactions: engagement.target_reactions,
      selectedEmojis: engagement.selected_emojis.split(',')
    };
  } catch (err) {
    console.error('Error getting engagement status:', err);
    return null;
  }
}

async function runSimulationCycle() {
  try {
    // Get all posts that need engagement updates
    const posts = await dbAll('SELECT id FROM posts WHERE id IN (SELECT post_id FROM post_engagement WHERE is_active = 1)');

    for (const post of posts) {
      await updatePostEngagement(post.id);
    }

    // Update online status
    await updateOnlineStatus();
  } catch (err) {
    console.error('Error in simulation cycle:', err);
  }
}

async function updateOnlineStatus() {
  try {
    const members = await dbAll('SELECT id FROM members LIMIT 100'); // Sample for efficiency

    for (const member of members) {
      const isOnline = Math.random() < 0.3;
      await dbRun('UPDATE members SET is_online = ? WHERE id = ?', [isOnline ? 1 : 0, member.id]);
    }
  } catch (err) {
    console.error('Error updating online status:', err);
  }
}

async function startSimulation() {
  if (simulationRunning) {
    console.log('Simulation already running');
    return;
  }

  simulationRunning = true;
  console.log('🚀 Simulation started');

  const baseInterval = 1000; // Update every 1 second
  const settings = await getSettings();
  const interval = baseInterval / (settings.simulation_speed || 1);

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
    stopSimulation();
    startSimulation();
  }
}

function isSimulationRunning() {
  return simulationRunning;
}

async function resetSimulation() {
  console.log('🔄 Resetting simulation...');

  if (simulationRunning) {
    await stopSimulation();
  }

  await dbRun('DELETE FROM posts');
  await dbRun('DELETE FROM reactions');
  await dbRun('DELETE FROM reply_counts');
  await dbRun('DELETE FROM stats');
  await dbRun('DELETE FROM post_engagement');
  await dbRun('UPDATE members SET is_online = 0');

  console.log('✅ Simulation reset');
}

module.exports = {
  startSimulation,
  stopSimulation,
  setSimulationSpeed,
  isSimulationRunning,
  resetSimulation,
  initializePostEngagement,
  updatePostEngagement,
  getPostEngagementStatus,
  getSettings,
  updateSettings
};
