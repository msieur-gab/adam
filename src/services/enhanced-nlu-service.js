/**
 * Enhanced NLU Service
 * Extracts comprehensive linguistic signals from Compromise.js
 * for use in declarative intent scoring
 *
 * This service replaces manual pattern matching with rich linguistic analysis,
 * providing all available signals to intent scoring engines.
 */

import nlp from 'compromise';

export class EnhancedNLUService {
  constructor() {
    // Optional: Add custom tags or patterns for domain-specific entities
    this.initializeCustomPatterns();
  }

  /**
   * Main analysis method - extracts all available signals
   * @param {string} text - User input text
   * @param {Object} context - Conversation context (optional)
   * @returns {Object} Comprehensive signal object
   */
  async analyze(text, context = null) {
    if (!text || typeof text !== 'string') {
      throw new Error('Input text must be a non-empty string');
    }

    // Parse with Compromise
    const doc = nlp(text);

    // Extract all linguistic signals
    const signals = {
      // Original text
      originalText: text,
      normalizedText: text.toLowerCase().trim(),

      // === PART OF SPEECH (POS) TAGS ===
      nouns: this.extractNouns(doc),
      verbs: this.extractVerbs(doc),
      adjectives: this.extractAdjectives(doc),
      adverbs: doc.adverbs().out('array'),

      // === NAMED ENTITIES ===
      dates: this.extractDates(doc),
      times: this.extractTimes(doc),
      people: this.extractPeople(doc),
      places: this.extractPlaces(doc),
      numbers: this.extractNumbers(doc),
      money: this.extractMoney(doc),
      organizations: doc.organizations().out('array'),

      // === SENTENCE STRUCTURE ===
      isQuestion: doc.questions().length > 0,
      isCommand: doc.imperatives().length > 0,
      isStatement: !doc.questions().length && !doc.imperatives().length,

      // === SENTIMENT & MODALITY ===
      hasNegation: doc.has('#Negative'),
      isPositive: doc.has('#Positive'),
      hasModal: doc.has('#Modal'), // can, should, would, etc.

      // === TEMPORAL MARKERS ===
      hasFuture: doc.has('#Future'),
      hasPast: doc.has('#Past'),
      hasPresent: doc.has('#Present'),

      // === PRONOUNS & REFERENCES ===
      pronouns: doc.pronouns().out('array'),
      hasPronoun: doc.pronouns().length > 0,

      // === COMPARISON & SUPERLATIVES ===
      comparatives: doc.comparatives().out('array'),
      superlatives: doc.superlatives().out('array'),

      // === DOCUMENT METADATA ===
      wordCount: doc.wordCount(),
      termCount: doc.termCount(),

      // === ACTIVE CONTEXT (from conversation) ===
      activeContexts: context ? context.getActive() : [],

      // === RAW COMPROMISE DOC (for custom extractors) ===
      doc
    };

    console.log('[EnhancedNLU] Extracted signals:', {
      nouns: signals.nouns.slice(0, 3),
      verbs: signals.verbs.slice(0, 3),
      entities: {
        dates: signals.dates.length,
        places: signals.places.length,
        people: signals.people.length
      },
      structure: {
        isQuestion: signals.isQuestion,
        isCommand: signals.isCommand,
        hasNegation: signals.hasNegation
      }
    });

    return signals;
  }

  /**
   * Extract nouns with normalization
   * @private
   */
  extractNouns(doc) {
    return doc
      .nouns()
      .out('array')
      .map(n => n.toLowerCase());
  }

  /**
   * Extract verbs in infinitive form
   * @private
   */
  extractVerbs(doc) {
    // Get verbs in infinitive form for better matching
    return doc
      .verbs()
      .toInfinitive()
      .out('array')
      .map(v => v.toLowerCase());
  }

  /**
   * Extract adjectives
   * @private
   */
  extractAdjectives(doc) {
    return doc
      .adjectives()
      .out('array')
      .map(a => a.toLowerCase());
  }

