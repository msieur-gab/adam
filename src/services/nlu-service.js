/**
 * Natural Language Understanding Service
 * Extracts intent, entities, and context from user input
 */

export class NLUService {
  constructor() {
    this.questionWords = ['what', 'when', 'where', 'who', 'whom', 'why', 'how', 'which'];
    this.temporalPatterns = this.initTemporalPatterns();
    this.intentPatterns = this.initIntentPatterns();
  }

  /**
   * Main analysis method
   * @param {string} input - User input text
   * @param {Object} context - Conversation context
   * @returns {Object} NLU analysis result
   */
  async analyze(input, context = {}) {
    const normalized = input.toLowerCase().trim();

    const analysis = {
      originalInput: input,
      normalized,
      questionType: this.extractQuestionType(normalized),
      intent: null,
      confidence: 0,
      entities: {},
      slots: {},
      temporal: null,
      context: context,
      timestamp: new Date().toISOString()
    };

    // Extract entities
    analysis.entities = this.extractEntities(normalized);

    // Determine intent
    const intentResult = this.classifyIntent(normalized, analysis.entities);
    analysis.intent = intentResult.intent;
    analysis.confidence = intentResult.confidence;
    analysis.slots = intentResult.slots;

    // Process temporal expressions
    if (analysis.entities.temporal) {
      analysis.temporal = this.parseTemporalExpression(
        analysis.entities.temporal,
        context.userTimezone || 'UTC'
      );
    }

    return analysis;
  }

  /**
   * Extract question type (what, when, why, etc.)
   */
  extractQuestionType(text) {
    // Check for question words at the start
    for (const word of this.questionWords) {
      if (text.startsWith(word)) {
        return word;
      }
    }

    // Check for question words anywhere in sentence
    for (const word of this.questionWords) {
      const regex = new RegExp(`\\b${word}\\b`);
      if (regex.test(text)) {
        return word;
      }
    }

    // Check for question mark
    if (text.includes('?')) {
      return 'question';
    }

    // Default to statement
    return 'statement';
  }

  /**
   * Extract entities from text
   */
  extractEntities(text) {
    const entities = {};

    // Temporal entities (dates, times)
    const temporal = this.extractTemporalEntity(text);
    if (temporal) {
      entities.temporal = temporal;
    }

    // Location entities
    const location = this.extractLocationEntity(text);
    if (location) {
      entities.location = location;
    }

    // Person entities (names, family members)
    const person = this.extractPersonEntity(text);
    if (person) {
      entities.person = person;
    }

    // Number entities
    const number = this.extractNumberEntity(text);
    if (number) {
      entities.number = number;
    }

    return entities;
  }

  /**
   * Extract temporal entities (dates, times)
   */
  extractTemporalEntity(text) {
    for (const [pattern, type] of Object.entries(this.temporalPatterns)) {
      const match = text.match(new RegExp(pattern, 'i'));
      if (match) {
        return {
          type,
          value: match[0],
          matched: match[0]
        };
      }
    }
    return null;
  }

  /**
   * Parse temporal expression to actual date/time
   */
  parseTemporalExpression(entity, timezone = 'UTC') {
    const now = new Date();
    let targetDate = new Date();

    switch (entity.type) {
      case 'today':
        targetDate = now;
        break;

      case 'tomorrow':
        targetDate = new Date(now);
        targetDate.setDate(now.getDate() + 1);
        break;

      case 'yesterday':
        targetDate = new Date(now);
        targetDate.setDate(now.getDate() - 1);
        break;

      case 'next_week':
        targetDate = new Date(now);
        targetDate.setDate(now.getDate() + 7);
        break;

      case 'next_month':
        targetDate = new Date(now);
        targetDate.setMonth(now.getMonth() + 1);
        break;

      case 'relative_days':
        // Extract number of days from entity.value
        const daysMatch = entity.value.match(/(\d+)\s*days?/i);
        if (daysMatch) {
          const days = parseInt(daysMatch[1]);
          targetDate = new Date(now);
          targetDate.setDate(now.getDate() + days);
        }
        break;

      case 'specific_date':
        // Parse specific date format (e.g., "January 15", "15/01", etc.)
        targetDate = this.parseSpecificDate(entity.value);
        break;

      case 'time':
        // Parse time (e.g., "3pm", "15:00")
        const timeResult = this.parseTime(entity.value);
        if (timeResult) {
          targetDate.setHours(timeResult.hours, timeResult.minutes, 0, 0);
        }
        break;

      case 'day_of_week':
        // Parse day of week (e.g., "monday", "next friday")
        targetDate = this.parseNextDayOfWeek(entity.value);
        break;

      default:
        targetDate = now;
    }

    return {
      type: entity.type,
      original: entity.value,
      parsed: targetDate.toISOString(),
      formatted: targetDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      timestamp: targetDate.getTime()
    };
  }

