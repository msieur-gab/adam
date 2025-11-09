/**
 * Reminder Plugin v2
 * Demonstrates multi-turn parameter collection with Dialogflow architecture
 *
 * Features:
 * - Multi-turn parameter collection (prompts for missing params)
 * - Complex time parsing (relative, absolute, temporal)
 * - Smart message extraction
 * - Validation (prevents past times)
 *
 * Handles queries like:
 * - "Remind me to call Maria in 10 minutes" (complete)
 * - "Set a reminder" → prompts for message → prompts for time
 * - "Remind me in 30 minutes" → prompts for message
 * - "Remind me to call Maria" → prompts for time
 */

import { BasePlugin } from './plugin-base.js';
import { reminderService } from '../services/reminder-service.js';

export class ReminderPluginV2 extends BasePlugin {
  constructor() {
    super({
      id: 'reminder-v2',
      name: 'Reminder v2',
      version: '2.0.0',
      description: 'Multi-turn reminder creation with intelligent parameter collection',
      author: 'ADAM Team'
    });
  }

  async initialize() {
    console.log('[ReminderPluginV2] Initialized');
  }

  async cleanup() {
    console.log('[ReminderPluginV2] Cleaned up');
  }

  /**
   * Define intent flows
   */
  getIntentFlows() {
    return {
      reminder_create: {
        // Scoring rules
        scoringRules: {
          // Required: At least one reminder-related word
          required: [
            { nouns: ['reminder', 'alarm', 'alert', 'notification'] },
            { verbs: ['remind', 'alert', 'notify'] }
          ],

          // Boosters
          boosters: [
            { isCommand: true, boost: 0.2 },       // "Remind me..." +20%
            { hasTime: true, boost: 0.1 },         // "in 10 minutes" +10%
            { verbs: ['set', 'create', 'add'], boost: 0.1 }
          ],

          // Anti-patterns (prevent confusion with other intents)
          antiPatterns: [
            { nouns: ['weather', 'time', 'clock'], penalty: -0.5 }
          ]
        },

        // Parameters
        parameters: {
          message: {
            entity: 'any',
            required: true,
            prompt: 'What would you like to be reminded about?',
            extractor: (signals) => this.extractMessage(signals)
          },

          timing: {
            entity: 'any',  // Complex custom extraction
            required: true,
            prompt: 'When should I remind you?',
            extractor: (signals) => this.extractTiming(signals),
            // Validation function
            validator: (timing) => {
              if (!timing) return { valid: false, error: 'Could not understand the time' };

              const scheduledTime = this.calculateScheduledTime(timing);
              if (!scheduledTime) return { valid: false, error: 'Invalid time format' };

              if (scheduledTime <= new Date()) {
                return { valid: false, error: 'That time has already passed' };
              }

              return { valid: true };
            }
          }
        },

        // Fulfillment
        fulfill: async (params) => {
          try {
            console.log(`[ReminderPluginV2] Creating reminder: "${params.message}" at ${JSON.stringify(params.timing)}`);

            // Calculate scheduled time
            const scheduledFor = this.calculateScheduledTime(params.timing);

            // Schedule the reminder
            const reminderId = await reminderService.scheduleGeneralReminder(
              params.message,
              scheduledFor
            );

            // Format response
            const timeDescription = this.formatTimeDescription(params.timing, scheduledFor);

            return {
              text: `I'll remind you ${timeDescription}: ${params.message}`,
              data: {
                reminderId,
                message: params.message,
                scheduledFor: scheduledFor.toISOString(),
                timing: params.timing
              }
            };

          } catch (error) {
            console.error('[ReminderPluginV2] Error:', error);
            return {
              text: 'Sorry, I couldn\'t create that reminder. Please try again.',
              error: error.message
            };
          }
        },

        // Output contexts (for follow-ups)
        outputContexts: [
          {
            name: 'reminder-created',
            lifespan: 2,
            parameters: (result, params) => ({
              lastReminderId: result.data?.reminderId,
              lastMessage: params.message,
              lastTiming: params.timing
            })
          }
        ]
      }
    };
  }

