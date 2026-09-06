// Global State
let currentPage = 'dashboard';
let statsInterval = null;
let postEngagementTimers = new Map();

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

function initializeApp() {
  // Set up event listeners
  setupNavigation();
  setupDashboard();
  setupPosts();
  setupMembers();
  setupSettings();

  // Load initial data
  loadStats();

  // Poll stats every 2 seconds
  statsInterval = setInterval(loadStats, 2000);
}

// Navigation
function setupNavigation() {
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      navigateToPage(page);
    });
  });
}

function navigateToPage(page) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  // Show selected page
  const pageElement = document.getElementById(`${page}-page`);
  if (pageElement) {
    pageElement.classList.add('active');
  }

  // Mark nav button as active
  const navBtn = document.querySelector(`[data-page="${page}"]`);
  if (navBtn) {
    navBtn.classList.add('active');
  }

  currentPage = page;

  // Load page-specific data
  if (page === 'posts') {
    loadPosts();
  } else if (page === 'members') {
    loadMembers();
  } else if (page === 'analytics') {
    loadAnalytics();
  } else if (page === 'settings') {
    loadSettings();
  }
}

// Dashboard
function setupDashboard() {
  document.getElementById('startBtn').addEventListener('click', startSimulation);
  document.getElementById('stopBtn').addEventListener('click', stopSimulation);
  document.getElementById('speedControl').addEventListener('change', (e) => {
    changeSimulationSpeed(parseFloat(e.target.value));
  });
}

async function loadStats() {
  try {
    const response = await fetch('/api/stats');
    const stats = await response.json();

    // Update stat cards
    document.getElementById('memberCount').textContent = formatNumber(stats.memberCount);
    document.getElementById('onlineCount').textContent = formatNumber(stats.onlineCount);
    document.getElementById('totalViews').textContent = formatNumber(stats.totalViews);
    document.getElementById('totalReactions').textContent = formatNumber(stats.totalReactions);
    document.getElementById('engagementRate').textContent = stats.engagementRate + '%';
    document.getElementById('newMembersToday').textContent = formatNumber(stats.newMembersToday);

    // Update simulation button state
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');

    if (stats.isSimulationRunning) {
      startBtn.style.display = 'none';
      stopBtn.style.display = 'block';
    } else {
      startBtn.style.display = 'block';
      stopBtn.style.display = 'none';
    }

    // Update activity chart
    if (stats.activityData && stats.activityData.length > 0) {
      drawActivityChart(stats.activityData);
    }
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

async function startSimulation() {
  try {
    const response = await fetch('/api/simulation/start', { method: 'POST' });
    const data = await response.json();
    console.log(data.message);
    loadStats();
  } catch (err) {
    console.error('Error starting simulation:', err);
    alert('Failed to start simulation');
  }
}

async function stopSimulation() {
  try {
    const response = await fetch('/api/simulation/stop', { method: 'POST' });
    const data = await response.json();
    console.log(data.message);
    loadStats();
  } catch (err) {
    console.error('Error stopping simulation:', err);
    alert('Failed to stop simulation');
  }
}

async function changeSimulationSpeed(speed) {
  try {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulation_speed: speed })
    });
    const data = await response.json();
    console.log('Speed changed to', speed);
  } catch (err) {
    console.error('Error changing simulation speed:', err);
  }
}

function drawActivityChart(data) {
  const svg = document.getElementById('activityChart');
  if (!svg) return;

  svg.innerHTML = '';

  const width = 1000;
  const height = 300;
  const padding = 40;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;

  const onlineCounts = data.map(d => d.online_count);
  const maxOnline = Math.max(...onlineCounts, 1);

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', width);
  bg.setAttribute('height', height);
  bg.setAttribute('fill', 'transparent');
  svg.appendChild(bg);

  // Grid lines
  for (let i = 0; i <= 5; i++) {
    const y = padding + (graphHeight / 5) * i;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', padding);
    line.setAttribute('x2', width - padding);
    line.setAttribute('y1', y);
    line.setAttribute('y2', y);
    line.setAttribute('stroke', '#2d2d2d');
    line.setAttribute('stroke-width', '1');
    svg.appendChild(line);

    const value = Math.round((maxOnline / 5) * (5 - i));
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', padding - 10);
    text.setAttribute('y', y);
    text.setAttribute('text-anchor', 'end');
    text.setAttribute('fill', '#a0a0a0');
    text.setAttribute('font-size', '12');
    text.textContent = value;
    svg.appendChild(text);
  }

  // Data line
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * graphWidth;
    const y = padding + graphHeight - (d.online_count / maxOnline) * graphHeight;
    return `${x},${y}`;
  }).join(' ');

  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('points', points);
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke', '#0088cc');
  polyline.setAttribute('stroke-width', '2');
  svg.appendChild(polyline);

  // Axes
  const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  xAxis.setAttribute('x1', padding);
  xAxis.setAttribute('x2', width - padding);
  xAxis.setAttribute('y1', height - padding);
  xAxis.setAttribute('y2', height - padding);
  xAxis.setAttribute('stroke', '#2d2d2d');
  svg.appendChild(xAxis);

  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  yAxis.setAttribute('x1', padding);
  yAxis.setAttribute('x2', padding);
  yAxis.setAttribute('y1', padding);
  yAxis.setAttribute('y2', height - padding);
  yAxis.setAttribute('stroke', '#2d2d2d');
  svg.appendChild(yAxis);
}

