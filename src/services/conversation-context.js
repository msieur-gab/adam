/**
 * Conversation Context Manager
 * Manages conversation state and context lifespan (Dialogflow-style)
 *
 * Features:
 * - Context storage with automatic lifespan management
 * - Turn history tracking (last 10 turns)
 * - Entity resolution for pronoun references
 * - Zero ML dependencies, pure JavaScript
 */

export class ConversationContext {
  constructor() {
    // Active contexts: Map<name, { data, lifespan, createdAt }>
    this.contexts = new Map();

    // Conversation turn history: Array of { user, intent, response, timestamp }
    this.turnHistory = [];

    // Maximum turns to keep in history
    this.maxTurnHistory = 10;
  }

  /**
   * Set a context with lifespan
   * @param {string} name - Context name (e.g., 'weather-followup')
   * @param {Object} data - Context data to store
   * @param {number} lifespan - Number of turns before expiring (default: 2)
   */
  set(name, data, lifespan = 2) {
    if (!name || typeof name !== 'string') {
      throw new Error('Context name must be a non-empty string');
    }

    if (lifespan < 0) {
      throw new Error('Lifespan must be non-negative');
    }

    this.contexts.set(name, {
      data: data || {},
      lifespan,
      createdAt: Date.now()
    });

    console.log(`[ConversationContext] Set context "${name}" with lifespan ${lifespan}`);
  }

  /**
   * Get context data (only if still active)
   * @param {string} name - Context name
   * @returns {Object|null} Context data or null if expired/not found
   */
  get(name) {
    const ctx = this.contexts.get(name);

    if (!ctx) {
      return null;
    }

    // Return data only if lifespan > 0
    return ctx.lifespan > 0 ? ctx.data : null;
  }

  /**
   * Get all active context names
   * @returns {string[]} Array of active context names
   */
  getActive() {
    const active = [];

    for (const [name, ctx] of this.contexts.entries()) {
      if (ctx.lifespan > 0) {
        active.push(name);
      }
    }

    return active;
  }

  /**
   * Check if a specific context is active
   * @param {string} name - Context name
   * @returns {boolean} True if context exists and is active
   */
  isActive(name) {
    const ctx = this.contexts.get(name);
    return ctx ? ctx.lifespan > 0 : false;
  }

  /**
   * Get all active contexts with their data
   * @returns {Object} Map of active contexts { name: data }
   */
  getAllActive() {
    const activeContexts = {};

    for (const [name, ctx] of this.contexts.entries()) {
      if (ctx.lifespan > 0) {
        activeContexts[name] = ctx.data;
      }
    }

    return activeContexts;
  }

  /**
   * Delete a context immediately
   * @param {string} name - Context name
   */
  delete(name) {
    if (this.contexts.delete(name)) {
      console.log(`[ConversationContext] Deleted context "${name}"`);
    }
  }

  /**
   * Clear all contexts
   */
  clearAll() {
    const count = this.contexts.size;
    this.contexts.clear();
    console.log(`[ConversationContext] Cleared ${count} contexts`);
  }

  /**
   * Track a conversation turn and decrement all context lifespans
   * @param {string} userInput - User's input text
   * @param {Object} intent - Detected intent with params
   * @param {Object} response - System response
   */
  addTurn(userInput, intent, response) {
    // Add to turn history
    this.turnHistory.push({
      user: userInput,
      intent,
      response,
      timestamp: Date.now()
    });

    // Keep only last N turns
    if (this.turnHistory.length > this.maxTurnHistory) {
      this.turnHistory.shift();
    }

    // Decrement all context lifespans
    this.decrementLifespans();

    console.log(`[ConversationContext] Turn recorded. ${this.contexts.size} contexts active, ${this.turnHistory.length} turns in history`);
  }

  /**
   * Decrement lifespan of all contexts and remove expired ones
   * @private
   */
  decrementLifespans() {
    const expired = [];

    for (const [name, ctx] of this.contexts.entries()) {
      ctx.lifespan--;

      if (ctx.lifespan <= 0) {
        expired.push(name);
      }
    }

    // Remove expired contexts
    for (const name of expired) {
      this.contexts.delete(name);
      console.log(`[ConversationContext] Context "${name}" expired`);
    }
  }