  /**
   * Extract the message/task from signals
   * Handles patterns like:
   * - "remind me to call Maria"
   * - "set a reminder to take medicine"
   * - "call Maria" (when prompted)
   */
  extractMessage(signals) {
    const text = signals.originalText;
    const normalized = signals.normalizedText;

    // Pattern 1: "remind me to [message]"
    let match = text.match(/remind me to (.+?)(?:\s+in\s+|\s+at\s+|\s+for\s+|$)/i);
    if (match && match[1].trim()) {
      const message = match[1].trim();
      // Ensure it's not just a time expression
      if (!message.match(/^\d+\s*(minute|min|minutes|hour|hours|hr)s?$/i)) {
        return message;
      }
    }

    // Pattern 2: "set a reminder to [message]"
    match = text.match(/set (?:a |an )?reminder to (.+?)(?:\s+in\s+|\s+at\s+|\s+for\s+|$)/i);
    if (match && match[1].trim()) {
      const message = match[1].trim();
      if (!message.match(/^\d+\s*(minute|min|minutes|hour|hours|hr)s?$/i)) {
        return message;
      }
    }

    // Pattern 3: "set a reminder for [message]"
    // But NOT "set a reminder for 10 minutes"
    match = text.match(/set (?:a |an )?reminder for (.+?)(?:\s+in\s+|\s+at\s+|$)/i);
    if (match && match[1].trim()) {
      const message = match[1].trim();
      // Check if it's just a time expression (e.g., "10 minutes", "tomorrow")
      if (!message.match(/^\d+\s*(minute|min|minutes|hour|hours|hr)s?$/i) &&
          !message.match(/^(tomorrow|today|tonight|morning|afternoon|evening)$/i)) {
        return message;
      }
    }

    // Pattern 4: "remind me [message] in/at [time]"
    // e.g., "remind me to workout tomorrow" → "to workout tomorrow"
    // But we want to extract just "workout" without the time
    match = text.match(/remind me (?:to )?(.+?)(?:\s+(?:in|at|for|tomorrow|today|tonight)\s+|\s+(tomorrow|today|tonight|this morning|this afternoon|this evening)$)/i);
    if (match && match[1].trim()) {
      let message = match[1].trim();
      // Remove "to" if it's at the start
      message = message.replace(/^to\s+/i, '');
      if (message && !message.match(/^(reminder|a reminder|set|create)$/i)) {
        return message;
      }
    }

    // Pattern 5: Remove time expressions from text to get message
    // "call Maria in 10 minutes" → "call Maria"
    const withoutTime = text
      .replace(/\s+in\s+\d+\s*(minute|min|minutes|hour|hours|hr)s?/gi, '')
      .replace(/\s+at\s+\d{1,2}(?::\d{2})?\s*(am|pm)?/gi, '')
      .replace(/\s+(tomorrow|today|tonight|this morning|this afternoon|this evening)$/gi, '')
      .replace(/^(remind me to|set (?:a |an )?reminder to?|remind me)\s*/i, '')  // Made trailing space optional
      .trim();

    // Check if after removing time, we have a meaningful message
    // Don't return if it's just command words or empty
    if (withoutTime &&
        withoutTime !== normalized &&
        withoutTime.length > 0 &&
        !withoutTime.match(/^(set (?:a |an )?reminder|reminder|remind me|a reminder)$/i)) {
      return withoutTime;
    }

    // If we're in a collection state (user responding to prompt), use the full text
    // This allows natural responses like "call Maria" or "take my medicine"
    if (text.length > 0 && !text.match(/^(remind|set a reminder|set reminder|create a reminder)$/i)) {
      // Remove common time patterns
      const cleaned = text
        .replace(/\s+in\s+\d+\s*(minute|min|minutes|hour|hours|hr)s?/gi, '')
        .replace(/\s+at\s+\d{1,2}(?::\d{2})?\s*(am|pm)?/gi, '')
        .replace(/\s+(tomorrow|today|tonight|morning|afternoon|evening)$/gi, '')
        .trim();

      if (cleaned && cleaned.length > 2) {
        // BUT - don't return if it's just command words
        if (!cleaned.match(/^(set (?:a |an )?reminder|reminder|remind me|a reminder)$/i)) {
          return cleaned;
        }
      }
    }

    return null;
  }

  /**
   * Extract timing information from signals
   * Supports:
   * - Relative: "in 10 minutes", "in 2 hours"
   * - Absolute: "at 3pm", "at 15:30"
   * - Temporal: "tomorrow", "this evening", "tonight"
   */
  extractTiming(signals) {
    const text = signals.originalText;
    const normalized = signals.normalizedText;

    // Priority 1: Combined temporal + absolute time "tomorrow at 5pm", "today at 3:30"
    // This must come BEFORE checking for just temporal or just time
    const combinedMatch = text.match(/\b(tomorrow|today|tonight)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (combinedMatch) {
      return {
        type: 'combined',
        temporal: combinedMatch[1].toLowerCase(),
        hour: parseInt(combinedMatch[2]),
        minute: combinedMatch[3] ? parseInt(combinedMatch[3]) : 0,
        period: combinedMatch[4] ? combinedMatch[4].toLowerCase() : null
      };
    }

    // Priority 2: Check for temporal expressions from NLU (only if no time specified)
    if (signals.dates && signals.dates.length > 0) {
      const dateEntity = signals.dates[0];
      if (['tomorrow', 'today', 'tonight'].includes(dateEntity.type)) {
        return {
          type: 'temporal',
          temporal: dateEntity.type
        };
      }
    }

    // Priority 3: Pattern matching for "this morning/afternoon/evening"
    const temporalMatch = text.match(/\b(this )?(morning|afternoon|evening|tonight)\b/i);
    if (temporalMatch) {
      return {
        type: 'temporal',
        temporal: temporalMatch[2].toLowerCase()
      };
    }

    // Priority 4: Relative time "in X minutes/hours"
    let match = text.match(/\bin\s+(\d+)\s*(minute|min|minutes|hour|hours|hr)s?/i);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      return {
        type: 'relative',
        value,
        unit: unit.startsWith('hour') || unit === 'hr' ? 'hours' : 'minutes'
      };
    }

    // Priority 4: Just number + unit "30 minutes from now"
    match = text.match(/(\d+)\s*(minute|min|minutes|hour|hours|hr)s?(?:\s+from now)?/i);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      return {
        type: 'relative',
        value,
        unit: unit.startsWith('hour') || unit === 'hr' ? 'hours' : 'minutes'
      };
    }