// Posts
function setupPosts() {
  document.getElementById('newPostBtn').addEventListener('click', () => {
    document.getElementById('postFormContainer').style.display = 'block';
  });

  document.getElementById('cancelPostBtn').addEventListener('click', () => {
    document.getElementById('postFormContainer').style.display = 'none';
  });

  document.getElementById('submitPostBtn').addEventListener('click', createPost);
}

async function createPost() {
  const text = document.getElementById('postText').value.trim();
  const imageUrl = document.getElementById('postImage').value.trim();

  if (!text) {
    alert('Post text is required');
    return;
  }

  try {
    const response = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, imageUrl: imageUrl || null })
    });

    const data = await response.json();

    if (data.success) {
      document.getElementById('postText').value = '';
      document.getElementById('postImage').value = '';
      document.getElementById('postFormContainer').style.display = 'none';
      loadPosts();
      alert('Post created! Watch engagement increase over time.');
    }
  } catch (err) {
    console.error('Error creating post:', err);
    alert('Failed to create post');
  }
}

async function loadPosts(page = 0) {
  try {
    const response = await fetch(`/api/posts?page=${page}`);
    const data = await response.json();

    const postsList = document.getElementById('postsList');
    postsList.innerHTML = '';

    if (data.posts.length === 0) {
      postsList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #a0a0a0;">No posts yet. Create one!</div>';
      return;
    }

    data.posts.forEach(post => {
      const card = createPostCard(post);
      postsList.appendChild(card);
    });

    createPagination('postsPagination', data.page, Math.ceil(data.totalCount / data.limit), (p) => loadPosts(p));
  } catch (err) {
    console.error('Error loading posts:', err);
  }
}

function createPostCard(post) {
  const card = document.createElement('div');
  card.className = 'post-card';

  const timestamp = new Date(post.created_at);
  const timeStr = formatTime(timestamp);

  let imageHTML = '';
  if (post.image_url) {
    imageHTML = `<img src="${post.image_url}" alt="Post image" class="post-image" onerror="this.style.display='none'">`;
  }

  let reactionsHTML = '';
  if (post.reactions && post.reactions.length > 0) {
    reactionsHTML = '<div class="reactions">';
    post.reactions.forEach(r => {
      if (r.count > 0) {
        reactionsHTML += `<div class="reaction-badge">${r.reaction_type} <span class="reaction-count">${formatNumber(r.count)}</span></div>`;
      }
    });
    reactionsHTML += '</div>';
  }

  // Add engagement status
  let statusHTML = '';
  if (post.engagement) {
    if (post.engagement.status === 'waiting') {
      statusHTML = `<div class="engagement-status waiting">⏳ Engagement starts in ${Math.ceil(post.engagement.secondsUntilStart)}s</div>`;
    } else if (post.engagement.status === 'active') {
      statusHTML = `<div class="engagement-status active">● Live simulation (${post.engagement.progress}%)</div>`;
    } else if (post.engagement.status === 'starting') {
      statusHTML = `<div class="engagement-status starting">● Engagement starting...</div>`;
    }
  }

  card.innerHTML = `
    ${statusHTML}
    <div class="post-header">
      <div class="post-avatar">PP</div>
      <div class="post-meta">
        <div class="post-author">premmo's cave</div>
        <div class="post-time">${timeStr}</div>
      </div>
    </div>
    <div class="post-text">${escapeHtml(post.text)}</div>
    ${imageHTML}
    ${reactionsHTML}
    <div class="post-stats">
      <div class="post-stat">👁 <strong>${formatNumber(post.views)}</strong> views</div>
      <div class="post-stat">💬 <strong>${formatNumber(post.reply_count || 0)}</strong> replies</div>
      <div class="post-stat">❤️ <strong>${formatNumber(post.reactions?.reduce((sum, r) => sum + r.count, 0) || 0)}</strong> reactions</div>
    </div>
  `;

  return card;
}

