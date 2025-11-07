/**
 * Enhanced NLU Service v2
 * Uses established libraries for better accuracy and maintainability:
 * - Transformers.js (zero-shot intent classification + NER)
 * - Chrono.js (temporal expression parsing)
 * - Compromise.js (entity extraction, question detection)
 */

import { pipeline } from '@xenova/transformers';

// Note: Chrono and Compromise will be added when you run:
// npm install chrono-node compromise

export class NLUServiceV2 {
  constructor() {
    this.initialized = false;
    this.classifier = null;
    this.ner = null;

    // Define intent categories
    this.intents = [
      'weather_query',
      'time_query',
      'date_query',
      'medication_query',
      'family_query',
      'doctor_query',
      'hydration_query',
      'greeting',
      'farewell',
      'gratitude',
      'unknown'
    ];

    // Lazy load these libraries
    this.chrono = null;
    this.nlp = null;
  }

  /**
   * Initialize ML models (called once, cached after)
   */
  async initialize() {
    if (this.initialized) return;

    console.log('[NLU-v2] Initializing models...');

    try {
      // Load zero-shot classifier for intent detection
      this.classifier = await pipeline(
        'zero-shot-classification',
        'Xenova/distilbert-base-uncased-mnli',
        { quantized: true } // Smaller model
      );

      // Load NER model for entity extraction
      this.ner = await pipeline(
        'token-classification',
        'Xenova/bert-base-NER',
        { quantized: true }
      );

      // Dynamically import chrono and compromise when available
      try {
        const chronoModule = await import('chrono-node');
        this.chrono = chronoModule.default || chronoModule;
        console.log('[NLU-v2] Chrono.js loaded ✓');
      } catch (e) {
        console.warn('[NLU-v2] Chrono.js not available, using fallback temporal parsing');
      }

      try {
        const compromiseModule = await import('compromise');
        this.nlp = compromiseModule.default || compromiseModule;
        console.log('[NLU-v2] Compromise.js loaded ✓');
      } catch (e) {
        console.warn('[NLU-v2] Compromise.js not available, using fallback entity extraction');
      }

      this.initialized = true;
      console.log('[NLU-v2] All models loaded ✓');

    } catch (error) {
      console.error('[NLU-v2] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Main analysis method
   */
  async analyze(input, context = {}) {
    // Ensure models are loaded
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = performance.now();

    // Run all analyses in parallel for speed
    const [
      intentResult,
      nerResult,
      questionType,
      temporal,
      entities
    ] = await Promise.all([
      this.classifyIntent(input),
      this.extractNER(input),
      this.detectQuestionType(input),
      this.parseTemporal(input, context.userTimezone),
      this.extractEntities(input)
    ]);

    const analysis = {
      originalInput: input,
      normalized: input.toLowerCase().trim(),

      // Intent with confidence
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      intentAlternatives: intentResult.alternatives,

      // Question type
      questionType,

      // All extracted entities
      entities: {
        ...entities,
        ...nerResult,
        temporal
      },

      // Slots for intent execution
      slots: this.extractSlots(intentResult.intent, entities, temporal),

      // Context
      context,

      // Metadata
      timestamp: new Date().toISOString(),
      processingTime: Math.round(performance.now() - startTime)
    };

    console.log('[NLU-v2] Analysis complete:', {
      intent: analysis.intent,
      confidence: analysis.confidence,
      processingTime: analysis.processingTime + 'ms'
    });

    return analysis;
  }

  /**
   * Classify intent using zero-shot classification
   */
  async classifyIntent(input) {
    try {
      const result = await this.classifier(input, this.intents);

      return {
        intent: result.labels[0],
        confidence: result.scores[0],
        alternatives: result.labels.slice(1, 3).map((label, i) => ({
          intent: label,
          confidence: result.scores[i + 1]
        }))
      };

    } catch (error) {
      console.error('[NLU-v2] Intent classification failed:', error);
      return {
        intent: 'unknown',
        confidence: 0,
        alternatives: []
      };
    }
  }

  /**
   * Extract named entities using BERT NER
   */
  async extractNER(input) {
    try {
      const nerResults = await this.ner(input);

      const entities = {
        persons: [],
        locations: [],
        organizations: [],
        misc: []
      };

      let currentEntity = null;
      let currentType = null;
      let currentTokens = [];

      for (const token of nerResults) {
        const entityType = token.entity.replace('B-', '').replace('I-', '');
        const isBeginning = token.entity.startsWith('B-');

        if (isBeginning || entityType !== currentType) {
          // Save previous entity
          if (currentTokens.length > 0 && currentType) {
            const entityText = currentTokens.join('').replace(/##/g, '');
            this.addNEREntity(entities, currentType, entityText);
          }

          // Start new entity
          currentType = entityType;
          currentTokens = [token.word];
        } else {
          // Continue current entity
          currentTokens.push(token.word);
        }
      }

      // Save last entity
      if (currentTokens.length > 0 && currentType) {
        const entityText = currentTokens.join('').replace(/##/g, '');
        this.addNEREntity(entities, currentType, entityText);
      }

      return entities;

    } catch (error) {
      console.error('[NLU-v2] NER extraction failed:', error);
      return { persons: [], locations: [], organizations: [], misc: [] };
    }
  }

  addNEREntity(entities, type, text) {
    if (type === 'PER') {
      entities.persons.push(text);
    } else if (type === 'LOC') {
      entities.locations.push(text);
    } else if (type === 'ORG') {
      entities.organizations.push(text);
    } else if (type === 'MISC') {
      entities.misc.push(text);
    }
  }

  /**
   * Detect question type
   */
  async detectQuestionType(input) {
    // Use Compromise.js if available
    if (this.nlp) {
      try {
        const doc = this.nlp(input);
        const qType = doc.questions().questionType();
        if (qType) return qType;
      } catch (e) {
        console.warn('[NLU-v2] Compromise question detection failed:', e);
      }
    }

    // Fallback to simple detection
    const questionWords = ['what', 'when', 'where', 'who', 'whom', 'why', 'how', 'which'];
    const normalized = input.toLowerCase();

    for (const word of questionWords) {
      if (normalized.startsWith(word + ' ') || normalized.startsWith(word + "'")) {
        return word;
      }
    }

    return input.includes('?') ? 'question' : 'statement';
  }

  /**
   * Parse temporal expressions
   */
  async parseTemporal(input, timezone = 'UTC') {
    // Use Chrono.js if available (much better than regex!)
    if (this.chrono) {
      try {
        const results = this.chrono.parse(input, new Date(), { timezone });

        if (results.length > 0) {
          const result = results[0];
          return {
            type: 'parsed',
            text: result.text,
            start: result.start.date(),
            end: result.end?.date(),
            parsed: result.start.date().toISOString(),
            formatted: result.start.date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })
          };
        }
      } catch (e) {
        console.warn('[NLU-v2] Chrono parsing failed:', e);
      }
    }

    // Fallback to simple temporal detection
    return this.fallbackTemporalParsing(input);
  }

  fallbackTemporalParsing(input) {
    const normalized = input.toLowerCase();
    const now = new Date();

    if (normalized.includes('today')) {
      return { type: 'today', value: 'today', parsed: now.toISOString() };
    }

    if (normalized.includes('tomorrow')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      return { type: 'tomorrow', value: 'tomorrow', parsed: tomorrow.toISOString() };
    }

    if (normalized.includes('yesterday')) {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      return { type: 'yesterday', value: 'yesterday', parsed: yesterday.toISOString() };
    }

    return null;
  }

  /**
   * Extract entities using Compromise.js
   */
  async extractEntities(input) {
    const entities = {
      places: [],
      people: [],
      dates: [],
      times: []
    };

    // Use Compromise.js if available
    if (this.nlp) {
      try {
        const doc = this.nlp(input);

        entities.places = doc.places().out('array');
        entities.people = doc.people().out('array');
        entities.dates = doc.dates().out('array');
        entities.times = doc.times().out('array');

      } catch (e) {
        console.warn('[NLU-v2] Compromise entity extraction failed:', e);
      }
    }

    return entities;
  }

  /**
   * Extract slots for intent execution
   */
  extractSlots(intent, entities, temporal) {
    const slots = {};

    switch (intent) {
      case 'weather_query':
        slots.location = entities.locations?.[0] || entities.places?.[0] || null;
        slots.date = temporal?.parsed || null;
        break;

      case 'date_query':
      case 'time_query':
        slots.temporal = temporal?.parsed || 'now';
        break;

      case 'family_query':
        slots.person = entities.persons?.[0] || entities.people?.[0] || null;
        break;

      case 'medication_query':
        slots.temporal = temporal?.parsed || 'now';
        break;

      default:
        // Extract all entities as slots
        Object.assign(slots, entities);
        if (temporal) slots.temporal = temporal.parsed;
    }

    return slots;
  }

  /**
   * Get model loading status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      hasClassifier: !!this.classifier,
      hasNER: !!this.ner,
      hasChrono: !!this.chrono,
      hasCompromise: !!this.nlp
    };
  }
}

// Export singleton
export const nluServiceV2 = new NLUServiceV2();
