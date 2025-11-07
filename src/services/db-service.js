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
  modelCache: 'key, lastUpdated'
});

// Version 2: Add user profile and API cache
db.version(2).stores({
  // Keep all existing tables
  settings: 'key, data',
  reminders: '++id, type, scheduledFor, completed, completedAt',
  messages: '++id, from, receivedAt, acknowledged',
  photos: '++id, familyMember, uploadedAt',
  conversationLog: '++id, timestamp, input, output, type',
  modelCache: 'key, lastUpdated',

  // New: User profile table
  userProfile: 'key, data',

  // New: API cache for external service responses
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
    } else {
      // Migrate to new user profile structure
      await migrateToUserProfile();
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
 * Store user profile (personal data for context-aware responses)
 */
export async function saveUserProfile(profileData) {
  return db.userProfile.put({
    key: 'user',
    data: profileData
  });
}

/**
 * Get user profile
 */
export async function getUserProfile() {
  const result = await db.userProfile.get('user');
  return result?.data;
}

/**
 * Update specific user profile fields
 */
export async function updateUserProfile(updates) {
  const current = await getUserProfile();
  const updated = { ...current, ...updates };
  return saveUserProfile(updated);
}

/**
 * Migrate existing profile to new user profile structure
 */
export async function migrateToUserProfile() {
  try {
    // Check if migration already done
    const existingUserProfile = await getUserProfile();
    if (existingUserProfile) {
      console.log('User profile already migrated');
      return existingUserProfile;
    }

    // Get existing profile
    const oldProfile = await getProfile();
    if (!oldProfile) {
      console.log('No existing profile to migrate');
      return null;
    }

    // Create new user profile structure
    const userProfile = {
      // Identity
      name: oldProfile.name || '',
      nickname: oldProfile.nickname || '',
      birthdate: oldProfile.birthdate || null,
      age: oldProfile.age || null,

      // Location & Timezone
      location: {
        city: oldProfile.location?.city || '',
        country: oldProfile.location?.country || '',
        timezone: oldProfile.habits?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        coordinates: oldProfile.location?.coordinates || null
      },

      // Preferences
      preferences: {
        language: 'en',
        voiceGender: 'female',
        temperatureUnit: 'celsius',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '24h'
      },

      // Context for responses
      interests: oldProfile.activities || [],

      // Health (keep existing structure)
      medications: oldProfile.medications || [],
      doctors: oldProfile.doctors || [],
      diet: oldProfile.diet || [],

      // Family (keep existing structure)
      family: oldProfile.family || [],

      // Habits
      habits: oldProfile.habits || {},

      // Memory & Learning
      conversationPreferences: {
        formality: 'casual',
        verbosity: 'moderate',
        topicsToAvoid: []
      },

      // Privacy
      shareLocation: true,
      shareBirthdate: true,

      // Metadata
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save new user profile
    await saveUserProfile(userProfile);
    console.log('Profile migrated to user profile structure');

    return userProfile;

  } catch (error) {
    console.error('Profile migration failed:', error);
    return null;
  }
}
