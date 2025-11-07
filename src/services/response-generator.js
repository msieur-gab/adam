/**
 * Response Generator
 * Generates structured responses with JSON schema
 */

import { serviceRegistry } from '../api/service-registry.js';
import { getUserProfile } from './db-service.js';

export class ResponseGenerator {
  constructor() {
    this.responseTemplates = this.initTemplates();
  }

  /**
   * Generate response from NLU analysis
   */
  async generate(nluResult, profile = null) {
    const userProfile = profile || await getUserProfile();

    // Check if we need to call an external service
    const serviceResult = await this.executeService(nluResult, userProfile);

    // Generate response structure
    const response = {
      // Response content
      text: '',

      // Metadata
      intent: nluResult.intent,
      confidence: nluResult.confidence,

      // Entities used in response
      entities: nluResult.entities,

      // Data from services
      data: serviceResult?.data || null,

      // Data sources
      sources: serviceResult ? [{
        service: serviceResult.service,
        timestamp: new Date().toISOString()
      }] : [],

      // Alternative responses
      alternatives: [],

      // Follow-up suggestions
      suggestions: [],

      // UI hints
      ui: {
        type: this.getUiType(nluResult.intent),
        icon: this.getIcon(nluResult.intent),
        color: this.getColor(nluResult.intent)
      },

      // Logging & Analytics
      timestamp: new Date().toISOString(),
      processingTime: 0,

      // Error handling
      fallback: null,
      error: null
    };

    const startTime = Date.now();

    // Generate response text based on intent
    try {
      if (serviceResult && serviceResult.success) {
        // Generate response using service data
        response.text = this.generateServiceResponse(
          nluResult,
          serviceResult.data,
          userProfile
        );
      } else {
        // Generate response using templates
        response.text = this.generateTemplateResponse(
          nluResult,
          userProfile
        );
      }

      // Generate alternatives
      response.alternatives = this.generateAlternatives(
        nluResult,
        serviceResult?.data,
        userProfile
      );

      // Generate suggestions
      response.suggestions = this.generateSuggestions(nluResult);

    } catch (error) {
      console.error('[ResponseGenerator] Generation failed:', error);
      response.error = error.message;
      response.text = this.getFallbackResponse(nluResult.intent);
    }

    response.processingTime = Date.now() - startTime;

    return response;
  }

