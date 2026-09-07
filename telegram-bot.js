const axios = require('axios');
const { dbRun, dbGet, dbAll } = require('./database');

let botToken = null;
let channelId = null;
let botInfo = null;
let lastUpdateId = null;
let pollInterval = null;
let isConnected = false;

async function initializeTelegramBot(token, channel) {
  botToken = token;
  channelId = channel;

  if (!botToken || !channelId) {
    console.log('⚠️  Telegram bot token or channel ID not configured. Skipping bot initialization.');
    return false;
  }

  try {
    // Verify bot token by getting bot info
    const response = await axios.get(
      `https://api.telegram.org/bot${botToken}/getMe`
    );

    if (response.data.ok) {
      botInfo = response.data.result;
      console.log(`✅ Telegram bot connected: @${botInfo.username}`);
      isConnected = true;

      // Load last processed update ID to prevent duplicates
      const lastUpdate = await dbGet(
        'SELECT last_telegram_update_id FROM telegram_bot_state WHERE id = 1'
      );
      if (lastUpdate) {
        lastUpdateId = lastUpdate.last_telegram_update_id;
      }

      // Start polling for updates (async, don't wait for it)
      startPolling();
      return true;
    } else {
      console.error('❌ Invalid Telegram bot token');
      isConnected = false;
      return false;
    }
  } catch (err) {
    console.error('❌ Failed to connect to Telegram bot:', err.message);
    isConnected = false;
    return false;
  }
}

async function startPolling() {
  if (!botToken) return;

  console.log('🔄 Starting Telegram bot polling...');

  // Clear existing interval if any
  if (pollInterval) clearInterval(pollInterval);

  // Use proper long polling (no interval needed - getUpdates blocks until new data)
  // Call getUpdates continuously with long timeout
  pollLongPolling();
}

async function pollLongPolling() {
  if (!botToken || !isConnected) return;

  // This will keep running continuously, with each call waiting up to 30 seconds
  while (isConnected && botToken) {
    try {
      await getUpdates();
    } catch (err) {
      // Continue polling even on errors
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

async function getUpdates() {
  if (!botToken || !isConnected) return;

  try {
    const params = {
      allowed_updates: ['channel_post'], // Only listen for channel posts
      timeout: 30 // Long polling timeout - server waits up to 30 seconds for new updates
    };

    if (lastUpdateId) {
      params.offset = lastUpdateId + 1; // Only get updates after the last one processed
    }

    const response = await axios.get(
      `https://api.telegram.org/bot${botToken}/getUpdates`,
      { params,
        timeout: 35000 // Give axios 35 seconds (timeout + buffer) for the request
      }
    );

    if (response.data.ok && response.data.result.length > 0) {
      for (const update of response.data.result) {
        if (update.channel_post) {
          await handleChannelPost(update);
          lastUpdateId = update.update_id;

          // Save last update ID to prevent duplicates on restart
          await dbRun(
            `INSERT OR REPLACE INTO telegram_bot_state (id, last_telegram_update_id, last_update_time)
             VALUES (1, ?, datetime('now'))`,
            [lastUpdateId]
          );
        }
      }
    }
  } catch (err) {
    // 409 Conflict typically means another client is polling - just retry
    if (err.response?.status === 409) {
      console.log('⚠️  Telegram API conflict (409) - another client polling. Retrying...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else if (err.message.includes('ECONNREFUSED') || err.message.includes('timeout')) {
      // Network error, keep trying
      console.log('⚠️  Telegram connection temporary issue, retrying...');
    } else if (err.message.includes('ECONNRESET')) {
      console.log('⚠️  Connection reset by Telegram, retrying...');
    } else {
      console.error('Error polling Telegram updates:', err.message);
    }
  }
}

async function handleChannelPost(update) {
  const post = update.channel_post;

  // Only process posts from our monitored channel
  if (post.chat.id !== channelId) {
    return;
  }

  try {
    // Check if we already processed this post (duplicate protection)
    const existing = await dbGet(
      'SELECT id FROM telegram_posts WHERE telegram_message_id = ?',
      [post.message_id]
    );

    if (existing) {
      console.log(`↪️  Duplicate post detected (msg_id: ${post.message_id}), skipping`);
      return;
    }

    // Extract post text
    let postText = post.text || post.caption || '(no text)';
    let mediaType = null;

    if (post.photo) mediaType = 'photo';
    else if (post.video) mediaType = 'video';
    else if (post.document) mediaType = 'document';
    else if (post.audio) mediaType = 'audio';
    else if (post.animation) mediaType = 'animation';

    const now = new Date().toISOString();

    // Create local post in database
    const postResult = await dbRun(
      `INSERT INTO posts (author_id, text, timestamp, views, created_at)
       VALUES (1, ?, ?, 0, ?)`,
      [postText, now, now]
    );

    const localPostId = postResult.id;

    // Record the mapping between real Telegram post and local simulation
    await dbRun(
      `INSERT INTO telegram_posts
       (telegram_message_id, telegram_chat_id, real_post_timestamp, real_post_text, real_post_media_type, local_simulation_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [post.message_id, post.chat.id, new Date(post.date * 1000).toISOString(), postText, mediaType, localPostId, now]
    );

    console.log(`📨 New Telegram post detected (msg_id: ${post.message_id})`);
    console.log(`   Text: "${postText.substring(0, 60)}${postText.length > 60 ? '...' : ''}"`);
    console.log(`   Creating local simulation (post_id: ${localPostId})`);
    console.log(`   ⏳ Simulation will start in 10 seconds...`);

    // Initialize engagement for this post (10-second delay built in)
    const simulator = require('./simulator');
    await simulator.initializePostEngagement(localPostId);

    // Start simulation if not already running
    if (!simulator.isSimulationRunning()) {
      console.log('🚀 Starting simulator for Telegram post...');
      await simulator.startSimulation();
    }
  } catch (err) {
    console.error('Error handling channel post:', err.message);
  }
}

async function getBotStatus() {
  if (!botToken) {
    return {
      connected: false,
      message: 'Telegram bot not configured'
    };
  }

  try {
    if (!botInfo) {
      const response = await axios.get(
        `https://api.telegram.org/bot${botToken}/getMe`
      );
      if (response.data.ok) {
        botInfo = response.data.result;
      }
    }

    // Get last detected post
    const lastPost = await dbGet(
      `SELECT telegram_message_id, real_post_text, created_at
       FROM telegram_posts
       ORDER BY created_at DESC LIMIT 1`
    );

    return {
      connected: isConnected,
      botUsername: botInfo?.username,
      channelId: channelId,
      lastPostDetected: lastPost ? {
        messageId: lastPost.telegram_message_id,
        text: lastPost.real_post_text,
        time: lastPost.created_at
      } : null,
      pollActive: !!pollInterval
    };
  } catch (err) {
    return {
      connected: false,
      message: `Error: ${err.message}`
    };
  }
}

async function stopBot() {
  isConnected = false;
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  console.log('⏹️  Telegram bot polling stopped');
}

module.exports = {
  initializeTelegramBot,
  getBotStatus,
  stopBot,
  handleChannelPost
};
