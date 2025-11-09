/**
 * Reminder Plugin
 * Handles voice-triggered reminders
 * "remind me to call Maria in 30 minutes"
 * "set a reminder for 2 minutes"
 */

import { BasePlugin } from './plugin-base.js';
import { reminderService } from '../services/reminder-service.js';

export class ReminderPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'reminder',
      name: 'Reminder',
      version: '1.0.0',
      description: 'Voice-triggered reminders with natural language timing',
      author: 'ADAM Team'
    });
  }

  async initialize() {
    console.log('[ReminderPlugin] Initialized');
  }

  async cleanup() {
    console.log('[ReminderPlugin] Cleaned up');
  }

  getIntents() {
    return ['reminder_create'];
  }

  /**
   * Get NLU patterns for reminder detection
   */
  getNLUPatterns() {
    return {
      subjects: {
        reminder: {
          nouns: ['reminder', 'alarm', 'alert', 'notification', 'note'],
          verbs: ['remind', 'alert', 'notify', 'remember'],
          adjectives: [],
          priority: 10
        }
      },
      actions: {
        set: ['set', 'create', 'add', 'schedule', 'make'],
        remind: ['remind', 'alert', 'notify']
      },
      intents: {
        reminder_create: {
          patterns: [
            // "remind me to X"
            { action: 'remind', subject: 'reminder' },
            // "set a reminder"
            { action: 'set', subject: 'reminder' },
            // "remind me in X minutes"
            { action: 'remind', hasTime: true }
          ],
          examples: [
            "remind me to call Maria in 10 minutes",
            "set a reminder for 3pm",
            "remind me in 30 minutes",
            "set a reminder to take medicine",
            "remind me tomorrow at 9am"
          ]
        }
      }
    };
  }

  /**
   * Handle plugin queries
   */
  async handleQuery(intent, params) {
    console.log('[ReminderPlugin] handleQuery:', intent, params);

    if (intent === 'reminder_create') {
      return await this.handleCreateReminder(params);
    }

    return {
      success: false,
      error: `Unknown intent: ${intent}`
    };
  }

  /**
   * Handle reminder creation
   */
  async handleCreateReminder(params) {
    try {
      // Extract message and timing
      const message = this.extractMessage(params);

      // Try to extract timing from params (supports both NLU temporal entities and manual patterns)
      const timing = this.extractTiming(params);

      if (!timing) {
        return {
          success: false,
          error: 'Could not determine when to remind you',
          message: 'I need to know when to remind you. Try saying something like "remind me in 10 minutes" or "set a reminder for 3pm".'
        };
      }

      // Calculate scheduled time
      const scheduledFor = this.calculateScheduledTime(timing, params);

      if (scheduledFor <= new Date()) {
        return {
          success: false,
          error: 'Reminder time is in the past',
          message: 'That time has already passed. Please specify a future time.'
        };
      }

      // Schedule the reminder
      const reminderId = await reminderService.scheduleGeneralReminder(
        message || 'Reminder',
        scheduledFor
      );

      // Format response
      const timeDescription = this.formatTimeDescription(timing, scheduledFor);

      return {
        success: true,
        reminderId,
        scheduledFor: scheduledFor.toISOString(),
        message: `I'll remind you ${timeDescription}${message ? `: ${message}` : ''}`
      };

    } catch (error) {
      console.error('[ReminderPlugin] Error creating reminder:', error);
      return {
        success: false,
        error: error.message,
        message: 'Sorry, I couldn\'t create that reminder. Please try again.'
      };
    }
  }

  /**
   * Extract the message/task from parameters
   */
  extractMessage(params) {
    // Look for common patterns
    const allText = JSON.stringify(params).toLowerCase();

    // Pattern: "remind me to [message]"
    let match = allText.match(/remind me to ([^"]*?)(?:\s+in\s+|\s+at\s+|\s+for\s+|$)/i);
    if (match) {
      return match[1].trim();
    }

    // Pattern: "set a reminder to [message]"
    match = allText.match(/set a reminder to ([^"]*?)(?:\s+in\s+|\s+at\s+|\s+for\s+|$)/i);
    if (match) {
      return match[1].trim();
    }

    // If no specific message found, return null (will use default)
    return null;
  }

  /**
   * Extract timing information from parameters
   * Returns: { type: 'relative|absolute|temporal', value: number, unit: string, time: string, temporal: string }
   */
  extractTiming(params) {
    // Priority 1: Check for NLU-extracted temporal entities
    if (params.entities && params.entities.temporal) {
      const temporal = params.entities.temporal.toLowerCase();

      // Handle natural temporal expressions
      if (['tomorrow', 'today', 'tonight', 'morning', 'afternoon', 'evening'].includes(temporal)) {
        return {
          type: 'temporal',
          temporal: temporal
        };
      }
    }

    // Priority 2: Check raw temporal param (fallback for older NLU)
    if (params.temporal) {
      const temporal = params.temporal.toLowerCase();
      if (['tomorrow', 'today', 'tonight', 'morning', 'afternoon', 'evening'].includes(temporal)) {
        return {
          type: 'temporal',
          temporal: temporal
        };
      }
    }

    // Priority 3: Pattern matching in text
    const allText = JSON.stringify(params).toLowerCase();

    // Pattern 1: Relative time "in X minutes/hours"
    let match = allText.match(/in\s+(\d+)\s*(minute|min|minutes|hour|hours|hr)/i);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      return {
        type: 'relative',
        value,
        unit: unit.startsWith('hour') || unit === 'hr' ? 'hours' : 'minutes'
      };
    }

    // Pattern 2: Just number + unit "2 minutes"
    match = allText.match(/(\d+)\s*(minute|min|minutes|hour|hours|hr)/i);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      return {
        type: 'relative',
        value,
        unit: unit.startsWith('hour') || unit === 'hr' ? 'hours' : 'minutes'
      };
    }

    // Pattern 3: Absolute time "at 3pm" or "at 15:00"
    match = allText.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (match) {
      return {
        type: 'absolute',
        hour: parseInt(match[1]),
        minute: match[2] ? parseInt(match[2]) : 0,
        period: match[3] ? match[3].toLowerCase() : null
      };
    }

    return null;
  }

  /**
   * Calculate the actual Date for the reminder
   */
  calculateScheduledTime(timing, params = {}) {
    const now = new Date();

    if (timing.type === 'temporal') {
      // Natural temporal expressions: "tomorrow", "today", etc.
      const temporal = timing.temporal;
      const scheduled = new Date(now);

      // Default times for temporal expressions
      const defaultTimes = {
        'morning': { hour: 9, minute: 0 },
        'afternoon': { hour: 14, minute: 0 },
        'evening': { hour: 18, minute: 0 },
        'tonight': { hour: 20, minute: 0 }
      };

      if (temporal === 'tomorrow') {
        // Tomorrow at 9 AM by default
        scheduled.setDate(scheduled.getDate() + 1);
        scheduled.setHours(9, 0, 0, 0);
      } else if (temporal === 'today') {
        // Today, 1 hour from now
        return new Date(now.getTime() + 60 * 60 * 1000);
      } else if (defaultTimes[temporal]) {
        // Morning, afternoon, evening, tonight
        const time = defaultTimes[temporal];
        scheduled.setHours(time.hour, time.minute, 0, 0);

        // If time has passed today, schedule for tomorrow
        if (scheduled <= now) {
          scheduled.setDate(scheduled.getDate() + 1);
        }
      }

      return scheduled;

    } else if (timing.type === 'relative') {
      // Relative time: "in 10 minutes"
      const milliseconds = timing.unit === 'hours'
        ? timing.value * 60 * 60 * 1000
        : timing.value * 60 * 1000;

      return new Date(now.getTime() + milliseconds);

    } else if (timing.type === 'absolute') {
      // Absolute time: "at 3pm"
      let hour = timing.hour;

      // Handle 12-hour format
      if (timing.period) {
        if (timing.period === 'pm' && hour < 12) {
          hour += 12;
        } else if (timing.period === 'am' && hour === 12) {
          hour = 0;
        }
      }

      const scheduled = new Date(now);
      scheduled.setHours(hour, timing.minute, 0, 0);

      // If the time has passed today, schedule for tomorrow
      if (scheduled <= now) {
        scheduled.setDate(scheduled.getDate() + 1);
      }

      return scheduled;
    }

    return null;
  }

  /**
   * Format human-readable time description
   */
  formatTimeDescription(timing, scheduledFor) {
    if (timing.type === 'temporal') {
      // Natural temporal expressions
      const temporal = timing.temporal;
      const timeStr = scheduledFor.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      if (temporal === 'tomorrow') {
        return `tomorrow at ${timeStr}`;
      } else if (temporal === 'today') {
        return `in about an hour`;
      } else if (['morning', 'afternoon', 'evening', 'tonight'].includes(temporal)) {
        const now = new Date();
        const isToday = scheduledFor.toDateString() === now.toDateString();

        if (isToday) {
          return `${temporal} at ${timeStr}`;
        } else {
          return `tomorrow ${temporal} at ${timeStr}`;
        }
      }

      return temporal;

    } else if (timing.type === 'relative') {
      const value = timing.value;
      const unit = timing.unit === 'hours' ? (value === 1 ? 'hour' : 'hours') : (value === 1 ? 'minute' : 'minutes');
      return `in ${value} ${unit}`;
    } else if (timing.type === 'absolute') {
      const timeStr = scheduledFor.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      // Check if it's today or tomorrow
      const now = new Date();
      const isToday = scheduledFor.toDateString() === now.toDateString();

      if (isToday) {
        return `at ${timeStr} today`;
      } else {
        return `at ${timeStr} tomorrow`;
      }
    }

    return 'soon';
  }
}

// Export singleton instance
export const reminderPlugin = new ReminderPlugin();
export default ReminderPlugin;
