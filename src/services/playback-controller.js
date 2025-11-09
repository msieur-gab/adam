/**
 * Global Playback Controller
 * Centralized manager for all audio/media playback in the application
 *
 * Architecture:
 * - Provides unified stop/pause/resume API for all media sources
 * - Manages playback priority (e.g., TTS interrupts ambient sound)
 * - Tracks active playback sources
 * - Coordinates between TTS, ambient sounds, and future media types
 *
 * Benefits:
 * - Single source of truth for "stop everything"
 * - Consistent behavior across all media
 * - Easy to add new media sources
 * - Clear priority management
 */

class PlaybackController {
  constructor() {
    // Registered playback sources
    this.sources = new Map();

    // Playback priority levels (lower = higher priority)
    this.PRIORITY = {
      CRITICAL: 0,    // Alerts, emergency notifications
      HIGH: 1,        // TTS responses, reminders
      MEDIUM: 2,      // News, articles
      LOW: 3,         // Ambient sounds, background audio
      BACKGROUND: 4   // Very low priority background
    };

    // Current active playback by priority
    this.activePlayback = new Map();
  }

  /**
   * Register a playback source
   * @param {string} id - Unique identifier for the source
   * @param {Object} source - Source object with control methods
   * @param {number} priority - Priority level from this.PRIORITY
   */
  register(id, source, priority = this.PRIORITY.MEDIUM) {
    console.log(`[PlaybackController] Registering source: ${id} (priority: ${priority})`);

    if (!source.stop || typeof source.stop !== 'function') {
      throw new Error(`Source ${id} must have a stop() method`);
    }

    this.sources.set(id, {
      source,
      priority,
      isPlaying: () => source.isPlaying ? source.isPlaying() : false,
      stop: () => source.stop(),
      pause: () => source.pause ? source.pause() : source.stop(),
      resume: () => source.resume ? source.resume() : null
    });
  }

  /**
   * Unregister a playback source
   */
  unregister(id) {
    console.log(`[PlaybackController] Unregistering source: ${id}`);
    this.sources.delete(id);
    this.activePlayback.delete(id);
  }

  /**
   * Mark a source as actively playing
   * @param {string} id - Source identifier
   * @param {number} priority - Optional override priority
   */
  setPlaying(id, priority = null) {
    const sourceInfo = this.sources.get(id);
    if (!sourceInfo) {
      console.warn(`[PlaybackController] Unknown source: ${id}`);
      return;
    }

    const actualPriority = priority !== null ? priority : sourceInfo.priority;
    this.activePlayback.set(id, actualPriority);

    console.log(`[PlaybackController] Source ${id} now playing (priority: ${actualPriority})`);

    // Handle priority-based interruption
    this.handlePriorityConflicts(id, actualPriority);
  }

  /**
   * Mark a source as stopped
   */
  setStopped(id) {
    if (this.activePlayback.has(id)) {
      this.activePlayback.delete(id);
      console.log(`[PlaybackController] Source ${id} stopped`);
    }
  }

  /**
   * Handle priority conflicts (higher priority interrupts lower)
   */
  handlePriorityConflicts(newSourceId, newPriority) {
    for (const [id, priority] of this.activePlayback.entries()) {
      // Skip self
      if (id === newSourceId) continue;

      // If new source has higher priority (lower number), pause lower priority
      if (newPriority < priority) {
        console.log(`[PlaybackController] ${newSourceId} (${newPriority}) interrupting ${id} (${priority})`);
        const sourceInfo = this.sources.get(id);
        if (sourceInfo) {
          sourceInfo.pause();
        }
      }
    }
  }

  /**
   * Stop all active playback
   * This is the global "stop everything" command
   */
  stopAll() {
    console.log('[PlaybackController] 🛑 Stopping all playback');

    const stoppedSources = [];

    for (const [id, sourceInfo] of this.sources.entries()) {
      try {
        // Check if currently playing
        if (sourceInfo.isPlaying()) {
          console.log(`[PlaybackController] Stopping ${id}`);
          sourceInfo.stop();
          stoppedSources.push(id);
        }
      } catch (error) {
        console.error(`[PlaybackController] Error stopping ${id}:`, error);
      }
    }

    // Clear active playback map
    this.activePlayback.clear();

    console.log(`[PlaybackController] Stopped ${stoppedSources.length} sources:`, stoppedSources);

    return {
      stopped: stoppedSources.length,
      sources: stoppedSources
    };
  }

  /**
   * Pause all active playback
   */
  pauseAll() {
    console.log('[PlaybackController] ⏸️  Pausing all playback');

    for (const [id, sourceInfo] of this.sources.entries()) {
      try {
        if (sourceInfo.isPlaying()) {
          sourceInfo.pause();
        }
      } catch (error) {
        console.error(`[PlaybackController] Error pausing ${id}:`, error);
      }
    }
  }

  /**
   * Stop playback by priority level (or higher)
   * @param {number} minPriority - Stop all sources with this priority or lower (higher number)
   */
  stopByPriority(minPriority) {
    console.log(`[PlaybackController] Stopping all sources with priority >= ${minPriority}`);

    for (const [id, priority] of this.activePlayback.entries()) {
      if (priority >= minPriority) {
        const sourceInfo = this.sources.get(id);
        if (sourceInfo) {
          sourceInfo.stop();
          this.activePlayback.delete(id);
        }
      }
    }
  }

  /**
   * Get currently playing sources
   */
  getActiveSources() {
    const active = [];

    for (const [id, sourceInfo] of this.sources.entries()) {
      try {
        if (sourceInfo.isPlaying()) {
          active.push({
            id,
            priority: sourceInfo.priority
          });
        }
      } catch (error) {
        // Source may not have isPlaying method
      }
    }

    return active;
  }

  /**
   * Check if any sources are currently playing
   */
  isAnyPlaying() {
    return this.getActiveSources().length > 0;
  }

  /**
   * Get stats for debugging
   */
  getStats() {
    const active = this.getActiveSources();

    return {
      registeredSources: this.sources.size,
      activeSources: active.length,
      activeDetails: active,
      allSources: Array.from(this.sources.keys())
    };
  }
}

// Export singleton instance
export const playbackController = new PlaybackController();

// Export priority levels for easy access
export const PlaybackPriority = playbackController.PRIORITY;

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.playbackController = playbackController;
  window.PlaybackPriority = PlaybackPriority;

  // Debug helpers
  window.stopEverything = () => {
    const result = playbackController.stopAll();
    console.log('✅ Stopped everything:', result);
    return result;
  };

  window.whatIsPlaying = () => {
    const stats = playbackController.getStats();
    console.log('🎵 Playback Status:', stats);
    return stats;
  };

  console.log('🎛️  Playback Controller Debug Commands:');
  console.log('  stopEverything()  - Stop all playback');
  console.log('  whatIsPlaying()   - Show active sources');
}

export default playbackController;
