# 🎭 Premmo's Cave - Community Simulator

A local-only Telegram-style community simulator built with Node.js, SQLite, and vanilla JavaScript. Run a convincing simulation of a 20,000-member community entirely on your Mac mini, with no cloud services or real Telegram integration.

## ✨ Features

- **📊 Dashboard** - Real-time stats: members, online count, views, reactions, engagement rate
- **👥 20,000 Simulated Members** - Realistic profiles with bios, activity levels, and participation probabilities
- **📝 Posts** - Create posts and watch them gain simulated engagement
- **💬 Reactions** - Six emoji reactions (❤️ 👍 😂 🔥 😢 😡) with simulated distribution
- **🟢 Real-time Simulation** - Watch activity unfold in real-time with adjustable speed
- **📈 Analytics** - Charts for views, reactions, online members, and member growth
- **👤 Member List** - Searchable member directory with pagination (50 per page)
- **⚙️ Settings** - Adjust probabilities, channel info, member count, and simulation speed
- **💾 Data Persistence** - Everything stored locally in SQLite
- **🗑️ Reset** - Clear all data and regenerate members with one click

## 🛑 Important - NO Real Telegram Integration

This simulator is **100% local** and **completely independent** from Telegram:

- ✅ All 20,000 members exist only in the local SQLite database
- ✅ No real Telegram accounts are created, registered, or automated
- ✅ No fake accounts, session files, proxies, or API automation
- ✅ No interaction with real Telegram channels or users
- ✅ Everything runs on your machine with zero cloud dependencies

This is purely a demonstration/testing tool for understanding how large communities behave.

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ (download from https://nodejs.org)
- macOS (or any system that runs Node.js)

### Installation & Setup

```bash
# 1. Clone or enter the project directory
cd /path/to/premmos-cave

# 2. Install dependencies
npm install

# 3. Start the server
npm start
```

The server will start at `http://localhost:3000`

### First-Time Setup

1. Open http://localhost:3000 in your browser
2. Go to **Settings**
3. Click **🌱 Reseed Members** to generate 20,000 simulated members
4. Wait for the seeding to complete (progress updates shown)
5. Go back to **Dashboard**
6. Click **▶ Start Simulation** to begin watching activity

## 📋 Usage Guide

### Dashboard
- **Start/Stop Simulation** - Toggle the activity simulation
- **Speed Control** - Choose Slow (0.5x), Normal (1x), or Fast (2x)
- **Live Stats** - View online count, total views, reactions, and engagement rate
- **Activity Graph** - See online member count over the last 24 hours

### Posts
- **Create Posts** - Write text posts with optional image URLs
- **Auto Engagement** - Once simulation is running, posts automatically gain views and reactions
- **Realistic Distribution** - Engagement follows configurable probability patterns

### Members
- **Browse Members** - View the 20,000 simulated members
- **Search** - Filter by name or username
- **Activity Levels** - Each member has a unique activity score (0-100%)
- **Online Status** - Real-time online/offline status updates

### Analytics
- **Views Over Time** - Chart of post views
- **Online Timeline** - Active member count over time
- **Member Growth** - Simulated new members joining
- **Reaction Distribution** - Breakdown of all emoji reactions

### Settings
- **Channel Info** - Customize the channel name and description
- **Simulation Parameters** - Adjust probabilities
- **Member Management** - Generate 100 to 100,000 members
- **Reset** - Clear all data

## 🎯 How the Simulation Works

### Activity Engine
When simulation is running every 2 seconds:
1. Posts get simulated views based on member probability
2. Members randomly react with emoji
3. Members have a chance to reply
4. Online status updates randomly

### Member Participation
- Each member has individual probabilities
- Activity scores (0.1 - 1.0) influence their participation
- More active members engage more often

### Realistic Behavior
- Views accumulate gradually
- Reaction counts increase organically
- Not every member views every post
- Activity patterns vary by member

## 📁 Project Structure

```
premmos-cave/
├── server.js              # Express server & API
├── database.js            # SQLite setup
├── simulator.js           # Simulation engine
├── seed.js                # Member generator
├── package.json
├── README.md
├── data/
│   └── premmos.db         # SQLite database (auto-created)
└── public/
    ├── index.html         # UI
    ├── style.css          # Styling
    └── app.js             # Frontend logic
```

## 🚀 Start Now

```bash
npm install
npm start
```

Then open http://localhost:3000 and go to Settings to reseed members!

---

**No real Telegram accounts. No cloud. No automation. 100% Local Simulation.** 🎭
