/**
 * Compromise-Enhanced NLU Service
 * Uses compromise library for better natural language understanding
 */

import nlp from 'compromise';

export class CompromiseNLUService {
  constructor() {
    this.questionWords = ['what', 'when', 'where', 'who', 'whom', 'why', 'how', 'which'];

    // Subject keywords with priority (can be extended by plugins)
    this.baseSubjectKeywords = {
      weather: {
        nouns: ['weather', 'temperature', 'forecast', 'climate'],
        adjectives: ['hot', 'cold', 'warm', 'sunny', 'cloudy', 'rainy', 'snowy'],
        verbs: ['rain', 'snow'],
        priority: 10
      },
      date: {
        nouns: ['date', 'day'],
        adjectives: [],
        verbs: [],
        priority: 8
      },
      time: {
        nouns: ['time', 'clock', 'hour', 'minute'],
        adjectives: [],
        verbs: [],
        priority: 8
      },
      medication: {
        nouns: ['medication', 'medicine', 'pill', 'tablet', 'drug', 'prescription'],
        adjectives: [],
        verbs: ['take'],
        priority: 9
      },
      family: {
        nouns: ['family', 'daughter', 'son', 'grandson', 'granddaughter', 'wife', 'husband', 'brother', 'sister', 'mother', 'father'],
        adjectives: [],
        verbs: [],
        priority: 9
      },
      doctor: {
        nouns: ['doctor', 'appointment', 'physician', 'checkup'],
        adjectives: ['medical'],
        verbs: [],
        priority: 9
      },
      hydration: {
        nouns: ['water', 'drink', 'hydration', 'fluid'],
        adjectives: ['thirsty'],
        verbs: ['drink'],
        priority: 9
      },
      reminder: {
        nouns: ['reminder', 'alarm', 'alert', 'notification'],
        adjectives: [],
        verbs: ['remind', 'alert', 'notify'],
        priority: 9
      }
    };

    // Action keywords
    this.actionKeywords = {
      query: ['what', 'who', 'where', 'which', 'tell', 'show', 'know'],
      check: ['check', 'verify', 'confirm', 'is', 'are', 'did'],
      remind: ['remind', 'remember', 'alert', 'notify'],
      set: ['set', 'create', 'add', 'schedule'],
      greet: ['hi', 'hello', 'hey'],
      farewell: ['bye', 'goodbye'],
      thank: ['thank', 'thanks'],
      stop: ['stop', 'pause', 'cancel', 'quiet', 'silence', 'shut', 'halt', 'enough']
    };

    // Temporal terms (these are modifiers, not subjects)
    this.temporalTerms = [
      'today', 'tomorrow', 'yesterday', 'tonight', 'now',
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
      'morning', 'afternoon', 'evening', 'night',
      'next', 'last', 'this', 'later', 'soon'
    ];

    // Plugin patterns (injected by plugin manager)
    this.pluginPatterns = {};

    // Plugin actions (extends base actions)
    this.pluginActions = {};

    // Plugin intent mappings
    this.pluginIntents = {};

    // Merged subject keywords (base + plugins)
    this.subjectKeywords = { ...this.baseSubjectKeywords };
  }

  /**
   * Add plugin patterns to NLU
   * Plugins can extend: subjects, actions, and intent mappings
   */
  addPluginPatterns(patterns) {
    for (const [pluginId, pluginPattern] of Object.entries(patterns)) {
      // Add subject patterns
      if (pluginPattern.subjects) {
        this.pluginPatterns[pluginId] = pluginPattern.subjects;
        this.subjectKeywords = { ...this.subjectKeywords, ...pluginPattern.subjects };
        console.log('[NLU] Added plugin subjects:', Object.keys(pluginPattern.subjects));
      }

      // Add action keywords
      if (pluginPattern.actions) {
        this.pluginActions = { ...this.pluginActions, ...pluginPattern.actions };
        this.actionKeywords = { ...this.actionKeywords, ...pluginPattern.actions };
        console.log('[NLU] Added plugin actions:', Object.keys(pluginPattern.actions));
      }

      // Add intent mappings
      if (pluginPattern.intents) {
        this.pluginIntents = { ...this.pluginIntents, ...pluginPattern.intents };
        console.log('[NLU] Added plugin intents:', Object.keys(pluginPattern.intents));
      }
    }
  }

