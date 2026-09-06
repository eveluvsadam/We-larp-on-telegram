# 🎭 Premmo's Cave - Community Simulator

A **local-only** Telegram-style community simulator built with Node.js, Express, and SQLite. Create realistic post engagement simulations with dynamic member interaction, progressive engagement curves, and customizable settings—all running entirely on your machine.

## 🛑 CRITICAL: No Real Telegram Integration

This simulator is **100% local** and **completely independent** from Telegram:

- ✅ All 24,388 members exist only in the local SQLite database
- ✅ No real Telegram accounts are created, registered, or automated
- ✅ No fake accounts, session files, proxies, or API automation
- ✅ No interaction with real Telegram channels or users
- ✅ Everything runs on your machine with zero cloud dependencies
- ✅ Purely fictional data for learning and entertainment

## ✨ Features

- **📊 Dashboard** - Real-time stats: members, online count, views, reactions, engagement rate
- **👥 24,388 Simulated Members** - Realistic profiles with bios, activity scores, and individual probabilities
- **📝 Dynamic Posts** - Create posts and watch them gain simulated engagement with realistic time curves
- **💬 17 Reaction Emojis** - ❤️ 👍 🔥 😍 💯 😎 😭 🤯 👏 🥶 😈 👀 🙏 ⭐ ✨ 🥰 😘
- **⏳ Progressive Engagement** - 10-second delay before reactions, then realistic curve progression
- **🎲 Randomization** - Each post gets unique engagement targets and emoji distributions
- **📈 Analytics** - Charts for views, reactions, online members, and member growth
- **👤 Member Directory** - Searchable/paginated member list (50 per page)
- **⚙️ Customizable Settings** - Adjust engagement targets, delays, emoji, member count, simulation speed
- **💾 Data Persistence** - Everything stored locally in SQLite
- **🗑️ Reset** - Clear all data and reseed members

## 🚀 Quick Start

### Prerequisites
- Node.js 14+
- ~500MB disk space for database

### Installation & Setup

```bash
# Install dependencies
npm install

# Seed the database with 24,388 simulated members
npm run seed

# Start the server
npm start
```

The simulator will be available at `http://localhost:3000`

## 📋 Usage Guide

### Dashboard
- **Start/Stop Simulation** - Toggle the engagement simulation
- **Speed Control** - 0.5x (slow), 1x (normal), 2x (fast)
- **Live Stats** - Real-time member count, online status, total views, reactions, engagement rate
- **Activity Chart** - 24-hour activity visualization

### Posts
- **Create Posts** - Add posts with text and optional image URLs
- **Watch Engagement** - After creation:
  - ⏳ First 10 seconds: Post visible, no engagement ("Waiting")
  - ● 10-30 seconds: Reactions begin appearing slowly ("Active")
  - ● 30-120 seconds: Rapid engagement growth
  - ● 120+ seconds: Engagement peaks then gradually plateaus
  - ✅ Eventually marks as "Completed"
- **View Details** - See target views, reactions, emoji distribution, engagement progress percentage
- **Unique Results** - Each post gets randomized targets and different emoji selections

### Members
- **Browse Members** - Search and paginate through 24,388 simulated members
- **Member Profiles** - Username, display name, bio, avatar, join date, activity score
- **Filter** - Search by username or display name
- **Pagination** - 50 members per page for efficiency

### Analytics
- **Views Over Time** - Chart tracking post view progression
- **Online Timeline** - Concurrent member activity over time
- **Member Growth** - Community growth visualization
- **Reaction Distribution** - Breakdown of emoji usage

### Settings
- **Channel Info** - Customize channel name and description
- **Engagement Parameters**:
  - Minimum post views (default: 12,483)
  - Minimum post reactions (default: 8,234)
  - Reaction delay before engagement starts (default: 10 seconds)
  - Engagement randomness factor (default: 0.5)
- **Simulation Speed** - Multiplier for engagement curve progression
- **Reaction Emojis** - Customize the emoji palette (comma-separated)
- **Member Management** - Adjust member count, reseed, or reset all data

## 🎯 Understanding Engagement

### The Engagement Curve

