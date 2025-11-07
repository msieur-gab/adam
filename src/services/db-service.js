import Dexie from 'dexie';

/**
 * ADAM Database Schema
 * Local-first storage using Dexie.js (IndexedDB wrapper)
 */
export const db = new Dexie('adam-companion');

db.version(1).stores({
  // App settings and companion profile
  settings: 'key, data',

  // Scheduled reminders
  reminders: '++id, type, scheduledFor, completed, completedAt',

  // Family messages
  messages: '++id, from, receivedAt, acknowledged',

  // Photo gallery
  photos: '++id, familyMember, uploadedAt',

  // Conversation history
  conversationLog: '++id, timestamp, input, output, type',

  // Model cache metadata
  modelCache: 'key, lastUpdated',

  // API response cache (for NLU services)
  apiCache: 'key, timestamp, ttl'
});

/**
 * Initialize default data if needed
 */
export async function initializeDatabase() {
  try {
    const profileExists = await db.settings.get('profile');

    if (!profileExists) {
      console.log('No profile found - awaiting family configuration');
    }

    // Check for due reminders on startup
    await checkReminders();

    return true;
  } catch (error) {
    console.error('Database initialization failed:', error);
    return false;
  }
}

/**
 * Check for due reminders
 */
export async function checkReminders() {
  const now = new Date();
  const dueReminders = await db.reminders
    .where('scheduledFor')
    .below(now)
    .and(reminder => !reminder.completed)
    .toArray();

  return dueReminders;
}

/**
 * Mark reminder as completed
 */
export async function completeReminder(reminderId) {
  return db.reminders.update(reminderId, {
    completed: true,
    completedAt: new Date()
  });
}

/**
 * Add conversation to history
 */
export async function logConversation(input, output, type = 'chat') {
  return db.conversationLog.add({
    timestamp: new Date(),
    input,
    output,
    type
  });
}

/**
 * Get recent conversations
 */
export async function getRecentConversations(limit = 10) {
  return db.conversationLog
    .orderBy('timestamp')
    .reverse()
    .limit(limit)
    .toArray();
}

/**
 * Store companion profile
 */
export async function saveProfile(profileData) {
  return db.settings.put({
    key: 'profile',
    data: profileData
  });
}

/**
 * Get companion profile
 */
export async function getProfile() {
  const result = await db.settings.get('profile');
  return result?.data;
}

/**
 * Alias for getProfile (used by NLU services)
 */
export const getUserProfile = getProfile;