  /**
   * Remove plugin patterns when plugin is unloaded
   */
  removePluginPatterns(pluginId) {
    const pattern = this.pluginPatterns[pluginId];

    if (pattern) {
      // Remove subject patterns
      if (pattern.subjects) {
        for (const subjectKey of Object.keys(pattern.subjects)) {
          delete this.subjectKeywords[subjectKey];
        }
      }

      // Remove action keywords
      if (pattern.actions) {
        for (const actionKey of Object.keys(pattern.actions)) {
          delete this.actionKeywords[actionKey];
          delete this.pluginActions[actionKey];
        }
      }

      // Remove intent mappings
      if (pattern.intents) {
        for (const intentKey of Object.keys(pattern.intents)) {
          delete this.pluginIntents[intentKey];
        }
      }

      delete this.pluginPatterns[pluginId];
      console.log('[NLU] Removed plugin patterns:', pluginId);
    }

    // Rebuild subject keywords from base + remaining plugins
    this.subjectKeywords = { ...this.baseSubjectKeywords };
    for (const [id, pat] of Object.entries(this.pluginPatterns)) {
      if (pat.subjects) {
        this.subjectKeywords = { ...this.subjectKeywords, ...pat.subjects };
      }
    }
  }

  /**
   * Main analysis method using compromise
   */
  async analyze(input, context = {}) {
    const doc = nlp(input);
    const normalized = input.toLowerCase().trim();

    const analysis = {
      originalInput: input,
      normalized,

      // Multi-dimensional understanding
      action: null,
      subject: null,
      questionType: this.extractQuestionType(normalized),
      questionAspect: null,

      // Legacy intent for backward compatibility
      intent: null,
      confidence: 0,

      entities: {},
      slots: {},
      temporal: null,
      context: context,
      timestamp: new Date().toISOString(),

      // Debug info
      _debug: {
        nouns: [],
        verbs: [],
        adjectives: [],
        temporals: [],
        subjects_scored: {}
      }
    };

    // Extract linguistic features using compromise
    const linguisticFeatures = this.extractLinguisticFeatures(doc);
    analysis._debug = { ...analysis._debug, ...linguisticFeatures };

    // Extract entities (temporal, location, person, etc.)
    analysis.entities = this.extractEntities(doc, normalized);

    // Classify subject using compromise-enhanced logic
    const subjectResult = this.classifySubjectWithCompromise(
      doc,
      linguisticFeatures,
      analysis.entities,
      normalized
    );
    analysis.subject = subjectResult.subject;
    analysis._debug.subjects_scored = subjectResult.scores;

    // Classify action
    analysis.action = this.classifyAction(doc, normalized, analysis.questionType);

    // Classify aspect
    analysis.questionAspect = this.classifyAspect(
      doc,
      normalized,
      analysis.questionType,
      analysis.subject
    );

    // Process temporal expressions FIRST (before slots)
    if (analysis.entities.temporal) {
      analysis.temporal = this.parseTemporalExpression(
        analysis.entities.temporal,
        context.userTimezone || 'UTC'
      );
    }

    // Build legacy intent
    analysis.intent = this.buildIntent(analysis.action, analysis.subject);
    analysis.confidence = this.calculateConfidence(
      analysis.action,
      analysis.subject,
      analysis.entities,
      subjectResult.topScore
    );

    // Extract slots (now has access to parsed temporal)
    analysis.slots = this.extractSlots(
      analysis.subject,
      normalized,
      analysis.entities,
      analysis.temporal
    );

    return analysis;
  }

