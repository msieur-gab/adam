/**
 * Reminder Service
 * Manages medication, hydration, and general reminders using service worker
 */

import { db } from './db-service.js';

export class ReminderService {
  constructor() {
    this.swReady = false;
    this.init();
  }

  async init() {
    // Check if service worker is available
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.ready;
        this.swReady = true;
        console.log('[ReminderService] Service worker ready');

        // Listen for service worker messages
        navigator.serviceWorker.addEventListener('message', this.handleSWMessage.bind(this));
      } catch (error) {
        console.error('[ReminderService] Service worker not available:', error);
      }
    }
  }

  /**
   * Handle messages from service worker
   */
  handleSWMessage(event) {
    const { type, data } = event.data;

    console.log('[ReminderService] Received from SW:', type, data);

    switch (type) {
      case 'REMINDER_FIRED':
        this.handleReminderFired(data);
        break;

      case 'REMINDER_COMPLETED':
        this.handleReminderCompleted(data);
        break;

      case 'REMINDER_SNOOZED':
        this.handleReminderSnoozed(data);
        break;

      case 'REMINDER_SKIPPED':
        this.handleReminderSkipped(data);
        break;

      default:
        break;
    }
  }

  /**
   * Schedule a medication reminder
   */
  async scheduleMedicationReminder(medication, scheduledFor) {
    if (!this.swReady || !navigator.serviceWorker.controller) {
      console.warn('[ReminderService] Service worker not ready, reminder will not be scheduled');
      return false;
    }

    const reminderId = `med-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Store in IndexedDB for persistence
    await db.reminders.add({
      id: reminderId,
      type: 'medication',
      scheduledFor: new Date(scheduledFor),
      completed: false,
      data: medication
    });

    // Schedule with service worker
    navigator.serviceWorker.controller.postMessage({
      type: 'SCHEDULE_REMINDER',
      data: {
        reminderId,
        scheduledFor: new Date(scheduledFor).toISOString(),
        type: 'medication',
        reminderData: medication
      }
    });

    console.log(`[ReminderService] Scheduled medication reminder: ${reminderId}`);
    return reminderId;
  }

  /**
   * Schedule a hydration reminder
   */
  async scheduleHydrationReminder(scheduledFor) {
    if (!this.swReady || !navigator.serviceWorker.controller) {
      console.warn('[ReminderService] Service worker not ready');
      return false;
    }

    const reminderId = `hydration-${Date.now()}`;

    await db.reminders.add({
      id: reminderId,
      type: 'hydration',
      scheduledFor: new Date(scheduledFor),
      completed: false,
      data: { message: 'Remember to drink water' }
    });

    navigator.serviceWorker.controller.postMessage({
      type: 'SCHEDULE_REMINDER',
      data: {
        reminderId,
        scheduledFor: new Date(scheduledFor).toISOString(),
        type: 'hydration',
        reminderData: { message: 'Remember to drink water' }
      }
    });

    console.log(`[ReminderService] Scheduled hydration reminder: ${reminderId}`);
    return reminderId;
  }

  /**
   * Schedule a general reminder
   */
  async scheduleGeneralReminder(message, scheduledFor) {
    if (!this.swReady || !navigator.serviceWorker.controller) {
      console.warn('[ReminderService] Service worker not ready');
      return false;
    }

    const reminderId = `general-${Date.now()}`;

    await db.reminders.add({
      id: reminderId,
      type: 'general',
      scheduledFor: new Date(scheduledFor),
      completed: false,
      data: { message }
    });

    navigator.serviceWorker.controller.postMessage({
      type: 'SCHEDULE_REMINDER',
      data: {
        reminderId,
        scheduledFor: new Date(scheduledFor).toISOString(),
        type: 'general',
        reminderData: { message }
      }
    });

    console.log(`[ReminderService] Scheduled general reminder: ${reminderId}`);
    return reminderId;
  }

  /**
   * Cancel a reminder
   */
  async cancelReminder(reminderId) {
    if (!this.swReady || !navigator.serviceWorker.controller) {
      return;
    }

    // Remove from IndexedDB
    await db.reminders.where('id').equals(reminderId).delete();

    // Cancel in service worker
    navigator.serviceWorker.controller.postMessage({
      type: 'CANCEL_REMINDER',
      data: { reminderId }
    });

    console.log(`[ReminderService] Cancelled reminder: ${reminderId}`);
  }

  /**
   * Get all active reminders from IndexedDB
   */
  async getActiveReminders() {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    return await db.reminders
      .where('scheduledFor')
      .between(now, endOfDay)
      .and(reminder => !reminder.completed)
      .sortBy('scheduledFor');
  }

  /**
   * Handle reminder fired event
   */
  async handleReminderFired(data) {
    console.log('[ReminderService] Reminder fired:', data);

    // Update notified status in DB
    await db.reminders.where('id').equals(data.reminderId).modify({
      notified: true
    });

    // Dispatch event for components to listen to
    window.dispatchEvent(new CustomEvent('reminder-fired', {
      detail: data
    }));
  }

  /**
   * Handle reminder completed event
   */
  async handleReminderCompleted(data) {
    console.log('[ReminderService] Reminder completed:', data);

    // Mark as completed in DB
    await db.reminders.where('id').equals(data.reminderId).modify({
      completed: true,
      completedAt: new Date()
    });

    // Dispatch event
    window.dispatchEvent(new CustomEvent('reminder-completed', {
      detail: data
    }));
  }

  /**
   * Handle reminder snoozed event
   */
  async handleReminderSnoozed(data) {
    console.log('[ReminderService] Reminder snoozed:', data);

    // Update snoozed count in DB
    const reminder = await db.reminders.where('id').equals(data.reminderId).first();
    if (reminder) {
      await db.reminders.where('id').equals(data.reminderId).modify({
        snoozedCount: (reminder.snoozedCount || 0) + 1
      });
    }

    // Dispatch event
    window.dispatchEvent(new CustomEvent('reminder-snoozed', {
      detail: data
    }));
  }

  /**
   * Handle reminder skipped event
   */
  async handleReminderSkipped(data) {
    console.log('[ReminderService] Reminder skipped:', data);

    // Mark as skipped in DB
    await db.reminders.where('id').equals(data.reminderId).modify({
      completed: true,
      skipped: true,
      completedAt: new Date()
    });

    // Dispatch event
    window.dispatchEvent(new CustomEvent('reminder-skipped', {
      detail: data
    }));
  }

  /**
   * Schedule medication reminders for today based on profile
   */
  async scheduleTodaysMedications(profile) {
    if (!profile?.medications) {
      return;
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    for (const med of profile.medications) {
      const scheduledTime = new Date(`${today}T${med.time}`);

      // Only schedule if in the future
      if (scheduledTime > now) {
        // Check if already scheduled
        const exists = await db.reminders
          .where('type').equals('medication')
          .and(reminder =>
            reminder.data.name === med.name &&
            new Date(reminder.scheduledFor).getTime() === scheduledTime.getTime() &&
            !reminder.completed
          )
          .first();

        if (!exists) {
          await this.scheduleMedicationReminder(med, scheduledTime);
        }
      }
    }
  }

  /**
   * Request notification permission
   */
  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      console.warn('[ReminderService] Notifications not supported');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }
}

// Export singleton instance
export const reminderService = new ReminderService();