  /**
   * Execute external service if needed
   */
  async executeService(nluResult, userProfile) {
    // Check if intent requires a service
    if (!serviceRegistry.hasServiceForIntent(nluResult.intent)) {
      return null;
    }

    try {
      const result = await serviceRegistry.executeIntent(
        nluResult.intent,
        nluResult.slots,
        userProfile
      );

      return result;

    } catch (error) {
      console.error('[ResponseGenerator] Service execution failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate response using service data
   */
  generateServiceResponse(nluResult, data, userProfile) {
    const { intent, temporal } = nluResult;

    switch (intent) {
      case 'weather_query':
        return this.generateWeatherResponse(data, temporal, userProfile);

      default:
        return this.generateTemplateResponse(nluResult, userProfile);
    }
  }

  /**
   * Generate weather response
   */
  generateWeatherResponse(weatherData, temporal, userProfile) {
    const { location, temperature, conditions, precipitation } = weatherData;

    const tempUnit = userProfile?.preferences?.temperatureUnit === 'fahrenheit' ? '°F' : '°C';
    const temp = Math.round(temperature.current);

    let timePhrase = 'today';
    if (temporal?.type === 'tomorrow') {
      timePhrase = 'tomorrow';
    } else if (temporal?.formatted) {
      timePhrase = `on ${temporal.formatted}`;
    }

    const templates = [
      `The weather in ${location} ${timePhrase} will be ${conditions} with a temperature of ${temp}${tempUnit}.`,
      `${timePhrase.charAt(0).toUpperCase() + timePhrase.slice(1)} in ${location}, expect ${conditions} weather with temperatures around ${temp}${tempUnit}.`,
      `It will be ${conditions} in ${location} ${timePhrase}, with a high of ${temp}${tempUnit}.`
    ];

    // Add precipitation info if significant
    if (precipitation > 30) {
      templates[0] += ` There's a ${precipitation}% chance of rain.`;
    }

    return this.selectRandom(templates);
  }

  /**
   * Generate response using templates
   */
  generateTemplateResponse(nluResult, userProfile) {
    const { intent, temporal, entities } = nluResult;

    const templates = this.responseTemplates[intent];
    if (!templates) {
      return this.getFallbackResponse(intent);
    }

    // Select random template
    const template = this.selectRandom(templates);

    // Replace variables
    return this.replaceVariables(template, {
      name: userProfile?.name || 'there',
      date: this.formatDate(temporal),
      time: this.formatTime(new Date()),
      ...entities
    });
  }

  /**
   * Generate alternative responses
   */
  generateAlternatives(nluResult, serviceData, userProfile) {
    const alternatives = [];

    // Generate 2-3 alternative phrasings
    if (serviceData) {
      // Generate alternatives for service responses
      // (implementation specific to each service)
    } else {
      // Generate alternatives for template responses
      const templates = this.responseTemplates[nluResult.intent];
      if (templates && templates.length > 1) {
        // Return up to 2 alternatives
        alternatives.push(...templates.slice(1, 3));
      }
    }

    return alternatives;
  }

  /**
   * Generate follow-up suggestions
   */
  generateSuggestions(nluResult) {
    const suggestions = [];

    switch (nluResult.intent) {
      case 'weather_query':
        suggestions.push('Would you like the hourly forecast?');
        suggestions.push('Should I remind you about this later?');
        break;

      case 'date_query':
        suggestions.push('Would you like to set a reminder?');
        break;

      case 'medication_query':
        suggestions.push('Should I remind you when it\'s time?');
        break;

      default:
        break;
    }

    return suggestions;
  }

  /**
   * Get UI type for intent
   */
  getUiType(intent) {
    const typeMap = {
      weather_query: 'weather_card',
      date_query: 'info_card',
      time_query: 'info_card',
      medication_query: 'reminder_card',
      family_query: 'contact_card'
    };

    return typeMap[intent] || 'text';
  }

  /**
   * Get icon for intent
   */
  getIcon(intent) {
    const iconMap = {
      weather_query: 'cloud',
      date_query: 'calendar',
      time_query: 'clock',
      medication_query: 'pill',
      family_query: 'people',
      greeting: 'wave',
      farewell: 'hand'
    };

    return iconMap[intent] || 'chat';
  }

  /**
   * Get color for intent
   */
  getColor(intent) {
    const colorMap = {
      weather_query: '#2196F3',
      date_query: '#4CAF50',
      time_query: '#FF9800',
      medication_query: '#F44336',
      family_query: '#9C27B0'
    };

    return colorMap[intent] || '#607D8B';
  }

  /**
   * Get fallback response
   */
  getFallbackResponse(intent) {
    const fallbacks = {
      weather_query: "I'm having trouble getting the weather forecast right now.",
      date_query: `Today is ${this.formatDate()}.`,
      time_query: `It's ${this.formatTime(new Date())}.`,
      unknown: "I'm not sure how to help with that. Could you rephrase?"
    };

    return fallbacks[intent] || fallbacks.unknown;
  }

  /**
   * Replace variables in template
   */
  replaceVariables(template, variables) {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      if (value) {
        const regex = new RegExp(`{${key}}`, 'g');
        result = result.replace(regex, value);
      }
    }

    return result;
  }

  /**
   * Select random item from array
   */
  selectRandom(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Format date
   */
  formatDate(temporal = null) {
    const date = temporal?.parsed ? new Date(temporal.parsed) : new Date();

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Format time
   */
  formatTime(date) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  /**
   * Initialize response templates
   */
  initTemplates() {
    return {
      greeting: [
        'Hello {name}! How can I help you today?',
        'Hi {name}! What can I do for you?',
        'Good to see you, {name}! How are you feeling?'
      ],

      farewell: [
        'Goodbye, {name}! Take care!',
        'See you later, {name}!',
        'Have a wonderful day, {name}!'
      ],

      gratitude: [
        'You\'re welcome, {name}!',
        'Happy to help!',
        'Anytime, {name}!'
      ],

      date_query: [
        'Today is {date}.',
        'It\'s {date} today.',
        'The date today is {date}.'
      ],

      time_query: [
        'It\'s {time}.',
        'The time is {time}.',
        'Right now it\'s {time}.'
      ],

      unknown: [
        'I\'m not sure I understand. Could you rephrase that?',
        'I didn\'t quite catch that. Can you try asking differently?',
        'I\'m still learning. Could you ask that another way?'
      ]
    };
  }
}

// Export singleton instance
export const responseGenerator = new ResponseGenerator();