  /**
   * Extract and parse dates
   * @private
   */
  extractDates(doc) {
    const dates = doc.dates().json();

    return dates.map(date => ({
      text: date.text,
      normalized: date.text.toLowerCase(),
      // Compromise provides structured date info
      ...date
    }));
  }

  /**
   * Extract times
   * @private
   */
  extractTimes(doc) {
    // Compromise can extract times like "3pm", "15:00"
    const times = doc.times().json();

    return times.map(time => ({
      text: time.text,
      normalized: time.text.toLowerCase(),
      ...time
    }));
  }

  /**
   * Extract people/names
   * @private
   */
  extractPeople(doc) {
    const people = doc.people().out('array');

    // Also check for family relations (custom domain knowledge)
    const familyRelations = this.extractFamilyRelations(doc);

    return [...people.map(p => p.toLowerCase()), ...familyRelations];
  }

  /**
   * Extract family relation terms
   * @private
   */
  extractFamilyRelations(doc) {
    const familyTerms = [
      'daughter', 'son', 'grandson', 'granddaughter',
      'son-in-law', 'daughter-in-law', 'wife', 'husband',
      'brother', 'sister', 'mother', 'father', 'grandchild',
      'mom', 'dad', 'grandma', 'grandpa'
    ];

    const found = [];
    const text = doc.text().toLowerCase();

    for (const term of familyTerms) {
      if (text.includes(term)) {
        found.push(term);
      }
    }

    return found;
  }

  /**
   * Extract places/locations
   * @private
   */
  extractPlaces(doc) {
    return doc
      .places()
      .out('array')
      .map(p => p.toLowerCase());
  }

  /**
   * Extract numbers and quantities
   * @private
   */
  extractNumbers(doc) {
    const numbers = doc.numbers().json();

    return numbers.map(num => ({
      text: num.text,
      value: num.number || null,
      ...num
    }));
  }

  /**
   * Extract money amounts
   * @private
   */
  extractMoney(doc) {
    const money = doc.money().json();

    return money.map(m => ({
      text: m.text,
      value: m.number || null,
      ...m
    }));
  }

  /**
   * Initialize custom patterns for domain-specific entities
   * @private
   */
  initializeCustomPatterns() {
    // Extend Compromise with custom tags if needed
    // Example: Add medical terms, weather terms, etc.

    // For now, we rely on Compromise's built-in tagging
    // Future: Add custom patterns here
  }

  /**
   * Get debug information about extracted signals
   * @param {Object} signals - Signal object from analyze()
   * @returns {Object} Human-readable debug info
   */
  getDebugInfo(signals) {
    return {
      text: signals.originalText,

      partsOfSpeech: {
        nouns: signals.nouns,
        verbs: signals.verbs,
        adjectives: signals.adjectives,
        adverbs: signals.adverbs
      },

      entities: {
        dates: signals.dates.map(d => d.text),
        times: signals.times.map(t => t.text),
        people: signals.people,
        places: signals.places,
        numbers: signals.numbers.map(n => `${n.text} (${n.value})`),
        money: signals.money.map(m => `${m.text} (${m.value})`)
      },

      structure: {
        type: signals.isQuestion ? 'question' :
              signals.isCommand ? 'command' :
              'statement',
        hasNegation: signals.hasNegation,
        hasPronoun: signals.hasPronoun
      },

      temporal: {
        hasFuture: signals.hasFuture,
        hasPast: signals.hasPast,
        hasPresent: signals.hasPresent
      },

      metadata: {
        wordCount: signals.wordCount,
        termCount: signals.termCount,
        activeContexts: signals.activeContexts
      }
    };
  }
}

// Export singleton instance
export const enhancedNLUService = new EnhancedNLUService();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.enhancedNLUService = enhancedNLUService;

  // Debug helper
  window.analyzeText = async (text) => {
    const signals = await enhancedNLUService.analyze(text);
    const debug = enhancedNLUService.getDebugInfo(signals);
    console.log('[NLU Analysis]', debug);
    return debug;
  };

  console.log('🔍 EnhancedNLU Debug Commands:');
  console.log('  analyzeText("your text here")  - Analyze text and show signals');
}