    // Priority 5: Absolute time "at 3pm" or "at 15:00"
    match = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (match) {
      return {
        type: 'absolute',
        hour: parseInt(match[1]),
        minute: match[2] ? parseInt(match[2]) : 0,
        period: match[3] ? match[3].toLowerCase() : null
      };
    }

    // Priority 6: Check for NLU-extracted times
    if (signals.times && signals.times.length > 0) {
      const time = signals.times[0];
      // Try to parse it
      const timeMatch = time.text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (timeMatch) {
        return {
          type: 'absolute',
          hour: parseInt(timeMatch[1]),
          minute: timeMatch[2] ? parseInt(timeMatch[2]) : 0,
          period: timeMatch[3] ? timeMatch[3].toLowerCase() : null
        };
      }
    }

    // Priority 7: Temporal words in normalized text
    if (normalized.includes('tomorrow')) {
      return { type: 'temporal', temporal: 'tomorrow' };
    }
    if (normalized.includes('tonight')) {
      return { type: 'temporal', temporal: 'tonight' };
    }
    if (normalized.includes('morning')) {
      return { type: 'temporal', temporal: 'morning' };
    }
    if (normalized.includes('afternoon')) {
      return { type: 'temporal', temporal: 'afternoon' };
    }
    if (normalized.includes('evening')) {
      return { type: 'temporal', temporal: 'evening' };
    }

    return null;
  }

  /**
   * Calculate the actual Date for the reminder
   */
  calculateScheduledTime(timing) {
    if (!timing) return null;

    const now = new Date();

    if (timing.type === 'combined') {
      // Combined temporal + time: "tomorrow at 5pm", "today at 3:30"
      const scheduled = new Date(now);
      let hour = timing.hour;

      // Handle 12-hour format
      if (timing.period) {
        if (timing.period === 'pm' && hour < 12) {
          hour += 12;
        } else if (timing.period === 'am' && hour === 12) {
          hour = 0;
        }
      } else if (hour <= 12 && !timing.period) {
        // If no period specified and hour is ambiguous (1-12), assume PM for times 1-5, AM for 6-12
        if (hour >= 1 && hour <= 5) {
          hour += 12; // 1-5 becomes PM (13-17)
        }
      }

      scheduled.setHours(hour, timing.minute, 0, 0);

      // Apply temporal offset
      if (timing.temporal === 'tomorrow') {
        scheduled.setDate(scheduled.getDate() + 1);
      } else if (timing.temporal === 'today') {
        // Keep today, but if time has passed, move to tomorrow
        if (scheduled <= now) {
          scheduled.setDate(scheduled.getDate() + 1);
        }
      } else if (timing.temporal === 'tonight') {
        // Tonight - keep today, but if time has passed, move to tomorrow
        if (scheduled <= now) {
          scheduled.setDate(scheduled.getDate() + 1);
        }
      }

      return scheduled;

    } else if (timing.type === 'temporal') {
      // Natural temporal expressions: "tomorrow", "tonight", etc.
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
    if (timing.type === 'combined') {
      // Combined temporal + time: "tomorrow at 5pm"
      const timeStr = scheduledFor.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      if (timing.temporal === 'tomorrow') {
        return `tomorrow at ${timeStr}`;
      } else if (timing.temporal === 'today') {
        return `today at ${timeStr}`;
      } else if (timing.temporal === 'tonight') {
        return `tonight at ${timeStr}`;
      }

      return `at ${timeStr}`;

    } else if (timing.type === 'temporal') {
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
      const unit = timing.unit === 'hours'
        ? (value === 1 ? 'hour' : 'hours')
        : (value === 1 ? 'minute' : 'minutes');
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
export const reminderPluginV2 = new ReminderPluginV2();
export default ReminderPluginV2;
