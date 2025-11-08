/**
 * ADAM Service Worker
 * Handles background tasks like ambient sound timers and reminders
 */

const CACHE_NAME = 'adam-v1';
const CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Active timers and reminders stored in memory
const activeTimers = new Map();
const activeReminders = new Map(); // For medication/hydration/general reminders

/**
 * Install event - cache essential resources
 */
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching app shell');
      return cache.addAll(CACHE_URLS);
    }).catch(err => {
      console.error('[ServiceWorker] Cache install failed:', err);
    })
  );

  // Activate immediately
  self.skipWaiting();
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  // Take control of all pages immediately
  return self.clients.claim();
});

/**
 * Message handler - receives commands from the app
 */
self.addEventListener('message', (event) => {
  console.log('[ServiceWorker] Received message:', event.data);

  const { type, data } = event.data;

  switch (type) {
    case 'SCHEDULE_TIMER':
      handleScheduleTimer(data, event.source);
      break;

    case 'CANCEL_TIMER':
      handleCancelTimer(data);
      break;

    case 'GET_ACTIVE_TIMERS':
      handleGetActiveTimers(event.source);
      break;

    case 'SCHEDULE_REMINDER':
      handleScheduleReminder(data, event.source);
      break;

    case 'CANCEL_REMINDER':
      handleCancelReminder(data);
      break;

    case 'GET_REMINDERS':
      handleGetReminders(event.source);
      break;

    case 'SNOOZE_REMINDER':
      handleSnoozeReminder(data);
      break;

    default:
      console.warn('[ServiceWorker] Unknown message type:', type);
  }
});

/**
 * Schedule a timer to stop ambient sound
 */
function handleScheduleTimer(data, client) {
  const { timerId, duration, soundName } = data;

  console.log(`[ServiceWorker] Scheduling timer ${timerId} for ${duration} minutes`);

  // Cancel existing timer if any
  if (activeTimers.has(timerId)) {
    clearTimeout(activeTimers.get(timerId).timeoutId);
  }

  // Calculate expiry time
  const expiryTime = Date.now() + (duration * 60 * 1000);

  // Set timeout
  const timeoutId = setTimeout(() => {
    console.log(`[ServiceWorker] Timer ${timerId} expired - notifying client`);

    // Send message to all clients to stop the sound
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'TIMER_EXPIRED',
          data: { timerId, soundName }
        });
      });
    });

    // Show notification
    self.registration.showNotification('ADAM', {
      body: `${soundName} ambient sound timer ended`,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `timer-${timerId}`,
      requireInteraction: false,
      silent: true
    });

    // Remove from active timers
    activeTimers.delete(timerId);
  }, duration * 60 * 1000);

  // Store timer info
  activeTimers.set(timerId, {
    timeoutId,
    expiryTime,
    soundName,
    duration
  });

  // Confirm to client
  client.postMessage({
    type: 'TIMER_SCHEDULED',
    data: { timerId, expiryTime }
  });
}

/**
 * Cancel an active timer
 */
function handleCancelTimer(data) {
  const { timerId } = data;

  console.log(`[ServiceWorker] Cancelling timer ${timerId}`);

  if (activeTimers.has(timerId)) {
    const timer = activeTimers.get(timerId);
    clearTimeout(timer.timeoutId);
    activeTimers.delete(timerId);

    console.log(`[ServiceWorker] Timer ${timerId} cancelled`);
  } else {
    console.warn(`[ServiceWorker] Timer ${timerId} not found`);
  }
}

/**
 * Get list of active timers
 */
function handleGetActiveTimers(client) {
  const timers = Array.from(activeTimers.entries()).map(([timerId, timer]) => ({
    timerId,
    soundName: timer.soundName,
    duration: timer.duration,
    expiryTime: timer.expiryTime,
    remainingMs: timer.expiryTime - Date.now()
  }));

  client.postMessage({
    type: 'ACTIVE_TIMERS',
    data: { timers }
  });
}

