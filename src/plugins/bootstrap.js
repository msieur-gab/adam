/**
 * Plugin Bootstrap
 * Initialize and load all plugins
 */

import { pluginManager } from './plugin-manager.js';
import { newsReaderPlugin } from './news-reader-plugin.js';
import { ambientSoundPlugin } from './ambient-sound-plugin.js';
import { reminderPlugin } from './reminder-plugin.js';
import { compromiseNluService } from '../services/compromise-nlu-service.js';

/**
 * Initialize plugin system
 */
export async function initializePlugins() {
  console.log('[PluginBootstrap] Initializing plugin system...');

  try {
    // Register news reader plugin
    await pluginManager.registerPlugin(newsReaderPlugin);

    // Register ambient sound plugin
    await pluginManager.registerPlugin(ambientSoundPlugin);

    // Register reminder plugin
    await pluginManager.registerPlugin(reminderPlugin);

    // Add plugin NLU patterns to compromise service
    const patterns = pluginManager.getNLUPatterns();
    compromiseNluService.addPluginPatterns(patterns);

    // Log stats
    const stats = pluginManager.getStats();
    console.log('[PluginBootstrap] Plugin system initialized:', stats);

    return {
      success: true,
      stats
    };

  } catch (error) {
    console.error('[PluginBootstrap] Failed to initialize plugins:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get plugin manager instance (for console access)
 */
export function getPluginManager() {
  return pluginManager;
}

/**
 * List all plugins (for debugging)
 */
export function listPlugins() {
  return pluginManager.listPlugins();
}

export default { initializePlugins, getPluginManager, listPlugins };