Each post follows a realistic engagement progression:

```
Progress %   Timeline            Description
0-10%        0-10 sec           Waiting - No engagement yet
10-25%       10-30 sec          Slow Start - Initial reactions
25-75%       30-120 sec         Rapid Growth - Gaining momentum
75-95%       120-600 sec        Peak Activity - Maximum visibility
95-99%       600-1800 sec       Slowing - Engagement plateauing
99-100%      1800+ sec          Tail Activity - Final engagement
```

### Randomization System

- **Unique Targets**: Each post's view/reaction targets are randomized around your minimum settings
- **Variable Emojis**: Posts select 4-11 different emojis from your palette per post
- **Uneven Distribution**: First emoji gets 30-60% of reactions; others vary naturally
- **No Duplicates**: Each post's emoji selection is independent

### Settings Impact

| Setting | Effect |
|---------|--------|
| Randomness (0-1) | Higher = more variance in engagement numbers |
| Min Views | Baseline for randomized post views |
| Min Reactions | Baseline for randomized post reactions |
| Reaction Delay | Wait time (in seconds) before engagement appears |
| Sim Speed | How fast the engagement curve progresses (0.5x-5x) |

## 🌐 Mobile Access

### Access from Another Device on Your Network

1. **Get your Mac's IP address:**
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```
   Look for something like `192.168.1.100` or `10.0.0.50`

2. **On your phone (same WiFi):**
   - Open Safari or Chrome
   - Navigate to: `http://YOUR_IP:3000`
   - Example: `http://192.168.1.100:3000`

### What Works on Mobile
- ✅ Dashboard with stats and charts
- ✅ Posts page (create, view, track engagement)
- ✅ Members directory with search
- ✅ Analytics pages
- ✅ Full settings control
- ✅ Responsive design for all screen sizes

**Note:** Server must stay running and device must remain on the same WiFi network.

## 📡 API Reference

Base URL: `http://localhost:3000/api/`

All responses are JSON.

### Statistics
```
GET /api/stats
Returns: memberCount, onlineCount, totalViews, totalReactions, engagementRate, newMembersToday
```

### Settings Management
```
GET /api/settings
Returns: All current settings

POST /api/settings
Body: { setting_name: value, ... }
Updates specified settings
```

### Posts
```
GET /api/posts?page=1&limit=20
Returns: Paginated posts with reaction counts

POST /api/posts
Body: { text, image_url, author_id }
Creates new post and initializes engagement

GET /api/posts/:id
Returns: Single post with engagement details

GET /api/posts/:id/engagement
Returns: Engagement status with progress, secondsElapsed, targetViews, targetReactions
```

**Engagement Status Values:**
- `waiting` - In pre-engagement delay (0-10s)
- `starting` - Engagement initialization
- `active` - Currently receiving engagement updates
- `completed` - Reached 99%+ of target

### Members
```
GET /api/members?page=1&search=query
Returns: Paginated members, optionally filtered

GET /api/members/:id
Returns: Single member profile
```

### Simulation Control
```
POST /api/simulation/start
Starts engagement simulation loop

POST /api/simulation/stop
Stops simulation (data persists)

POST /api/simulation/reseed
Generates new members (preserves posts)

POST /api/simulation/reset
Clears all data (posts, reactions, members, stats)
```

## 🔧 Troubleshooting

### "Connection refused" / Can't reach localhost:3000
- ✓ Ensure server is running: `npm start`
- ✓ Check for port conflicts: `lsof -i :3000`
- ✓ Use different port: `PORT=3001 npm start`

### Posts created but no engagement appears
- ✓ This is **normal**! Engagement has a 10-second delay
- ✓ Check the status indicator (⏳ waiting → ● active → ✅ completed)
- ✓ Verify simulation is running (should see "Stop Simulation" button)
- ✓ Try increasing Sim Speed multiplier in Settings for faster progression

### "Database error" or "Cannot read property"
- Delete old database and reseed:
  ```bash
  rm -f data/premmos.db*
  npm run seed
  npm start
  ```