/**
 * Schedule a medication/hydration/general reminder
 */
function handleScheduleReminder(data, client) {
  const { reminderId, scheduledFor, type, reminderData } = data;

  console.log(`[ServiceWorker] Scheduling ${type} reminder ${reminderId} for ${new Date(scheduledFor).toLocaleString()}`);

  // Cancel existing reminder if any
  if (activeReminders.has(reminderId)) {
    clearTimeout(activeReminders.get(reminderId).timeoutId);
  }

  const now = Date.now();
  const scheduledTime = new Date(scheduledFor).getTime();
  const delay = scheduledTime - now;

  // Only schedule if in the future
  if (delay <= 0) {
    console.warn(`[ServiceWorker] Reminder ${reminderId} is in the past, skipping`);
    return;
  }

  // Set timeout
  const timeoutId = setTimeout(() => {
    console.log(`[ServiceWorker] Reminder ${reminderId} fired - showing notification`);

    // Show notification with actions
    const notificationOptions = {
      body: getReminderBody(type, reminderData),
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `reminder-${reminderId}`,
      requireInteraction: true, // Keep notification visible until user interacts
      vibrate: [200, 100, 200], // Vibration pattern
      actions: getReminderActions(type),
      data: {
        reminderId,
        type,
        reminderData,
        scheduledFor
      }
    };

    self.registration.showNotification(
      getReminderTitle(type, reminderData),
      notificationOptions
    );

    // Send message to clients
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'REMINDER_FIRED',
          data: { reminderId, type, reminderData }
        });
      });
    });

    // Remove from active reminders
    activeReminders.delete(reminderId);
  }, delay);

  // Store reminder info
  activeReminders.set(reminderId, {
    timeoutId,
    scheduledFor: scheduledTime,
    type,
    reminderData
  });

  // Confirm to client
  client.postMessage({
    type: 'REMINDER_SCHEDULED',
    data: { reminderId, scheduledFor: scheduledTime }
  });
}

/**
 * Cancel a reminder
 */
function handleCancelReminder(data) {
  const { reminderId } = data;

  console.log(`[ServiceWorker] Cancelling reminder ${reminderId}`);

  if (activeReminders.has(reminderId)) {
    const reminder = activeReminders.get(reminderId);
    clearTimeout(reminder.timeoutId);
    activeReminders.delete(reminderId);
    console.log(`[ServiceWorker] Reminder ${reminderId} cancelled`);
  } else {
    console.warn(`[ServiceWorker] Reminder ${reminderId} not found`);
  }
}

/**
 * Get list of active reminders
 */
function handleGetReminders(client) {
  const reminders = Array.from(activeReminders.entries()).map(([reminderId, reminder]) => ({
    reminderId,
    type: reminder.type,
    reminderData: reminder.reminderData,
    scheduledFor: reminder.scheduledFor,
    remainingMs: reminder.scheduledFor - Date.now()
  }));

  client.postMessage({
    type: 'ACTIVE_REMINDERS',
    data: { reminders }
  });
}

/**
 * Snooze a reminder (reschedule for 10 minutes later)
 */
function handleSnoozeReminder(data) {
  const { reminderId } = data;

  if (activeReminders.has(reminderId)) {
    const reminder = activeReminders.get(reminderId);

    // Cancel current timeout
    clearTimeout(reminder.timeoutId);

    // Reschedule for 10 minutes later
    const newScheduledFor = Date.now() + (10 * 60 * 1000);

    // Create new timeout
    const timeoutId = setTimeout(() => {
      console.log(`[ServiceWorker] Snoozed reminder ${reminderId} fired`);

      // Show notification again
      const notificationOptions = {
        body: getReminderBody(reminder.type, reminder.reminderData),
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: `reminder-${reminderId}`,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        actions: getReminderActions(reminder.type),
        data: {
          reminderId,
          type: reminder.type,
          reminderData: reminder.reminderData,
          scheduledFor: newScheduledFor
        }
      };

      self.registration.showNotification(
        getReminderTitle(reminder.type, reminder.reminderData),
        notificationOptions
      );

      activeReminders.delete(reminderId);
    }, 10 * 60 * 1000);

    // Update reminder with new timeout
    reminder.timeoutId = timeoutId;
    reminder.scheduledFor = newScheduledFor;

    console.log(`[ServiceWorker] Reminder ${reminderId} snoozed for 10 minutes`);
  }
}

