/**
 * Time Plugin
 * Simple plugin demonstrating the new Dialogflow-style intent architecture
 *
 * Handles queries like:
 * - "What time is it?"
 * - "What's the time?"
 * - "Tell me the time"
 */

import { BasePlugin } from './plugin-base.js';

export class TimePlugin extends BasePlugin {
  constructor() {
    super({
      id: 'time',
      name: 'Time',
      version: '1.0.0',
      description: 'Provides current time information',
      author: 'ADAM Team'
    });
  }

  async initialize() {
    console.log('[TimePlugin] Initialized');
  }

  async cleanup() {
    console.log('[TimePlugin] Cleaned up');
  }

  /**
   * Define intent flows using new declarative architecture
   */
  getIntentFlows() {
    return {
      time_query: {
        // Scoring rules - what words/signals trigger this intent?
        scoringRules: {
          // At least ONE of these must match
          required: [
            { nouns: ['time', 'clock', 'hour'] }
          ],

          // Boosters increase confidence
          boosters: [
            { isQuestion: true, boost: 0.2 },  // "What time is it?" gets +20%
            { verbs: ['tell', 'show', 'give'], boost: 0.1 }  // "Tell me the time" gets +10%
          ],

          // Anti-patterns reduce confidence (prevent false positives)
          antiPatterns: [
            { nouns: ['weather', 'reminder', 'alarm'], penalty: -0.5 }  // Not about time queries
          ]
        },

        // Parameters needed (none for this simple query)
        parameters: {},

        // Fulfillment function - what to do when intent matches
        fulfill: async (params) => {
          const now = new Date();

          // Format time in user-friendly way
          const timeStr = now.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });

          return {
            text: `It's ${timeStr}`,
            data: {
              time: timeStr,
              timestamp: now.toISOString(),
              hour: now.getHours(),
              minute: now.getMinutes()
            }
          };
        },

        // No output contexts needed for this simple query
        // (No follow-up conversations like "And tomorrow?")
        outputContexts: [],

        // No follow-ups defined
        // (Could add: "What about in Paris?" to show time in different timezone)
        followUps: {}
      }
    };
  }
}

// Export singleton instance
export const timePlugin = new TimePlugin();
export default TimePlugin;