  /**
   * Extract linguistic features using compromise
   */
  extractLinguisticFeatures(doc) {
    // Get nouns (potential subjects)
    // Extract individual nouns from noun phrases
    const nounPhrases = doc.nouns().out('array');
    const nouns = [];

    for (const phrase of nounPhrases) {
      // Split compound nouns and get individual words
      const words = phrase.toLowerCase().split(/\s+/);
      nouns.push(...words.filter(w => w.length > 1 && w !== 'the' && w !== 'a' && w !== 'an'));
    }

    // Get verbs (potential actions)
    const verbs = doc.verbs().out('array');

    // Get adjectives (descriptors)
    const adjectives = doc.adjectives().out('array');

    // Get dates/times (use match instead of dates)
    const dates = doc.match('#Date').out('array');

    // Get questions
    const questions = doc.questions().out('array');

    return {
      nouns: nouns,
      verbs: verbs.map(v => v.toLowerCase()),
      adjectives: adjectives.map(a => a.toLowerCase()),
      dates: dates,
      questions: questions
    };
  }

  /**
   * Classify subject using compromise-enhanced logic
   * This is the KEY improvement - uses POS tagging to prioritize actual nouns
   */
  classifySubjectWithCompromise(doc, linguisticFeatures, entities, text) {
    const scores = {};

    // Initialize scores
    for (const subject of Object.keys(this.subjectKeywords)) {
      scores[subject] = 0;
    }

    // Score based on NOUNS (highest weight - these are actual subjects)
    for (const noun of linguisticFeatures.nouns) {
      for (const [subject, config] of Object.entries(this.subjectKeywords)) {
        if (config.nouns.includes(noun)) {
          // HIGH score for noun matches - these are the real subjects
          scores[subject] += 2.0 * (config.priority / 10);
        }
      }
    }

    // Score based on ADJECTIVES (medium weight - descriptors)
    for (const adj of linguisticFeatures.adjectives) {
      for (const [subject, config] of Object.entries(this.subjectKeywords)) {
        if (config.adjectives.includes(adj)) {
          scores[subject] += 1.0 * (config.priority / 10);
        }
      }
    }

    // Score based on VERBS (medium weight - actions related to subject)
    for (const verb of linguisticFeatures.verbs) {
      for (const [subject, config] of Object.entries(this.subjectKeywords)) {
        if (config.verbs.includes(verb)) {
          scores[subject] += 1.0 * (config.priority / 10);
        }
      }
    }

    // PENALIZE if a word is a temporal term appearing in text
    // This is crucial: "today" should NOT boost date score in "weather today"
    for (const [subject, config] of Object.entries(this.subjectKeywords)) {
      for (const noun of config.nouns) {
        // If the noun is a temporal term AND it's not the main noun, penalize
        if (this.temporalTerms.includes(noun)) {
          // Check if this temporal term appears with another subject noun
          const hasOtherSubjectNoun = linguisticFeatures.nouns.some(n =>
            !this.temporalTerms.includes(n) && n !== noun
          );

          if (hasOtherSubjectNoun) {
            // "today" appears with "weather" -> penalize date score
            scores[subject] *= 0.3;
          }
        }
      }
    }

    // Boost from entities (but lower weight than nouns)
    if (entities.temporal) {
      // DON'T boost date just because temporal exists
      // Only boost if there's no other clear subject
      const hasNonTemporalNoun = linguisticFeatures.nouns.some(n =>
        !this.temporalTerms.includes(n)
      );

      if (!hasNonTemporalNoun) {
        // No other subject -> temporal entity is the subject
        scores.date += 0.5;
        scores.time += 0.5;
      }
    }

    if (entities.location) {
      scores.weather += 0.5;
    }

    if (entities.person) {
      scores.family += 0.5;
    }

    // Find best subject
    let bestSubject = 'unknown';
    let topScore = 0;

    for (const [subject, score] of Object.entries(scores)) {
      if (score > topScore) {
        topScore = score;
        bestSubject = subject;
      }
    }

    // Require minimum score
    if (topScore < 0.5) {
      bestSubject = 'unknown';
    }

    return {
      subject: bestSubject,
      scores: scores,
      topScore: topScore
    };
  }