/**
 * Get reminder title based on type
 */
function getReminderTitle(type, data) {
  switch (type) {
    case 'medication':
      return '💊 Medication Reminder';
    case 'hydration':
      return '💧 Hydration Reminder';
    case 'general':
      return '🔔 Reminder';
    default:
      return 'ADAM Reminder';
  }
}

/**
 * Get reminder body text
 */
function getReminderBody(type, data) {
  switch (type) {
    case 'medication':
      return `Time to take ${data.name} (${data.dosage || ''})${data.notes ? ' - ' + data.notes : ''}`;
    case 'hydration':
      return 'Remember to drink water';
    case 'general':
      return data.message || 'You have a reminder';
    default:
      return 'Reminder notification';
  }
}

/**
 * Get notification actions based on reminder type
 */
function getReminderActions(type) {
  switch (type) {
    case 'medication':
      return [
        { action: 'taken', title: '✓ Taken', icon: '/icons/icon-192.png' },
        { action: 'snooze', title: '⏰ Snooze 10min', icon: '/icons/icon-192.png' },
        { action: 'skip', title: '✗ Skip', icon: '/icons/icon-192.png' }
      ];
    case 'hydration':
      return [
        { action: 'done', title: '✓ Done', icon: '/icons/icon-192.png' },
        { action: 'snooze', title: '⏰ Later', icon: '/icons/icon-192.png' }
      ];
    case 'general':
      return [
        { action: 'dismiss', title: '✓ Dismiss', icon: '/icons/icon-192.png' },
        { action: 'snooze', title: '⏰ Snooze', icon: '/icons/icon-192.png' }
      ];
    default:
      return [];
  }
}

/**
 * Handle notification click events
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification clicked:', event.action);

  event.notification.close();

  const { reminderId, type, reminderData } = event.notification.data || {};

  // Handle different actions
  if (event.action === 'taken' || event.action === 'done' || event.action === 'dismiss') {
    // Mark as completed - send message to clients
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'REMINDER_COMPLETED',
          data: { reminderId, type, reminderData, action: event.action }
        });
      });
    });

    // Remove from active reminders
    if (activeReminders.has(reminderId)) {
      clearTimeout(activeReminders.get(reminderId).timeoutId);
      activeReminders.delete(reminderId);
    }

  } else if (event.action === 'snooze') {
    // Snooze the reminder
    handleSnoozeReminder({ reminderId });

    // Notify clients
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'REMINDER_SNOOZED',
          data: { reminderId, type, reminderData }
        });
      });
    });

  } else if (event.action === 'skip') {
    // Skip this reminder
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'REMINDER_SKIPPED',
          data: { reminderId, type, reminderData }
        });
      });
    });

    // Remove from active reminders
    if (activeReminders.has(reminderId)) {
      clearTimeout(activeReminders.get(reminderId).timeoutId);
      activeReminders.delete(reminderId);
    }

  } else {
    // No action (just clicked the notification body) - open the app
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        // Focus existing window or open new one
        if (clients.length > 0) {
          return clients[0].focus();
        } else {
          return self.clients.openWindow('/');
        }
      })
    );
  }
});

/**
 * Fetch event - serve from cache when possible
 */
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      return response || fetch(event.request);
    })
  );
});

console.log('[ServiceWorker] Script loaded');
