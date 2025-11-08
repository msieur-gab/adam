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
   * Register plugin's NLU patterns
   * Returns object with subject patterns for compromise NLU
   */
  getNLUPatterns() {
    return {};
  }

  /**
   * Register plugin's intents
   * Returns array of intent definitions
   */
  getIntents() {
    return this.intents;
  }

  /**
   * Register plugin's services
   * Returns map of service instances
   */
  getServices() {
    return this.services;
  }

  /**
   * Get plugin's UI components (if any)
   * Returns map of component definitions
   */
  getComponents() {
    return this.components;
  }

  /**
   * Handle plugin-specific query
   * @param {string} intent - The intent to handle
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Plugin response
   */
  async handleQuery(intent, params) {
    throw new Error('Plugin must implement handleQuery()');
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
}

export default BasePlugin;