### Slow performance / Sluggish member pagination
- Reduce member count in Settings (10k-20k recommended for older Macs)
- Close other applications to free memory
- Use speed multiplier to test faster

### Charts not displaying
- Wait 30+ seconds for data to accumulate
- Ensure simulation is actively running
- Refresh browser page

### Mobile connection keeps dropping
- Ensure same WiFi network
- Mac must not sleep (System Preferences > Energy Saver)
- Refresh page if connection times out

## 📁 Project Structure

```
We-larp-on-telegram/
├── server.js                  # Express API & routes
├── simulator.js               # Engagement simulation engine
├── database.js                # SQLite schema & connection
├── seed.js                    # Member generation
├── package.json               # Dependencies
├── README.md                  # This file
├── data/
│   └── premmos.db             # SQLite database (auto-created)
└── public/
    ├── index.html             # Main UI
    ├── app.js                 # Frontend & real-time updates
    └── style.css              # Dark theme styling
```

## 🎓 How It Works

### Engagement Engine

When you create a post:
1. **Initialize**: Sets target views/reactions based on min values + randomness
2. **Select Emojis**: Picks 4-11 random emojis from your palette
3. **Distribute**: Assigns reactions unevenly (first emoji 30-60%, others vary)
4. **Wait**: Delays engagement for configured seconds (default 10s)
5. **Progress**: Follows engagement curve, updating counters smoothly
6. **Complete**: Marks finished at 99%+ of target

### Member Simulation

Each simulated member has:
- Unique username & display name
- Activity score (0.1 - 1.0) determining participation likelihood
- Personal probabilities for viewing, reacting, replying
- Avatar (generated SVG with initials)
- Bio and join date

### Data Persistence

SQLite stores:
- All settings and configuration
- 24,388 member profiles
- Created posts and their engagement state
- Reaction counts per post/emoji
- Historical stats for charts

## 🚀 Getting Started

```bash
# Quick start (all-in-one)
npm install && npm run seed && npm start
```

Then open `http://localhost:3000` and:
1. Click **▶ Start Simulation** on Dashboard
2. Go to **Posts** → **+ New Post**
3. Create a post
4. Watch engagement appear after 10 seconds
5. Visit **Analytics** to see charts
6. Try **Settings** to customize behavior

## 🎯 Example Scenarios

**Test 1: Different Engagement Numbers**
- Create 3 posts back-to-back
- Notice each gets unique randomized targets
- Check emoji distributions differ per post

**Test 2: Speed Multiplier**
- Create a post
- Change Sim Speed to 5x in Settings
- Watch full engagement curve complete in ~30 seconds

**Test 3: Delayed Reactions**
- Create a post
- Post appears immediately (visible)
- Wait exactly 10 seconds
- Reactions appear
- Demonstrates the realistic delay

**Test 4: Mobile Access**
- Get your Mac's IP
- Open simulator on phone via `http://IP:3000`
- Create posts from phone
- View desktop simultaneously
- Changes sync in real-time

## 📊 Sample Settings

**Conservative** (closer to actual numbers)
- Min Views: 5,000
- Min Reactions: 2,000
- Reaction Delay: 15s
- Randomness: 0.2
- Sim Speed: 1x

**Aggressive** (higher engagement)
- Min Views: 20,000
- Min Reactions: 15,000
- Reaction Delay: 5s
- Randomness: 0.8
- Sim Speed: 2x

**Fast Testing** (see curves quickly)
- Min Views: 1,000
- Min Reactions: 500
- Reaction Delay: 1s
- Randomness: 0.5
- Sim Speed: 5x

## 🔐 Security & Privacy

### What This IS
✅ A local entertainment/educational tool
✅ For learning community engagement patterns
✅ For UI/UX testing with realistic data
✅ For understanding social media dynamics
✅ 100% local, self-contained, no cloud

### What This IS NOT
❌ A tool to automate real Telegram accounts
❌ A spam/bot creation system
❌ Integrated with actual Telegram
❌ Designed to inflate real channel metrics
❌ Using any real Telegram API

---

**No real Telegram accounts. No cloud. No API automation. 100% Local Simulation.** 🎭

Built with ❤️ for Premmo's Cave
