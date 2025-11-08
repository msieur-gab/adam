/**
 * Plugin Manager
 * Manages plugin lifecycle, registration, and coordination
 */

export class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.intents = new Map(); // intent -> plugin mapping
    this.nluPatterns = {}; // merged NLU patterns from all plugins
  }

  /**
   * Register a plugin
   */
  async registerPlugin(plugin) {
    if (this.plugins.has(plugin.id)) {
      console.warn(`[PluginManager] Plugin ${plugin.id} already registered`);
      return false;
    }

    try {
      // Initialize plugin
      await plugin.initialize();

      // Store plugin
      this.plugins.set(plugin.id, plugin);

      // Register intents
      const intents = plugin.getIntents();
      for (const intent of intents) {
        this.intents.set(intent, plugin.id);
        console.log(`[PluginManager] Registered intent: ${intent} -> ${plugin.id}`);
      }

      // Store NLU patterns by plugin ID
      const patterns = plugin.getNLUPatterns();
      this.nluPatterns[plugin.id] = patterns;

      console.log(`[PluginManager] Registered plugin: ${plugin.name} (${plugin.id})`);
      return true;

    } catch (error) {
      console.error(`[PluginManager] Failed to register plugin ${plugin.id}:`, error);
      return false;
    }
  }

  /**
   * Unregister a plugin
   */
  async unregisterPlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      console.warn(`[PluginManager] Plugin ${pluginId} not found`);
      return false;
    }

    try {
      // Clean up plugin
      await plugin.cleanup();

      // Remove intents
      for (const [intent, pid] of this.intents.entries()) {
        if (pid === pluginId) {
          this.intents.delete(intent);
        }
      }

      // Remove NLU patterns
      delete this.nluPatterns[pluginId];

      // Remove plugin
      this.plugins.delete(pluginId);

      console.log(`[PluginManager] Unregistered plugin: ${pluginId}`);
      return true;

    } catch (error) {
      console.error(`[PluginManager] Failed to unregister plugin ${pluginId}:`, error);
      return false;
    }
  }

  /**
   * Get plugin by ID
   */
  getPlugin(pluginId) {
    return this.plugins.get(pluginId);
  }

  /**
   * Get plugin for intent
   */
  getPluginForIntent(intent) {
    const pluginId = this.intents.get(intent);
    return pluginId ? this.plugins.get(pluginId) : null;
  }

  /**
   * Check if intent is handled by a plugin
   */
  hasPluginForIntent(intent) {
    return this.intents.has(intent);
  }

  /**
   * Execute plugin query
   */
  async executePluginQuery(intent, params) {
    const plugin = this.getPluginForIntent(intent);

    if (!plugin) {
      return {
        success: false,
        error: `No plugin found for intent: ${intent}`
      };
    }

    try {
      const result = await plugin.handleQuery(intent, params);
      return {
        ...result,
        pluginId: plugin.id,
        pluginName: plugin.name
      };

    } catch (error) {
      console.error(`[PluginManager] Plugin query failed:`, error);
      return {
        success: false,
        error: error.message,
        pluginId: plugin.id
      };
    }
  }

  /**
   * Get merged NLU patterns from all plugins
   */
  getNLUPatterns() {
    return this.nluPatterns;
  }

  /**
   * List all registered plugins
   */
  listPlugins() {
    return Array.from(this.plugins.values()).map(p => ({
      id: p.id,
      name: p.name,
      version: p.version,
      enabled: p.enabled,
      description: p.description
    }));
  }

  /**
   * Enable/disable plugin
   */
  setPluginEnabled(pluginId, enabled) {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.enabled = enabled;
      console.log(`[PluginManager] Plugin ${pluginId} ${enabled ? 'enabled' : 'disabled'}`);
      return true;
    }
    return false;
  }

  /**
   * Get plugin statistics
   */
  getStats() {
    return {
      totalPlugins: this.plugins.size,
      enabledPlugins: Array.from(this.plugins.values()).filter(p => p.enabled).length,
      totalIntents: this.intents.size,
      plugins: this.listPlugins()
    };
  }
}

// Export singleton instance
export const pluginManager = new PluginManager();
export default PluginManager;
