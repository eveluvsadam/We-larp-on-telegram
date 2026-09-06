const { dbRun, dbAll, dbGet } = require('./database');

const firstNames = [
  'Alex', 'Jordan', 'Taylor', 'Casey', 'Morgan', 'Riley', 'Quinn', 'Avery',
  'Sky', 'Riley', 'Phoenix', 'Blake', 'Drew', 'Sydney', 'Vale', 'Gray',
  'Dana', 'Devon', 'Lane', 'Elliott', 'Fox', 'Harper', 'Rory', 'Scout',
  'Sage', 'Storm', 'Vale', 'River', 'Dakota', 'Brooklyn', 'Austin', 'Austin',
  'Echo', 'Jorie', 'Cody', 'Skyler', 'Rowan', 'Sage', 'Penn', 'Sage',
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Young',
  'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Peterson', 'Phillips', 'Campbell',
];

const adjectives = [
  'swift', 'cosmic', 'neon', 'cyber', 'void', 'blaze', 'frost', 'echo',
  'quantum', 'solar', 'lunar', 'cyber', 'ghost', 'shadow', 'crystal',
  'pixel', 'binary', 'hologram', 'plasma', 'nebula', 'storm', 'silent',
  'mystic', 'ethereal', 'spectral', 'phantom', 'chrome', 'prism', 'vortex'
];

const nouns = [
  'phoenix', 'dragon', 'wolf', 'tiger', 'eagle', 'serpent', 'raven', 'kitsune',
  'cipher', 'sentinel', 'vanguard', 'nexus', 'forge', 'beacon', 'oracle',
  'matrix', 'vector', 'spectre', 'phantom', 'wraith', 'shadow', 'echo',
  'whisper', 'silence', 'thunder', 'inferno', 'glacier', 'obsidian', 'onyx'
];

function generateUsername() {
  const styles = [
    () => `${adjectives[Math.floor(Math.random() * adjectives.length)]}_${nouns[Math.floor(Math.random() * nouns.length)]}`,
    () => `${firstNames[Math.floor(Math.random() * firstNames.length)]}${lastNames[Math.floor(Math.random() * lastNames.length)]}`,
    () => `${firstNames[Math.floor(Math.random() * firstNames.length)]}_${Math.floor(Math.random() * 9999)}`,
    () => `user_${Math.floor(Math.random() * 999999)}`,
  ];

  return styles[Math.floor(Math.random() * styles.length)]();
}

function generateDisplayName() {
  return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
}

function generateBio() {
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
    '',
  ];

  return bios[Math.floor(Math.random() * bios.length)];
}

function generateAvatarColor() {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#AED6F1',
    '#F5B7B1', '#A9DFBF', '#F9E79F', '#D7BDE2', '#ABEBC6'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

async function seedMembers(count = 20000) {
  console.log(`🌱 Seeding ${count} simulated members...`);

  // Clear existing members
  await dbRun('DELETE FROM members');

  const batchSize = 500;
  const usedUsernames = new Set();

  for (let i = 0; i < count; i += batchSize) {
    const batch = [];

    for (let j = 0; j < batchSize && i + j < count; j++) {
      let username;
      do {
        username = generateUsername();
      } while (usedUsernames.has(username));
      usedUsernames.add(username);

      const displayName = generateDisplayName();
      const bio = generateBio();
      const avatarColor = generateAvatarColor();

      // Random join date within last 180 days
      const joinDate = new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000);
      const joinDateStr = joinDate.toISOString();

      // Random activity score 0.1 - 1.0
      const activityScore = 0.1 + Math.random() * 0.9;

      // Activity probabilities vary by activity score
      const viewProb = Math.min(0.95, 0.2 + activityScore * 0.6);
      const reactionProb = Math.min(0.8, 0.1 + activityScore * 0.5);
      const replyProb = Math.min(0.3, 0.02 + activityScore * 0.2);

      batch.push({
        username,
        displayName,
        bio,
        avatar: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='${encodeURIComponent(avatarColor)}' width='200' height='200'/%3E%3Ctext x='50%' y='50%' font-size='80' fill='white' text-anchor='middle' dy='.3em' font-family='Arial'%3E${displayName.charAt(0)}%3C/text%3E%3C/svg%3E`,
        joinDateStr,
        activityScore,
        viewProb,
        reactionProb,
        replyProb
      });
    }

    // Insert batch
    for (const member of batch) {
      await dbRun(
        `INSERT INTO members (username, display_name, bio, avatar, join_date, activity_score, view_probability, reaction_probability, reply_probability)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [member.username, member.displayName, member.bio, member.avatar, member.joinDateStr, member.activityScore, member.viewProb, member.reactionProb, member.replyProb]
      );
    }

    const progress = Math.min(i + batchSize, count);
    process.stdout.write(`\r✨ Created ${progress}/${count} members`);
  }

  console.log(`\n✅ Successfully seeded ${count} simulated members!`);
}

async function run() {
  try {
    await seedMembers(20000);
    console.log('🎉 Database initialization complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding database:', err);
    process.exit(1);
  }
}

run();