  /**
   * Get last mentioned entity of a specific type
   * Useful for pronoun resolution: "What about tomorrow?" → reuse last location
   * @param {string} entityType - Entity type to find (location, person, task, etc.)
   * @returns {*} Last mentioned entity or null
   */
  getLastMentioned(entityType) {
    // Search turn history in reverse (most recent first)
    for (let i = this.turnHistory.length - 1; i >= 0; i--) {
      const turn = this.turnHistory[i];

      // Check if this turn's intent had the entity
      if (turn.intent?.extractedParams?.[entityType]) {
        return turn.intent.extractedParams[entityType];
      }

      // Also check response data
      if (turn.response?.data?.[entityType]) {
        return turn.response.data[entityType];
      }
    }

    return null;
  }

  /**
   * Get the last N turns
   * @param {number} count - Number of turns to retrieve
   * @returns {Array} Array of turn objects
   */
  getRecentTurns(count = 3) {
    const start = Math.max(0, this.turnHistory.length - count);
    return this.turnHistory.slice(start);
  }

  /**
   * Get full turn history
   * @returns {Array} All turns in history
   */
  getHistory() {
    return [...this.turnHistory];
  }

  /**
   * Find the last turn where a specific intent was triggered
   * @param {string} intentName - Intent to search for
   * @returns {Object|null} Turn object or null
   */
  getLastIntentTurn(intentName) {
    for (let i = this.turnHistory.length - 1; i >= 0; i--) {
      const turn = this.turnHistory[i];
      if (turn.intent?.intent === intentName) {
        return turn;
      }
    }
    return null;
  }

  /**
   * Check if user said something similar recently
   * Useful for detecting repetition or clarification attempts
   * @param {string} text - Text to search for
   * @param {number} withinTurns - Search within last N turns (default: 3)
   * @returns {boolean} True if similar text found
   */
  hasSimilarRecentInput(text, withinTurns = 3) {
    const recent = this.getRecentTurns(withinTurns);
    const normalized = text.toLowerCase().trim();

    for (const turn of recent) {
      const turnText = turn.user.toLowerCase().trim();
      // Simple similarity: check if inputs share significant words
      const words = normalized.split(/\s+/);
      const turnWords = turnText.split(/\s+/);

      // If >50% of words match, consider similar
      const matchCount = words.filter(w => turnWords.includes(w)).length;
      if (matchCount / words.length > 0.5) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get debug information about current state
   * @returns {Object} Debug info
   */
  getDebugInfo() {
    const activeContexts = [];

    for (const [name, ctx] of this.contexts.entries()) {
      activeContexts.push({
        name,
        lifespan: ctx.lifespan,
        data: ctx.data,
        age: Date.now() - ctx.createdAt
      });
    }

    return {
      activeContexts,
      contextCount: this.contexts.size,
      turnCount: this.turnHistory.length,
      recentTurns: this.getRecentTurns(3).map(t => ({
        user: t.user,
        intent: t.intent?.intent,
        timestamp: t.timestamp
      }))
    };
  }

  /**
   * Reset entire conversation state
   * Useful for starting fresh or testing
   */
  reset() {
    this.contexts.clear();
    this.turnHistory = [];
    console.log('[ConversationContext] Reset complete');
  }
}

// Export singleton instance
export const conversationContext = new ConversationContext();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.conversationContext = conversationContext;

  // Debug helpers
  window.debugContext = () => {
    console.log('[Context Debug]', conversationContext.getDebugInfo());
  };

  window.showContexts = () => {
    const active = conversationContext.getAllActive();
    console.log('[Active Contexts]', active);
  };

  window.showHistory = () => {
    const history = conversationContext.getHistory();
    console.log('[Turn History]', history);
  };

  console.log('💬 ConversationContext Debug Commands:');
  console.log('  debugContext()    - Show full context state');
  console.log('  showContexts()    - Show all active contexts');
  console.log('  showHistory()     - Show conversation history');
}
