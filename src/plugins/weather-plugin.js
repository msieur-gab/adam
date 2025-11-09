/**
 * Weather Plugin
 * Demonstrates the full power of Dialogflow-style architecture
 *
 * Features:
 * - Parameter extraction (location, timeframe)
 * - Default parameters
 * - Output contexts for follow-ups
 * - Follow-up handlers ("And tomorrow?", "What about Paris?")
 * - Custom parameter extractors
 *
 * Handles queries like:
 * - "What's the weather?"
 * - "Weather tomorrow in Paris"
 * - "How's the weather next week?"
 * Then follow-ups:
 * - "And tomorrow?"
 * - "What about London?"
 */

import { BasePlugin } from './plugin-base.js';
import { weatherService } from '../api/weather-service.js';

export class WeatherPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'weather',
      name: 'Weather',
      version: '1.0.0',
      description: 'Provides weather information with follow-up support',
      author: 'ADAM Team'
    });

    // Default location (TODO: Get from user preferences)
    this.defaultLocation = 'San Francisco';
  }

  async initialize() {
    console.log('[WeatherPlugin] Initialized');
  }

  async cleanup() {
    console.log('[WeatherPlugin] Cleaned up');
  }

  /**
   * Define intent flows
   */
  getIntentFlows() {
    return {
      weather_query: {
        // Scoring rules
        scoringRules: {
          // Required: At least one weather-related word
          required: [
            { nouns: ['weather', 'forecast', 'temperature', 'rain', 'snow', 'conditions'] },
            { verbs: ['weather', 'rain', 'snow'] },
            { adjectives: ['sunny', 'cloudy', 'rainy', 'hot', 'cold', 'warm'] }
          ],

          // Boosters
          boosters: [
            { isQuestion: true, boost: 0.2 },      // "What's the weather?" +20%
            { hasPlace: true, boost: 0.2 },        // "in Paris" +20%
            { hasDate: true, boost: 0.1 },         // "tomorrow" +10%
            { verbs: ['rain', 'snow'], boost: 0.15 }, // "Will it rain?" +15%
            { hasContext: 'weather-followup', boost: 0.4 }  // Follow-up +40%
          ],

          // Anti-patterns (prevent false matches)
          antiPatterns: [
            { nouns: ['reminder', 'alarm', 'time'], penalty: -0.5 }
          ]
        },

        // Parameters
        parameters: {
          location: {
            entity: 'place',
            required: false,
            default: () => this.defaultLocation,
            prompt: 'Which location?'
          },

          timeframe: {
            entity: 'date',
            required: false,
            default: 'today',
            // Custom extractor to handle various temporal expressions
            extractor: (signals) => this.extractTimeframe(signals)
          }
        },

        // Fulfillment
        fulfill: async (params) => {
          try {
            console.log(`[WeatherPlugin] Fetching weather for ${params.location} (${params.timeframe})`);

            // Fetch weather data
            const weather = await weatherService.query({
              location: params.location,
              date: params.timeframe === 'today' ? null : params.timeframe
            });

            // Format response based on timeframe
            const timeDesc = this.formatTimeframeDescription(params.timeframe);
            const tempUnit = '°F'; // TODO: Get from user preferences

            const response = `The weather ${timeDesc} in ${weather.location} will be ${weather.conditions}, ` +
                           `${Math.round(weather.temperature.current)}${tempUnit}. ` +
                           `Humidity ${weather.humidity}%, wind speed ${Math.round(weather.windSpeed)} mph.`;

            return {
              text: response,
              data: {
                location: weather.location,
                timeframe: params.timeframe,
                weather
              }
            };

          } catch (error) {
            console.error('[WeatherPlugin] Error:', error);
            return {
              text: `Sorry, I couldn't get the weather for ${params.location}. Please try again.`,
              error: error.message
            };
          }
        },

        // Output contexts (for follow-ups)
        outputContexts: [
          {
            name: 'weather-followup',
            lifespan: 2,
            parameters: (result, params) => ({
              lastLocation: params.location,
              lastTimeframe: params.timeframe,
              lastWeather: result.data?.weather
            })
          }
        ],

        // Follow-up handlers
        followUps: {
          // "And tomorrow?" or "What about next week?"
          temporal_modifier: {
            triggers: ['tomorrow', 'next', 'week', 'month', 'today', 'tonight'],
            requiresContext: 'weather-followup',
            modifyParams: (contextData, signals) => ({
              location: contextData.lastLocation,  // Reuse previous location
              timeframe: this.extractTimeframe(signals) || 'tomorrow'
            }),
            reuseIntent: 'weather_query'
          },

          // "What about Paris?" or "And in London?"
          location_modifier: {
            triggers: ['in', 'at', 'for', 'about'],
            requiresContext: 'weather-followup',
            modifyParams: (contextData, signals) => ({
              location: signals.places[0] || contextData.lastLocation,
              timeframe: contextData.lastTimeframe  // Reuse previous timeframe
            }),
            reuseIntent: 'weather_query'
          }
        }
      }
    };
  }

  /**
   * Extract timeframe from signals
   * Handles: today, tomorrow, next week, etc.
   */
  extractTimeframe(signals) {
    // Check for date entities first
    if (signals.dates.length > 0) {
      const date = signals.dates[0];
      return date.text;  // "tomorrow", "next week", etc.
    }

    // Check raw text for temporal keywords
    const text = signals.normalizedText;

    if (text.includes('tomorrow')) return 'tomorrow';
    if (text.includes('today')) return 'today';
    if (text.includes('tonight')) return 'tonight';
    if (text.includes('next week')) return 'next week';
    if (text.includes('next month')) return 'next month';

    // Default to today
    return 'today';
  }

  /**
   * Format timeframe for natural language response
   */
  formatTimeframeDescription(timeframe) {
    switch (timeframe) {
      case 'today':
        return 'today';
      case 'tomorrow':
        return 'tomorrow';
      case 'tonight':
        return 'tonight';
      case 'next week':
        return 'next week';
      case 'next month':
        return 'next month';
      default:
        return timeframe;
    }
  }
}

// Export singleton instance
export const weatherPlugin = new WeatherPlugin();
export default WeatherPlugin;