// Members
function setupMembers() {
  const searchInput = document.getElementById('memberSearch');
  let searchTimeout;

  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadMembers(0, e.target.value);
    }, 300);
  });
}

async function loadMembers(page = 0, search = '') {
  try {
    const params = new URLSearchParams();
    params.append('page', page);
    if (search) params.append('search', search);

    const response = await fetch(`/api/members?${params}`);
    const data = await response.json();

    const grid = document.getElementById('membersGrid');
    grid.innerHTML = '';

    if (data.members.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #a0a0a0;">No members found. Reseed from Settings!</div>';
      return;
    }

    data.members.forEach(member => {
      const card = createMemberCard(member);
      grid.appendChild(card);
    });

    createPagination('membersPagination', data.page, Math.ceil(data.totalCount / data.limit), (p) => loadMembers(p, search));
  } catch (err) {
    console.error('Error loading members:', err);
  }
}

function createMemberCard(member) {
  const card = document.createElement('div');
  card.className = 'member-card';

  card.innerHTML = `
    <div class="member-avatar">
      <img src="${member.avatar}" alt="${member.display_name}" onerror="this.style.display='none'">
    </div>
    <div class="member-name">${escapeHtml(member.display_name)}</div>
    <div class="member-username">@${escapeHtml(member.username)}</div>
    <div>
      <span class="member-status ${member.is_online ? 'online' : 'offline'}"></span>
      <span class="member-activity">${member.is_online ? 'Online' : 'Offline'}</span>
    </div>
    <div class="member-activity" style="margin-top: 0.5rem;">Activity: ${(member.activity_score * 100).toFixed(0)}%</div>
  `;

  return card;
}

// Analytics
async function loadAnalytics() {
  try {
    const response = await fetch('/api/posts');
    const data = await response.json();

    if (data.posts.length > 0) {
      drawSimpleAnalytics(data.posts);
    }
  } catch (err) {
    console.error('Error loading analytics:', err);
  }
}

function drawSimpleAnalytics(posts) {
  const reactionCounts = {};
  posts.forEach(post => {
    if (post.reactions) {
      post.reactions.forEach(r => {
        reactionCounts[r.reaction_type] = (reactionCounts[r.reaction_type] || 0) + r.count;
      });
    }
  });

  drawReactionChart(reactionCounts);
}

function drawReactionChart(reactionCounts) {
  const container = document.getElementById('reactionChart');
  container.innerHTML = '';

  const maxCount = Math.max(...Object.values(reactionCounts), 1);

  Object.entries(reactionCounts).sort((a, b) => b[1] - a[1]).forEach(([emoji, count]) => {
    const bar = document.createElement('div');
    bar.className = 'reaction-bar';

    const percentage = (count / maxCount) * 100;

    bar.innerHTML = `
      <div class="reaction-emoji">${emoji}</div>
      <div class="reaction-bar-bg">
        <div class="reaction-bar-fill" style="width: ${percentage}%"></div>
      </div>
      <div class="reaction-count-label">${formatNumber(count)}</div>
    `;

    container.appendChild(bar);
  });
}

// Settings
function setupSettings() {
  document.getElementById('reseedBtn').addEventListener('click', reseedMembers);
  document.getElementById('resetBtn').addEventListener('click', resetSimulation);
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);

  // Range inputs
  ['randomness', 'simSpeed'].forEach(id => {
    const input = document.getElementById(id);
    const display = document.getElementById(id + 'Value');
    input.addEventListener('input', (e) => {
      if (id === 'simSpeed') {
        display.textContent = parseFloat(e.target.value).toFixed(1) + 'x';
      } else {
        display.textContent = parseFloat(e.target.value).toFixed(1);
      }
    });
  });
}

