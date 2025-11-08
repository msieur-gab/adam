/**
 * Natural Language Understanding Service
 * Extracts intent, entities, and context from user input
 */

export class NLUService {
  constructor() {
    this.questionWords = ['what', 'when', 'where', 'who', 'whom', 'why', 'how', 'which'];
    this.temporalPatterns = this.initTemporalPatterns();
    this.intentPatterns = this.initIntentPatterns();
    this.actionPatterns = this.initActionPatterns();
    this.subjectPatterns = this.initSubjectPatterns();
    this.aspectPatterns = this.initAspectPatterns();
  }

  /**
   * Main analysis method
   * @param {string} input - User input text
   * @param {Object} context - Conversation context
   * @returns {Object} NLU analysis result
   */
  async analyze(input, context = {}) {
    const normalized = input.toLowerCase().trim();

    // Extract question type first
    const questionType = this.extractQuestionType(normalized);

    const analysis = {
      originalInput: input,
      normalized,

      // Multi-dimensional understanding
      action: null,           // query, remind, tell, check, set
      subject: null,          // weather, medication, family, time, date
      questionType: questionType,     // what, when, why, how, who, where
      questionAspect: null,   // temperature, conditions, time, reason, name

      // Legacy intent for backward compatibility
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

    // Analyze dimensions in parallel
    const dimensions = this.analyzeDimensions(normalized, analysis.entities, questionType);
    analysis.action = dimensions.action;
    analysis.subject = dimensions.subject;
    analysis.questionAspect = dimensions.aspect;

    // Build legacy intent for backward compatibility (action_subject)
    analysis.intent = this.buildIntent(dimensions.action, dimensions.subject);
    analysis.confidence = dimensions.confidence;

    // Extract slots based on subject dimension
    analysis.slots = this.extractSlots(dimensions.subject, normalized, analysis.entities);

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
   * Analyze all dimensions in parallel (multi-dimensional understanding)
   * @param {string} text - Normalized input text
   * @param {Object} entities - Extracted entities
   * @param {string} questionType - Question type (what, when, etc.)
   * @returns {Object} Multi-dimensional analysis
   */
  analyzeDimensions(text, entities, questionType) {
    // Classify action dimension
    const action = this.classifyAction(text, questionType);

    // Classify subject dimension
    const subject = this.classifySubject(text, entities);

    // Classify aspect dimension (based on question type and subject)
    const aspect = this.classifyAspect(text, questionType, subject);

    // Calculate overall confidence
    const confidence = this.calculateConfidence(action, subject, entities);

    return {
      action: action || 'query',
      subject: subject || 'unknown',
      aspect: aspect || null,
      confidence
    };
  }

  /**
   * Classify action dimension (what user wants to DO)
   */
  classifyAction(text, questionType) {
    let bestAction = null;
    let bestScore = 0;

    for (const [actionName, config] of Object.entries(this.actionPatterns)) {
      let score = 0;

      // Check patterns
      for (const pattern of config.patterns) {
        if (new RegExp(pattern, 'i').test(text)) {
          score += 0.5;
        }
      }

      // Check keywords
      for (const keyword of config.keywords) {
        if (text.includes(keyword)) {
          score += 0.3;
        }
      }

      // Boost score if question type matches
      if (config.questionTypes.includes(questionType)) {
        score += 0.2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestAction = actionName;
      }
    }

    return bestAction || 'query';
  }

  /**
   * Classify subject dimension (WHAT they're asking about)
   */
  classifySubject(text, entities) {
    let bestSubject = null;
    let bestScore = 0;

    for (const [subjectName, config] of Object.entries(this.subjectPatterns)) {
      let score = 0;

      // Check patterns
      for (const pattern of config.patterns) {
        if (new RegExp(pattern, 'i').test(text)) {
          score += 0.5;
        }
      }

      // Check keywords
      for (const keyword of config.keywords) {
        if (text.includes(keyword)) {
          score += 0.3;
        }
      }

      // Boost score if required entities are present
      if (config.entityHints) {
        for (const entityType of config.entityHints) {
          if (entities[entityType]) {
            score += 0.2;
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestSubject = subjectName;
      }
    }

    return bestSubject;
  }

  /**
   * Classify aspect dimension (WHICH aspect of the subject)
   */
  classifyAspect(text, questionType, subject) {
    // Get aspects for this subject
    const subjectAspects = this.aspectPatterns[subject];
    if (!subjectAspects) return null;

    let bestAspect = null;
    let bestScore = 0;

    for (const [aspectName, config] of Object.entries(subjectAspects)) {
      let score = 0;

      // Check patterns
      for (const pattern of config.patterns) {
        if (new RegExp(pattern, 'i').test(text)) {
          score += 0.5;
        }
      }

      // Check keywords
      for (const keyword of config.keywords) {
        if (text.includes(keyword)) {
          score += 0.3;
        }
      }

      // Boost score if question type matches
      if (config.questionTypes && config.questionTypes.includes(questionType)) {
        score += 0.2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestAspect = aspectName;
      }
    }

    return bestAspect;
  }

  /**
   * Calculate overall confidence score
   */
  calculateConfidence(action, subject, entities) {
    let confidence = 0;

    // Base confidence if we have action and subject
    if (action && subject) {
      confidence = 0.6;
    } else if (action || subject) {
      confidence = 0.3;
    }

    // Boost confidence for each entity found
    const entityCount = Object.keys(entities).length;
    confidence += Math.min(0.3, entityCount * 0.1);

    return Math.min(1, confidence);
  }

  /**
   * Build legacy intent for backward compatibility (action_subject)
   */
  buildIntent(action, subject) {
    if (!action || !subject) {
      return 'unknown';
    }

    // Map common patterns to legacy intent names
    const intentMap = {
      'query_weather': 'weather_query',
      'check_weather': 'weather_query',
      'query_date': 'date_query',
      'check_date': 'date_query',
      'query_time': 'time_query',
      'check_time': 'time_query',
      'query_medication': 'medication_query',
      'check_medication': 'medication_query',
      'query_family': 'family_query',
      'check_family': 'family_query',
      'query_doctor': 'doctor_query',
      'check_doctor': 'doctor_query',
      'query_hydration': 'hydration_query',
      'check_hydration': 'hydration_query',
      'greet_unknown': 'greeting',
      'farewell_unknown': 'farewell',
      'thank_unknown': 'gratitude'
    };

    const combined = `${action}_${subject}`;
    return intentMap[combined] || combined;
  }

  /**
   * Classify intent based on patterns and entities (LEGACY - kept for compatibility)
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
   * Extract slots (parameters) based on subject dimension
   */
  extractSlots(subject, text, entities) {
    const slots = {};

    switch (subject) {
      case 'weather':
        slots.location = entities.location?.value || null;
        slots.date = entities.temporal?.value || 'today';
        break;

      case 'date':
        slots.temporal = entities.temporal?.value || 'today';
        break;

      case 'time':
        slots.temporal = entities.temporal?.value || 'now';
        break;

      case 'family':
        slots.person = entities.person?.relation || null;
        break;

      case 'medication':
        slots.temporal = entities.temporal?.value || 'now';
        break;

      case 'doctor':
        slots.temporal = entities.temporal?.value || 'now';
        break;

      case 'hydration':
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

  /**
   * Initialize action patterns (what user wants to DO)
   */
  initActionPatterns() {
    return {
      query: {
        patterns: [
          '\\bwhat\\b',
          '\\bwho\\b',
          '\\bwhere\\b',
          '\\bhow\\b',
          '\\btell me\\b',
          '\\bshow me\\b'
        ],
        keywords: ['what', 'tell', 'show', 'know'],
        questionTypes: ['what', 'who', 'where', 'how', 'which', 'question']
      },
      check: {
        patterns: [
          '\\bcheck\\b',
          '\\bis\\b.*\\?',
          '\\bare\\b.*\\?',
          '\\bdid\\b.*\\?',
          '\\bcan you\\b'
        ],
        keywords: ['check', 'verify', 'confirm', 'is', 'are'],
        questionTypes: ['statement', 'question']
      },
      remind: {
        patterns: [
          '\\bremind\\b',
          '\\bdon\'t forget\\b',
          '\\balert\\b',
          '\\bnotify\\b'
        ],
        keywords: ['remind', 'alert', 'notify', 'remember'],
        questionTypes: ['statement']
      },
      tell: {
        patterns: [
          '\\btell\\b',
          '\\blet.*know\\b',
          '\\binform\\b',
          '\\bnotify\\b'
        ],
        keywords: ['tell', 'inform', 'let', 'say'],
        questionTypes: ['statement']
      },
      set: {
        patterns: [
          '\\bset\\b',
          '\\bcreate\\b',
          '\\badd\\b',
          '\\bschedule\\b'
        ],
        keywords: ['set', 'create', 'add', 'schedule'],
        questionTypes: ['statement']
      },
      greet: {
        patterns: [
          '^\\s*(?:hi|hello|hey|good\\s+(?:morning|afternoon|evening))\\b'
        ],
        keywords: ['hi', 'hello', 'hey', 'good morning'],
        questionTypes: ['statement']
      },
      farewell: {
        patterns: [
          '\\b(?:bye|goodbye|see\\s+you|good\\s+night)\\b'
        ],
        keywords: ['bye', 'goodbye', 'night'],
        questionTypes: ['statement']
      },
      thank: {
        patterns: [
          '\\bthank\\s*(?:you)?\\b',
          '\\bthanks\\b'
        ],
        keywords: ['thank', 'thanks'],
        questionTypes: ['statement']
      }
    };
  }

  /**
   * Initialize subject patterns (WHAT they're asking about)
   */
  initSubjectPatterns() {
    return {
      weather: {
        patterns: [
          '\\bweather\\b',
          '\\btemperature\\b',
          '\\brain\\b',
          '\\bsnow\\b',
          '\\bcloudy\\b',
          '\\bsunny\\b',
          '\\bforecast\\b',
          '\\bhot\\b',
          '\\bcold\\b',
          '\\bwarm\\b'
        ],
        keywords: ['weather', 'temperature', 'rain', 'forecast', 'sunny', 'cloudy'],
        entityHints: ['temporal', 'location']
      },
      date: {
        patterns: [
          '\\bdate\\b',
          '\\bday\\s+(?:is\\s+)?(?:it|today)\\b',
          '\\bwhat\\s+day\\b',
          '\\btoday\\b',
          '\\btomorrow\\b',
          '\\byesterday\\b'
        ],
        keywords: ['date', 'day', 'today', 'tomorrow', 'yesterday'],
        entityHints: ['temporal']
      },
      time: {
        patterns: [
          '\\btime\\b',
          '\\bwhat\\s+time\\b',
          '\\bclock\\b',
          '\\bhour\\b'
        ],
        keywords: ['time', 'clock', 'hour'],
        entityHints: ['temporal']
      },
      medication: {
        patterns: [
          '\\bmedication\\b',
          '\\bmedicine\\b',
          '\\bpill\\b',
          '\\btablet\\b',
          '\\bmeds\\b',
          '\\bdrug\\b'
        ],
        keywords: ['medication', 'medicine', 'pill', 'meds'],
        entityHints: ['temporal']
      },
      family: {
        patterns: [
          '\\bfamily\\b',
          '\\bdaughter\\b',
          '\\bson\\b',
          '\\bgrandson\\b',
          '\\bgranddaughter\\b',
          '\\bwife\\b',
          '\\bhusband\\b',
          '\\bbrother\\b',
          '\\bsister\\b'
        ],
        keywords: ['family', 'daughter', 'son', 'grandson', 'granddaughter'],
        entityHints: ['person']
      },
      doctor: {
        patterns: [
          '\\bdoctor\\b',
          '\\bappointment\\b',
          '\\bphysician\\b',
          '\\bcheckup\\b',
          '\\bmedical\\b'
        ],
        keywords: ['doctor', 'appointment', 'physician', 'checkup'],
        entityHints: ['temporal']
      },
      hydration: {
        patterns: [
          '\\bwater\\b',
          '\\bdrink\\b',
          '\\bhydrat\\b',
          '\\bthirsty\\b',
          '\\bfluid\\b'
        ],
        keywords: ['water', 'drink', 'hydration', 'thirsty'],
        entityHints: ['temporal']
      },
      unknown: {
        patterns: [],
        keywords: [],
        entityHints: []
      }
    };
  }

  /**
   * Initialize aspect patterns (WHICH aspect of the subject)
   */
  initAspectPatterns() {
    return {
      weather: {
        temperature: {
          patterns: [
            '\\btemperature\\b',
            '\\bhot\\b',
            '\\bcold\\b',
            '\\bwarm\\b',
            '\\bdegrees\\b'
          ],
          keywords: ['temperature', 'hot', 'cold', 'warm', 'degrees'],
          questionTypes: ['what', 'how']
        },
        conditions: {
          patterns: [
            '\\bconditions\\b',
            '\\brain\\b',
            '\\bsnow\\b',
            '\\bcloudy\\b',
            '\\bsunny\\b',
            '\\blike\\b'
          ],
          keywords: ['conditions', 'rain', 'snow', 'cloudy', 'sunny', 'like'],
          questionTypes: ['what', 'how']
        },
        forecast: {
          patterns: [
            '\\bforecast\\b',
            '\\bwill be\\b',
            '\\blook like\\b'
          ],
          keywords: ['forecast', 'will', 'going to'],
          questionTypes: ['what', 'how']
        }
      },
      date: {
        today: {
          patterns: ['\\btoday\\b'],
          keywords: ['today'],
          questionTypes: ['what']
        },
        day_of_week: {
          patterns: [
            '\\bday\\s+of\\s+week\\b',
            '\\bwhat\\s+day\\b'
          ],
          keywords: ['day'],
          questionTypes: ['what']
        }
      },
      time: {
        current: {
          patterns: [
            '\\bnow\\b',
            '\\bcurrent\\b',
            '\\bright now\\b'
          ],
          keywords: ['now', 'current', 'right now'],
          questionTypes: ['what']
        }
      },
      medication: {
        schedule: {
          patterns: [
            '\\bwhen\\b',
            '\\bschedule\\b',
            '\\btake\\b'
          ],
          keywords: ['when', 'schedule', 'take', 'time'],
          questionTypes: ['when']
        },
        dosage: {
          patterns: [
            '\\bhow much\\b',
            '\\bdosage\\b',
            '\\bamount\\b'
          ],
          keywords: ['how much', 'dosage', 'amount'],
          questionTypes: ['how', 'what']
        }
      },
      family: {
        contact: {
          patterns: [
            '\\bphone\\b',
            '\\bcall\\b',
            '\\bcontact\\b',
            '\\bnumber\\b'
          ],
          keywords: ['phone', 'call', 'contact', 'number'],
          questionTypes: ['what', 'how']
        },
        status: {
          patterns: [
            '\\bhow\\s+is\\b',
            '\\bdoing\\b',
            '\\bwell\\b'
          ],
          keywords: ['how', 'doing', 'well'],
          questionTypes: ['how']
        }
      }
    };
  }
}

// Export singleton instance
export const nluService = new NLUService();
