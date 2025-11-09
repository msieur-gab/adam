/**
 * Intent Flow Conversation Service
 * Uses IntentFlowEngine with Dialogflow-style architecture
 *
 * Replaces enhancedConversationService with:
 * - Declarative intent flows
 * - Multi-turn parameter collection
 * - Follow-up conversations
 * - Context management
 */

import { IntentFlowEngine } from './intent-flow-engine.js';
import { TimePlugin } from '../plugins/time-plugin.js';
import { WeatherPlugin } from '../plugins/weather-plugin.js';
import { ReminderPluginV2 } from '../plugins/reminder-plugin-v2.js';
import { NewsPluginV2 } from '../plugins/news-plugin-v2.js';
import { AmbientSoundPluginV2 } from '../plugins/ambient-sound-plugin-v2.js';

export class IntentFlowConversationService {
  constructor() {
    this.engine = new IntentFlowEngine();
    this.initialized = false;
  }

  /**
   * Initialize the service and register plugins
   */
  async initialize() {
    if (this.initialized) return;

    console.log('[IntentFlowConversation] Initializing...');

    // Create plugin instances
    const timePlugin = new TimePlugin();
    const weatherPlugin = new WeatherPlugin();
    const reminderPlugin = new ReminderPluginV2();
    const newsPlugin = new NewsPluginV2();
    const ambientSoundPlugin = new AmbientSoundPluginV2();

    // Initialize plugins
    await Promise.all([
      timePlugin.initialize(),
      weatherPlugin.initialize(),
      reminderPlugin.initialize(),
      newsPlugin.initialize(),
      ambientSoundPlugin.initialize()
    ]);

    // Register with engine
    this.engine.registerPlugin(timePlugin);
    this.engine.registerPlugin(weatherPlugin);
    this.engine.registerPlugin(reminderPlugin);
    this.engine.registerPlugin(newsPlugin);
    this.engine.registerPlugin(ambientSoundPlugin);

    this.initialized = true;
    console.log('[IntentFlowConversation] Initialized with plugins:', this.engine.getRegisteredIntents());
  }

  /**
   * Generate response for user input
   * Compatible with enhancedConversationService API
   */
  async generateResponse(userInput, profile = null) {
    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log(`[IntentFlowConversation] Processing: "${userInput}"`);

      // Execute through intent flow engine
      const result = await this.engine.execute(userInput);

      console.log('[IntentFlowConversation] Result:', {
        text: result.text?.substring(0, 100),
        awaitingInput: result.awaitingInput,
        fallback: result.fallback,
        hedged: result.hedged
      });

      // Format response for compatibility with existing UI
      const response = this.formatResponse(result);

      return response;

    } catch (error) {
      console.error('[IntentFlowConversation] Error:', error);

      // Return fallback response
      return {
        text: "I apologize, but I'm having trouble processing that right now. Could you try again?",
        response: {
          text: "I apologize, but I'm having trouble processing that right now. Could you try again?",
          intent: 'error',
          confidence: 0,
          error: error.message
        },
        nlu: null,
        metadata: {
          awaitingInput: false,
          requiresUserInput: false
        }
      };
    }
  }

  /**
   * Format IntentFlowEngine result to match enhancedConversationService API
   * @private
   */
  formatResponse(result) {
    // Base response format
    const formatted = {
      text: result.text,
      response: {
        text: result.text,
        intent: result.intent || (result.fallback ? 'fallback' : 'unknown'),
        confidence: result.confidence || 0,
        data: result.data
      },
      nlu: {
        intent: result.intent || (result.fallback ? 'fallback' : 'unknown'),
        confidence: result.confidence || 0,
        entities: result.entities || {}
      },
      metadata: {
        awaitingInput: result.awaitingInput || false,
        requiresUserInput: result.requiresUserInput || false,
        isFollowUp: result.isFollowUp || false,
        hedged: result.hedged || false,
        fallback: result.fallback || false
      }
    };

    // Add disambiguation choices if present
    if (result.type === 'disambiguation' && result.choices) {
      formatted.metadata.disambiguation = true;
      formatted.metadata.choices = result.choices;
    }

    // Add parameter prompt info if awaiting input
    if (result.awaitingInput) {
      formatted.metadata.promptingFor = result.awaitingInput;
      formatted.metadata.promptText = result.text;
    }

    return formatted;
  }

  /**
   * Get conversation context (for debugging)
   */
  getContext() {
    return this.engine.context.getDebugInfo();
  }

  /**
   * Reset conversation context
   */
  resetContext() {
    this.engine.reset();
    console.log('[IntentFlowConversation] Context reset');
  }

  /**
   * Get conversation statistics
   */
  getStats() {
    const debugInfo = this.engine.getDebugInfo();

    return {
      totalTurns: debugInfo.contextInfo.turnCount,
      registeredIntents: debugInfo.registeredIntents,
      activeContexts: debugInfo.contextInfo.activeContexts,
      pendingCollection: debugInfo.pendingCollection
    };
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    return {
      engine: this.engine.getDebugInfo(),
      context: this.engine.context.getDebugInfo()
    };
  }
}

// Export singleton instance
export const intentFlowConversationService = new IntentFlowConversationService();

// Also export class for testing
export default IntentFlowConversationService;