async function loadSettings() {
  try {
    const response = await fetch('/api/settings');
    const settings = await response.json();

    document.getElementById('channelName').value = settings.channel_name || '';
    document.getElementById('channelDescription').value = settings.channel_description || '';
    document.getElementById('memberCountInput').value = settings.member_count || 24388;
    document.getElementById('minViews').value = settings.min_views || 12483;
    document.getElementById('minReactions').value = settings.min_reactions || 8234;
    document.getElementById('reactionDelay').value = settings.reaction_delay || 10;
    document.getElementById('randomness').value = settings.randomness || 0.5;
    document.getElementById('randomnessValue').textContent = (settings.randomness || 0.5).toFixed(1);
    document.getElementById('simSpeed').value = settings.simulation_speed || 1;
    document.getElementById('simSpeedValue').textContent = (settings.simulation_speed || 1).toFixed(1) + 'x';
    document.getElementById('availableEmojis').value = settings.available_emojis || '❤️,👍,🔥,😍,💯,😎,😭,🤯,👏,🥶,😈,👀,🙏,⭐,✨,🥰,😘';
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

async function saveSettings() {
  try {
    const settings = {
      channel_name: document.getElementById('channelName').value,
      channel_description: document.getElementById('channelDescription').value,
      member_count: parseInt(document.getElementById('memberCountInput').value),
      min_views: parseInt(document.getElementById('minViews').value),
      min_reactions: parseInt(document.getElementById('minReactions').value),
      reaction_delay: parseInt(document.getElementById('reactionDelay').value),
      randomness: parseFloat(document.getElementById('randomness').value),
      simulation_speed: parseFloat(document.getElementById('simSpeed').value),
      available_emojis: document.getElementById('availableEmojis').value
    };

    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });

    if (response.ok) {
      alert('Settings saved!');
    }
  } catch (err) {
    console.error('Error saving settings:', err);
    alert('Failed to save settings');
  }
}

async function reseedMembers() {
  const count = parseInt(document.getElementById('memberCountInput').value);

  if (count < 100 || count > 100000) {
    alert('Member count must be between 100 and 100,000');
    return;
  }

  const btn = document.getElementById('reseedBtn');
  const status = document.getElementById('reseedStatus');

  btn.disabled = true;
  btn.textContent = '⏳ Seeding...';
  status.textContent = 'Generating ' + count.toLocaleString() + ' members...';
  status.classList.add('show');

  try {
    const response = await fetch('/api/simulation/reseed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count })
    });

    const data = await response.json();

    if (data.success) {
      status.textContent = `✅ Successfully created ${data.memberCount.toLocaleString()} members!`;
      status.classList.add('show');
      setTimeout(() => {
        loadStats();
      }, 500);
    }
  } catch (err) {
    console.error('Error reseeding members:', err);
    status.textContent = '❌ Failed to reseed members';
  } finally {
    btn.disabled = false;
    btn.textContent = '🌱 Reseed Members';
  }
}

async function resetSimulation() {
  if (!confirm('⚠️ This will delete all posts, reactions, and stats. Continue?')) {
    return;
  }

  try {
    const response = await fetch('/api/simulation/reset', { method: 'POST' });
    const data = await response.json();
    alert('Simulation reset! All data cleared.');
    loadStats();
  } catch (err) {
    console.error('Error resetting simulation:', err);
    alert('Failed to reset simulation');
  }
}

// Utility functions
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function formatTime(date) {
  const now = new Date();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes + 'm ago';
  if (hours < 24) return hours + 'h ago';
  if (days < 7) return days + 'd ago';

  return date.toLocaleDateString();
}

function createPagination(containerId, currentPage, totalPages, callback) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (totalPages <= 1) return;

  const prevBtn = document.createElement('button');
  prevBtn.textContent = '← Previous';
  prevBtn.disabled = currentPage === 0;
  prevBtn.addEventListener('click', () => callback(currentPage - 1));
  container.appendChild(prevBtn);

  const startPage = Math.max(0, currentPage - 2);
  const endPage = Math.min(totalPages - 1, currentPage + 2);

  if (startPage > 0) {
    const firstBtn = document.createElement('button');
    firstBtn.textContent = '1';
    firstBtn.addEventListener('click', () => callback(0));
    container.appendChild(firstBtn);

    if (startPage > 1) {
      const dots = document.createElement('span');
      dots.textContent = '...';
      dots.style.padding = '0.5rem 1rem';
      container.appendChild(dots);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const btn = document.createElement('button');
    btn.textContent = (i + 1).toString();
    btn.className = i === currentPage ? 'active' : '';
    btn.addEventListener('click', () => callback(i));
    container.appendChild(btn);
  }

  if (endPage < totalPages - 1) {
    if (endPage < totalPages - 2) {
      const dots = document.createElement('span');
      dots.textContent = '...';
      dots.style.padding = '0.5rem 1rem';
      container.appendChild(dots);
    }

    const lastBtn = document.createElement('button');
    lastBtn.textContent = totalPages.toString();
    lastBtn.addEventListener('click', () => callback(totalPages - 1));
    container.appendChild(lastBtn);
  }

  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next →';
  nextBtn.disabled = currentPage === totalPages - 1;
  nextBtn.addEventListener('click', () => callback(currentPage + 1));
  container.appendChild(nextBtn);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