  /**
   * Parse specific date strings
   */
  parseSpecificDate(dateStr) {
    // Try common formats
    const formats = [
      /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/, // MM/DD/YYYY or DD/MM/YYYY
      /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
      /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/i
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        // Handle different format types
        if (match[0].includes('-')) {
          return new Date(match[0]);
        } else if (match[1] && match[2]) {
          const months = {
            january: 0, february: 1, march: 2, april: 3,
            may: 4, june: 5, july: 6, august: 7,
            september: 8, october: 9, november: 10, december: 11
          };
          const month = months[match[1].toLowerCase()];
          const day = parseInt(match[2]);
          const year = new Date().getFullYear();
          return new Date(year, month, day);
        }
      }
    }

    return new Date();
  }

  /**
   * Parse time strings (3pm, 15:00, etc.)
   */
  parseTime(timeStr) {
    // Handle 12-hour format with am/pm
    const twelveHour = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (twelveHour) {
      let hours = parseInt(twelveHour[1]);
      const minutes = twelveHour[2] ? parseInt(twelveHour[2]) : 0;
      const meridiem = twelveHour[3].toLowerCase();

      if (meridiem === 'pm' && hours !== 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;

      return { hours, minutes };
    }

    // Handle 24-hour format
    const twentyFourHour = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (twentyFourHour) {
      return {
        hours: parseInt(twentyFourHour[1]),
        minutes: parseInt(twentyFourHour[2])
      };
    }

    return null;
  }

  /**
   * Parse next occurrence of day of week
   */
  parseNextDayOfWeek(dayStr) {
    const days = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6
    };

    const dayMatch = dayStr.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
    if (!dayMatch) return new Date();

    const targetDay = days[dayMatch[0].toLowerCase()];
    const today = new Date();
    const currentDay = today.getDay();

    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget <= 0) {
      daysUntilTarget += 7; // Next week
    }

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysUntilTarget);
    return targetDate;
  }

  /**
   * Extract location entities
   */
  extractLocationEntity(text) {
    // Check for "in [location]" pattern
    const inPattern = /\bin\s+([a-z\s]+?)(?:\s+(?:today|tomorrow|now|on|at|$))/i;
    const match = text.match(inPattern);
    if (match) {
      return {
        type: 'city',
        value: match[1].trim(),
        matched: match[0]
      };
    }

    // Check for "at [location]" pattern
    const atPattern = /\bat\s+([a-z\s]+?)(?:\s+(?:today|tomorrow|now|on|$))/i;
    const atMatch = text.match(atPattern);
    if (atMatch) {
      return {
        type: 'place',
        value: atMatch[1].trim(),
        matched: atMatch[0]
      };
    }

    return null;
  }

  /**
   * Extract person entities
   */
  extractPersonEntity(text) {
    const familyRelations = [
      'daughter', 'son', 'grandson', 'granddaughter',
      'son-in-law', 'daughter-in-law', 'wife', 'husband',
      'brother', 'sister', 'mother', 'father', 'grandchild'
    ];

    for (const relation of familyRelations) {
      if (text.includes(relation)) {
        return {
          type: 'family',
          relation: relation,
          value: relation
        };
      }
    }

    return null;
  }

  /**
   * Extract number entities
   */
  extractNumberEntity(text) {
    // Extract standalone numbers
    const numberMatch = text.match(/\b(\d+)\b/);
    if (numberMatch) {
      return {
        value: parseInt(numberMatch[1]),
        matched: numberMatch[0]
      };
    }

    return null;
  }

  /**
   * Classify intent based on patterns and entities
   */
  classifyIntent(text, entities) {
    let bestIntent = null;
    let bestConfidence = 0;
    let bestSlots = {};

    for (const [intentName, config] of Object.entries(this.intentPatterns)) {
      const { patterns, requiredEntities, keywords } = config;

      let confidence = 0;
      let matchedPatterns = 0;
      let matchedKeywords = 0;

      // Check pattern matches
      for (const pattern of patterns) {
        if (new RegExp(pattern, 'i').test(text)) {
          matchedPatterns++;
          confidence += 0.4;
        }
      }

      // Check keyword matches
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          matchedKeywords++;
          confidence += 0.2;
        }
      }

      // Check required entities
      let hasRequiredEntities = true;
      if (requiredEntities && requiredEntities.length > 0) {
        for (const entityType of requiredEntities) {
          if (!entities[entityType]) {
            hasRequiredEntities = false;
            confidence -= 0.3;
          }
        }
      }

      // Normalize confidence
      confidence = Math.max(0, Math.min(1, confidence));

      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestIntent = intentName;
        bestSlots = this.extractSlots(intentName, text, entities);
      }
    }

    return {
      intent: bestIntent || 'unknown',
      confidence: bestConfidence,
      slots: bestSlots
    };
  }

  /**
   * Extract slots (parameters) for specific intent
   */
  extractSlots(intent, text, entities) {
    const slots = {};

    switch (intent) {
      case 'weather_query':
        slots.location = entities.location?.value || null;
        slots.date = entities.temporal?.value || 'today';
        break;

      case 'date_query':
        slots.temporal = entities.temporal?.value || 'today';
        break;

      case 'time_query':
        slots.temporal = entities.temporal?.value || 'now';
        break;

      case 'family_query':
        slots.person = entities.person?.relation || null;
        break;

      case 'medication_query':
        slots.temporal = entities.temporal?.value || 'now';
        break;

      default:
        // Extract all entities as slots
        for (const [key, value] of Object.entries(entities)) {
          slots[key] = value.value;
        }
    }

    return slots;
  }

  /**
   * Initialize temporal patterns
   */
  initTemporalPatterns() {
    return {
      '\\btoday\\b': 'today',
      '\\btomorrow\\b': 'tomorrow',
      '\\byesterday\\b': 'yesterday',
      '\\bnext week\\b': 'next_week',
      '\\bnext month\\b': 'next_month',
      '\\bin\\s+\\d+\\s+days?\\b': 'relative_days',
      '\\d{1,2}[:/]\\d{1,2}(?:[:/]\\d{2,4})?': 'specific_date',
      '\\d{1,2}\\s*(?:am|pm)\\b': 'time',
      '\\d{1,2}:\\d{2}\\s*(?:am|pm)?\\b': 'time',
      '\\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\b': 'day_of_week',
      '\\bnext\\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\b': 'day_of_week',
      '\\bthis\\s+(?:morning|afternoon|evening|night)\\b': 'time_of_day',
      '\\bnow\\b': 'now',
      '\\blater\\b': 'later',
      '\\bsoon\\b': 'soon'
    };
  }

  /**
   * Initialize intent patterns
   */
  initIntentPatterns() {
    return {
      weather_query: {
        patterns: [
          '\\bweather\\b',
          '\\btemperature\\b',
          '\\brain\\b',
          '\\bsnow\\b',
          '\\bcloudy\\b',
          '\\bsunny\\b',
          '\\bforecast\\b'
        ],
        keywords: ['weather', 'temperature', 'rain', 'forecast'],
        requiredEntities: []
      },

      date_query: {
        patterns: [
          '\\bdate\\b',
          '\\bday\\s+(?:is\\s+)?(?:it|today)\\b',
          '\\bwhat\\s+day\\b',
          '\\bwhat.*date\\b'
        ],
        keywords: ['date', 'day'],
        requiredEntities: []
      },

      time_query: {
        patterns: [
          '\\btime\\b',
          '\\bwhat\\s+time\\b',
          '\\bclock\\b'
        ],
        keywords: ['time', 'clock'],
        requiredEntities: []
      },

      medication_query: {
        patterns: [
          '\\bmedication\\b',
          '\\bmedicine\\b',
          '\\bpill\\b',
          '\\btablet\\b',
          '\\bmeds\\b'
        ],
        keywords: ['medication', 'medicine', 'pill'],
        requiredEntities: []
      },

      family_query: {
        patterns: [
          '\\bfamily\\b',
          '\\bdaughter\\b',
          '\\bson\\b',
          '\\bgrandson\\b',
          '\\bgranddaughter\\b'
        ],
        keywords: ['family', 'daughter', 'son'],
        requiredEntities: []
      },

      doctor_query: {
        patterns: [
          '\\bdoctor\\b',
          '\\bappointment\\b',
          '\\bphysician\\b',
          '\\bcheckup\\b'
        ],
        keywords: ['doctor', 'appointment'],
        requiredEntities: []
      },

      hydration_query: {
        patterns: [
          '\\bwater\\b',
          '\\bdrink\\b',
          '\\bhydrat\\b',
          '\\bthirsty\\b'
        ],
        keywords: ['water', 'drink', 'hydration'],
        requiredEntities: []
      },

      greeting: {
        patterns: [
          '^\\s*(?:hi|hello|hey|good\\s+(?:morning|afternoon|evening))\\b'
        ],
        keywords: ['hi', 'hello', 'hey'],
        requiredEntities: []
      },

      farewell: {
        patterns: [
          '\\b(?:bye|goodbye|see\\s+you|good\\s+night)\\b'
        ],
        keywords: ['bye', 'goodbye'],
        requiredEntities: []
      },

      gratitude: {
        patterns: [
          '\\bthank\\s*(?:you)?\\b',
          '\\bthanks\\b'
        ],
        keywords: ['thank', 'thanks'],
        requiredEntities: []
      }
    };
  }
}

// Export singleton instance
export const nluService = new NLUService();
