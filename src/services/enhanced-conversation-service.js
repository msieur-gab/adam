/**
 * Enhanced Conversation Service
 * Uses NLU for intent understanding and structured response generation
 */

import { nluService } from './nlu-service.js';
import { responseGenerator } from './response-generator.js';
import { getUserProfile } from './db-service.js';

export class EnhancedConversationService {
  constructor() {
    this.conversationContext = {
      history: [],
      lastIntent: null,
      lastEntities: {},
      userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }

  /**
   * Generate response for user input
   * Main entry point - replaces old generateResponse()
   */
  async generateResponse(userInput, profile = null) {
    try {
      // Get user profile
      const userProfile = profile || await getUserProfile();

      // Update context with user timezone
      if (userProfile?.location?.timezone) {
        this.conversationContext.userTimezone = userProfile.location.timezone;
      }

      // Analyze input with NLU
      const nluResult = await nluService.analyze(userInput, this.conversationContext);

      console.log('[EnhancedConversation] NLU Analysis:', {
        intent: nluResult.intent,
        confidence: nluResult.confidence,
        questionType: nluResult.questionType,
        entities: nluResult.entities,
        temporal: nluResult.temporal
      });

      // Generate structured response
      const response = await responseGenerator.generate(nluResult, userProfile);

      // Update conversation context
      this.updateContext(nluResult, response);

      // Add to history
      this.addToHistory(userInput, response);

      // Return both text (for compatibility) and full response
      return {
        text: response.text,
        response: response,
        nlu: nluResult
      };

    } catch (error) {
      console.error('[EnhancedConversation] Error:', error);

      // Return fallback response
      return {
        text: "I apologize, but I'm having trouble processing that right now. Could you try again?",
        response: {
          text: "I apologize, but I'm having trouble processing that right now. Could you try again?",
          intent: 'error',
          confidence: 0,
          error: error.message
        },
        nlu: null
      };
    }
  }

  /**
   * Update conversation context
   */
  updateContext(nluResult, response) {
    this.conversationContext.lastIntent = nluResult.intent;
    this.conversationContext.lastEntities = nluResult.entities;

    // Keep context history lightweight (last 5 turns)
    if (this.conversationContext.history.length > 5) {
      this.conversationContext.history.shift();
    }
  }

  /**
   * Add to conversation history
   */
  addToHistory(input, response) {
    this.conversationContext.history.push({
      input,
      output: response.text,
      intent: response.intent,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get conversation context (for debugging or analysis)
   */
  getContext() {
    return this.conversationContext;
  }

  /**
   * Reset conversation context
   */
  resetContext() {
    this.conversationContext = {
      history: [],
      lastIntent: null,
      lastEntities: {},
      userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }

  /**
   * Get conversation statistics
   */
  getStats() {
    const intentCounts = {};

    for (const turn of this.conversationContext.history) {
      const intent = turn.intent || 'unknown';
      intentCounts[intent] = (intentCounts[intent] || 0) + 1;
    }

    return {
      totalTurns: this.conversationContext.history.length,
      intents: intentCounts,
      lastIntent: this.conversationContext.lastIntent
    };
  }
}

// Export singleton instance
export const enhancedConversationService = new EnhancedConversationService();

// Also export class for testing
export default EnhancedConversationService;