  /**
   * Classify action
   */
  classifyAction(doc, text, questionType) {
    const verbs = doc.verbs().out('array').map(v => v.toLowerCase());
    const words = text.split(' ');

    let bestAction = 'query';
    let bestScore = 0;

    for (const [action, keywords] of Object.entries(this.actionKeywords)) {
      let score = 0;

      // Check keywords in text
      for (const keyword of keywords) {
        if (words.includes(keyword) || verbs.includes(keyword)) {
          score += 1;
        }
      }

      // Boost for question types
      if (action === 'query' && this.questionWords.includes(questionType)) {
        score += 0.5;
      }

      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
      }
    }

    return bestAction;
  }

  /**
   * Extract entities using compromise
   */
  extractEntities(doc, text) {
    const entities = {};

    // Extract temporal entities using compromise
    const dates = doc.match('#Date').out('array');
    if (dates.length > 0) {
      entities.temporal = {
        type: this.classifyTemporalType(dates[0].toLowerCase()),
        value: dates[0],
        matched: dates[0]
      };
    } else {
      // Fallback to pattern matching for temporal
      const temporal = this.extractTemporalEntity(text);
      if (temporal) {
        entities.temporal = temporal;
      }
    }

    // Extract location entities
    const places = doc.places().out('array');
    if (places.length > 0) {
      entities.location = {
        type: 'city',
        value: places[0],
        matched: places[0]
      };
    } else {
      // Fallback to pattern matching
      const location = this.extractLocationEntity(text);
      if (location) {
        entities.location = location;
      }
    }

    // Extract person entities
    const people = doc.people().out('array');
    if (people.length > 0) {
      entities.person = {
        type: 'person',
        value: people[0],
        matched: people[0]
      };
    } else {
      // Fallback for family relations
      const person = this.extractPersonEntity(text);
      if (person) {
        entities.person = person;
      }
    }

    // Extract numbers
    const numbers = doc.match('#Value').out('array');
    if (numbers.length > 0) {
      entities.number = {
        value: parseInt(numbers[0]),
        matched: numbers[0]
      };
    }

    return entities;
  }

  /**
   * Classify temporal type
   */
  classifyTemporalType(text) {
    if (text.includes('today')) return 'today';
    if (text.includes('tomorrow')) return 'tomorrow';
    if (text.includes('yesterday')) return 'yesterday';
    if (text.includes('now')) return 'now';
    if (text.match(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/)) return 'day_of_week';
    return 'relative';
  }

  /**
   * Extract question type
   */
  extractQuestionType(text) {
    for (const word of this.questionWords) {
      if (text.startsWith(word) || text.includes(` ${word} `)) {
        return word;
      }
    }
    return text.includes('?') ? 'question' : 'statement';
  }

  /**
   * Fallback entity extractors (same as original)
   */
  extractTemporalEntity(text) {
    const patterns = {
      '\\btoday\\b': 'today',
      '\\btomorrow\\b': 'tomorrow',
      '\\byesterday\\b': 'yesterday',
      '\\bnow\\b': 'now',
      '\\blater\\b': 'later'
    };

    for (const [pattern, type] of Object.entries(patterns)) {
      const match = text.match(new RegExp(pattern, 'i'));
      if (match) {
        return { type, value: match[0], matched: match[0] };
      }
    }
    return null;
  }

  extractLocationEntity(text) {
    // Pattern 1: "in [city]" (weather in Paris, in London today)
    const inPattern = /\bin\s+([a-z][a-z\s]+?)(?:\s+(?:today|tomorrow|yesterday|now|on|at|for|$))/i;
    const match = text.match(inPattern);
    if (match) {
      const location = match[1].trim();
      // Filter out time words that might have been captured
      if (!this.temporalTerms.includes(location.toLowerCase())) {
        return { type: 'city', value: location, matched: match[0] };
      }
    }

    // Pattern 2: "at [place]" (less common but possible)
    const atPattern = /\bat\s+([a-z][a-z\s]+?)(?:\s+(?:today|tomorrow|now|$))/i;
    const atMatch = text.match(atPattern);
    if (atMatch) {
      const location = atMatch[1].trim();
      if (!this.temporalTerms.includes(location.toLowerCase())) {
        return { type: 'place', value: location, matched: atMatch[0] };
      }
    }

    // Pattern 3: "for [city]" (weather for Boston)
    const forPattern = /\bfor\s+([a-z][a-z\s]+?)(?:\s+(?:today|tomorrow|$))/i;
    const forMatch = text.match(forPattern);
    if (forMatch) {
      const location = forMatch[1].trim();
      if (!this.temporalTerms.includes(location.toLowerCase())) {
        return { type: 'city', value: location, matched: forMatch[0] };
      }
    }

    return null;
  }

  extractPersonEntity(text) {
    const familyRelations = [
      'daughter', 'son', 'grandson', 'granddaughter',
      'son-in-law', 'daughter-in-law', 'wife', 'husband',
      'brother', 'sister', 'mother', 'father', 'grandchild'
    ];

    for (const relation of familyRelations) {
      if (text.includes(relation)) {
        return { type: 'family', relation, value: relation };
      }
    }
    return null;
  }

  /**
   * Other helper methods (same as original)
   */
  classifyAspect(doc, text, questionType, subject) {
    // Use compromise to find key adjectives and nouns related to subject
    const adjectives = doc.adjectives().out('array').map(a => a.toLowerCase());

    if (subject === 'weather') {
      if (adjectives.some(a => ['hot', 'cold', 'warm'].includes(a)) || text.includes('temperature')) {
        return 'temperature';
      }
      if (text.includes('forecast') || text.includes('will be')) {
        return 'forecast';
      }
      return 'conditions';
    }

    if (subject === 'date') {
      if (text.includes('day')) return 'day_of_week';
      return 'today';
    }

    if (subject === 'time') {
      return 'current';
    }

    return null;
  }

  parseTemporalExpression(entity, timezone = 'UTC') {
    // Use existing temporal parsing logic
    const now = new Date();
    let targetDate = now;

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

  buildIntent(action, subject) {
    if (!action || !subject) return 'unknown';

    const combined = `${action}_${subject}`;

    // Check plugin intent mappings first (priority)
    if (this.pluginIntents[combined]) {
      return this.pluginIntents[combined];
    }

    // Fallback to base intent mappings
    const baseIntentMap = {
      'query_weather': 'weather_query',
      'check_weather': 'weather_query',
      'query_date': 'date_query',
      'check_date': 'date_query',
      'query_time': 'time_query',
      'check_time': 'time_query',
      'query_medication': 'medication_query',
      'query_family': 'family_query',
      'query_doctor': 'doctor_query',
      'query_hydration': 'hydration_query',
      'remind_reminder': 'reminder_create',
      'set_reminder': 'reminder_create',
      'remind_unknown': 'reminder_create',
      'greet_unknown': 'greeting',
      'farewell_unknown': 'farewell',
      'thank_unknown': 'gratitude',
      'stop_unknown': 'stop_speaking'
    };

    return baseIntentMap[combined] || combined;
  }

  calculateConfidence(action, subject, entities, subjectScore) {
    let confidence = 0;

    // Base confidence from subject score
    if (subjectScore > 1.5) {
      confidence = 0.8;
    } else if (subjectScore > 1.0) {
      confidence = 0.7;
    } else if (subjectScore > 0.5) {
      confidence = 0.6;
    } else {
      confidence = 0.3;
    }

    // Boost for action match
    if (action && action !== 'query') {
      confidence += 0.1;
    }

    // Boost for entities
    const entityCount = Object.keys(entities).length;
    confidence += Math.min(0.1, entityCount * 0.03);

    return Math.min(1, confidence);
  }

  extractSlots(subject, text, entities, parsedTemporal = null) {
    const slots = {};

    switch (subject) {
      case 'weather':
        slots.location = entities.location?.value || null;
        // Use parsed ISO date for weather queries (more accurate)
        slots.date = parsedTemporal?.parsed || null;
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
      default:
        for (const [key, value] of Object.entries(entities)) {
          slots[key] = value.value;
        }
    }

    return slots;
  }
}

// Export singleton instance
export const compromiseNluService = new CompromiseNLUService();
export default CompromiseNLUService;
