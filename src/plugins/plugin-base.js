/**
 * Base Plugin Class
 * All plugins extend this to add new capabilities
 */

export class BasePlugin {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.version = config.version || '1.0.0';
    this.enabled = config.enabled !== false;

    // Plugin metadata
    this.description = config.description || '';
    this.author = config.author || '';

    // Plugin capabilities
    this.intents = config.intents || [];
    this.services = config.services || [];
    this.components = config.components || [];
  }

  /**
   * Initialize plugin (called when plugin is loaded)
   */
  async initialize() {
    console.log(`[Plugin:${this.id}] Initializing...`);
  }

  /**
   * [NEW ARCHITECTURE] Register plugin's intent flows
   * Returns declarative intent flow definitions (Dialogflow-style)
   *
   * Example:
   * ```
   * getIntentFlows() {
   *   return {
   *     my_intent: {
   *       scoringRules: {
   *         required: [{ nouns: ['weather', 'forecast'] }],
   *         boosters: [{ hasDate: true, boost: 0.3 }]
   *       },
   *       parameters: {
   *         location: { entity: 'place', required: false, default: 'SF' }
   *       },
   *       fulfill: async (params) => ({ text: "Response" }),
   *       outputContexts: [{ name: 'my-context', lifespan: 2 }],
   *       followUps: { ... }
   *     }
   *   };
   * }
   * ```
   *
   * @returns {Object} Map of intent flows
   */
  getIntentFlows() {
    // Return null by default (backward compatibility)
    // Plugins using new architecture override this method
    return null;
  }

  /**
   * [LEGACY] Register plugin's NLU patterns
   * Returns object with subject patterns for compromise NLU
   *
   * @deprecated Use getIntentFlows() instead for new plugins
   * @returns {Object} NLU pattern definitions
   */
  getNLUPatterns() {
    return {};
  }

  /**
   * [LEGACY] Register plugin's intents
   * Returns array of intent definitions
   *
   * @deprecated Use getIntentFlows() instead for new plugins
   * @returns {Array} Array of intent names
   */
  getIntents() {
    return this.intents;
  }

  /**
   * Register plugin's services
   * Returns map of service instances
   *
   * @returns {Object} Map of services
   */
  getServices() {
    return this.services;
  }

  /**
   * Get plugin's UI components (if any)
   * Returns map of component definitions
   *
   * @returns {Object} Map of components
   */
  getComponents() {
    return this.components;
  }

  /**
   * [LEGACY] Handle plugin-specific query
   * @param {string} intent - The intent to handle
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Plugin response
   *
   * @deprecated Use getIntentFlows() with fulfill() function for new plugins
   */
  async handleQuery(intent, params) {
    throw new Error('Plugin must implement handleQuery() or getIntentFlows()');
  }

  /**
   * Clean up resources (called when plugin is unloaded)
   */
  async cleanup() {
    console.log(`[Plugin:${this.id}] Cleaning up...`);
  }

  /**
   * Check if plugin is compatible with current system version
   */
  isCompatible(systemVersion) {
    return true;
  }

  // ============================================================================
  // PlaybackController Interface
  // These methods are required for plugins that register with PlaybackController
  // Plugins should override these if they manage audio/media playback
  // ============================================================================

  /**
   * Check if plugin is currently playing audio/media
   * @returns {boolean} True if playing
   */
  isPlaying() {
    return false;
  }

  /**
   * Stop playback
   * @returns {Promise<void>}
   */
  async stop() {
    // Override in plugin if needed
  }

  /**
   * Pause playback
   * @returns {Promise<void>}
   */
  async pause() {
    // Override in plugin if needed
  }

  /**
   * Resume playback
   * @returns {Promise<void>}
   */
  async resume() {
    // Override in plugin if needed
  }
}

export default BasePlugin;
