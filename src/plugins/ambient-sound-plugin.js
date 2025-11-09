/**
 * Ambient Sound Plugin
 * Plays relaxing ambient sounds (forest, rain, ocean, etc.)
 * with auto-duck during TTS and timer support
 */

import { BasePlugin } from './plugin-base.js';
import { ttsService } from '../services/tts-service.js';
import { playbackController, PlaybackPriority } from '../services/playback-controller.js';

export class AmbientSoundPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'ambient-sound',
      name: 'Ambient Sound',
      version: '1.0.0',
      description: 'Plays relaxing ambient sounds with timer and auto-duck',
      author: 'ADAM Team'
    });

    // Available ambient sounds
    this.sounds = {
      forest: {
        name: 'Forest',
        url: 'https://cdn.pixabay.com/audio/2025/02/03/audio_7599bcb342.mp3',
        description: 'Peaceful forest sounds with birds'
      },
      rain: {
        name: 'Rain',
        url: 'https://cdn.pixabay.com/audio/2022/03/15/audio_c610232c26.mp3',
        description: 'Gentle rain sounds'
      },
      ocean: {
        name: 'Ocean Waves',
        url: 'https://cdn.pixabay.com/audio/2022/06/07/audio_32b08d7e26.mp3',
        description: 'Relaxing ocean waves'
      },
      white_noise: {
        name: 'White Noise',
        url: 'https://cdn.pixabay.com/audio/2022/03/10/audio_5c1a0e0eae.mp3',
        description: 'Pure white noise for focus'
      },
      fireplace: {
        name: 'Fireplace',
        url: 'https://cdn.pixabay.com/audio/2022/11/22/audio_3e5bb4fe07.mp3',
        description: 'Crackling fireplace'
      }
    };

    // Playback state
    this.audioPlayer = null;
    this.isPlaying = false;
    this.currentSound = null;
    this.originalVolume = 0.3; // Default 30% volume
    this.duckedVolume = 0.05;  // 5% during speech
    this.stopTimer = null;
    this.timerType = null; // 'local' or 'sw' (service worker)
    this.swTimerId = null; // Service worker timer ID

    // Bind TTS event handlers
    this.boundTTSStartHandler = this.handleTTSStart.bind(this);
    this.boundTTSEndHandler = this.handleTTSEnd.bind(this);
    this.boundSWMessageHandler = this.handleServiceWorkerMessage.bind(this);
  }

  async initialize() {
    // Create audio element
    this.audioPlayer = new Audio();
    this.audioPlayer.loop = true; // Loop ambient sounds
    this.audioPlayer.volume = this.originalVolume;

    // Register with playback controller
    playbackController.register('ambient-sound', this, PlaybackPriority.LOW);

    // Listen for TTS events to auto-duck
    this.setupTTSIntegration();

    // Listen for service worker timer messages
    window.addEventListener('sw-message', this.boundSWMessageHandler);

    console.log('[AmbientSound] Initialized with', Object.keys(this.sounds).length, 'sounds');
  }

  async cleanup() {
    this.stopSound();
    this.cleanupTTSIntegration();
    window.removeEventListener('sw-message', this.boundSWMessageHandler);
  }

  /**
   * Register NLU patterns for ambient sound intents
   */
  getNLUPatterns() {
    return {
      subjects: {
        sound: {
          nouns: ['sound', 'noise', 'ambiance', 'ambience', 'background'],
          adjectives: ['ambient', 'relaxing', 'calming', 'peaceful', 'white'],
          verbs: ['play', 'start'],
          priority: 9
        }
      },

      actions: {
        play: ['play', 'start', 'turn']
      },

      intents: {
        'play_sound': 'ambient_play',
        'start_sound': 'ambient_play',
        'turn_sound': 'ambient_play'
      }
    };
  }

  getIntents() {
    return [
      'ambient_play'
    ];
  }

  /**
   * Handle plugin queries
   */
  async handleQuery(intent, params) {
    console.log('[AmbientSound] handleQuery:', intent, params);

    switch (intent) {
      case 'ambient_play':
        return await this.handlePlaySound(params);

      default:
        return {
          success: false,
          error: `Unknown intent: ${intent}`
        };
    }
  }

  /**
   * Handle play sound request
   */
  async handlePlaySound(params) {
    // Extract sound name from params
    let soundName = this.extractSoundName(params);

    // Extract duration if specified
    const duration = this.extractDuration(params);

    console.log('[AmbientSound] Extracted:', { soundName, duration });

    // Default to forest if no sound specified
    if (!soundName) {
      soundName = 'forest';
    }

    // Check if sound exists
    const sound = this.sounds[soundName];
    if (!sound) {
      return {
        success: false,
        error: `Sound "${soundName}" not found`,
        availableSounds: Object.keys(this.sounds)
      };
    }

    // Play the sound
    await this.playSound(soundName);

    // Set timer if duration specified
    if (duration) {
      this.setStopTimer(duration);
    }

    return {
      success: true,
      sound: sound.name,
      duration: duration,
      message: duration
        ? `Playing ${sound.name} for ${duration} minutes`
        : `Playing ${sound.name}`
    };
  }

  /**
   * Extract sound name from parameters
   */
  extractSoundName(params) {
    // Try to find sound name in various param locations
    const allText = JSON.stringify(params).toLowerCase();

    // Check each sound name
    for (const [key, sound] of Object.entries(this.sounds)) {
      if (allText.includes(key) || allText.includes(sound.name.toLowerCase())) {
        return key;
      }
    }

    // Check for common aliases
    if (allText.includes('water') || allText.includes('waves')) return 'ocean';
    if (allText.includes('fire') || allText.includes('crackling')) return 'fireplace';
    if (allText.includes('nature') || allText.includes('birds')) return 'forest';
    if (allText.includes('storm') || allText.includes('thunder')) return 'rain';

    return null;
  }

  /**
   * Extract duration in minutes from parameters
   */
  extractDuration(params) {
    const allText = JSON.stringify(params);

    // Look for patterns like "30 minutes", "for 1 hour", "2 min"
    const durationMatch = allText.match(/(\d+)\s*(minute|min|hour|hr)/i);

    if (durationMatch) {
      const value = parseInt(durationMatch[1]);
      const unit = durationMatch[2].toLowerCase();

      if (unit.startsWith('hour') || unit === 'hr') {
        return value * 60; // Convert to minutes
      }
      return value; // Already in minutes
    }

    return null;
  }

  /**
   * Play ambient sound
   */
  async playSound(soundName) {
    const sound = this.sounds[soundName];

    if (!sound) {
      throw new Error(`Sound "${soundName}" not found`);
    }

    try {
      // Stop current sound if playing
      if (this.isPlaying) {
        this.stopSound();
      }

      // Load and play new sound
      this.audioPlayer.src = sound.url;
      this.audioPlayer.volume = this.originalVolume;
      this.currentSound = soundName;

      await this.audioPlayer.play();
      this.isPlaying = true;

      // Notify playback controller
      playbackController.setPlaying('ambient-sound');

      console.log(`[AmbientSound] Playing: ${sound.name}`);

    } catch (error) {
      console.error('[AmbientSound] Failed to play sound:', error);
      throw error;
    }
  }

  /**
   * Stop ambient sound
   */
  async stopSound() {
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer.currentTime = 0;
    }

    this.isPlaying = false;
    this.currentSound = null;

    // Cancel any active timer (service worker or local)
    await this.cancelTimer();

    // Notify playback controller
    playbackController.setStopped('ambient-sound');

    console.log('[AmbientSound] Stopped');
  }

  /**
   * Set timer to auto-stop sound
   * Uses service worker for reliable background timers
   */
  async setStopTimer(minutes) {
    // Clear any existing timer
    await this.cancelTimer();

    // Check if service worker is available
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      // Use service worker for reliable background timer
      this.timerType = 'sw';
      this.swTimerId = `ambient-sound-${Date.now()}`;

      console.log(`[AmbientSound] Scheduling service worker timer ${this.swTimerId} for ${minutes} minutes`);

      // Send message to service worker
      navigator.serviceWorker.controller.postMessage({
        type: 'SCHEDULE_TIMER',
        data: {
          timerId: this.swTimerId,
          duration: minutes,
          soundName: this.sounds[this.currentSound]?.name || 'Ambient Sound'
        }
      });
    } else {
      // Fallback to local setTimeout
      console.log(`[AmbientSound] Service worker not available, using local timer for ${minutes} minutes`);
      this.timerType = 'local';

      const milliseconds = minutes * 60 * 1000;
      this.stopTimer = setTimeout(() => {
        console.log(`[AmbientSound] Local timer expired (${minutes} min) - stopping sound`);
        this.stopSound();
        this.stopTimer = null;
      }, milliseconds);
    }
  }

  /**
   * Cancel active timer (service worker or local)
   */
  async cancelTimer() {
    if (this.timerType === 'sw' && this.swTimerId) {
      // Cancel service worker timer
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CANCEL_TIMER',
          data: { timerId: this.swTimerId }
        });
      }
      this.swTimerId = null;
    } else if (this.timerType === 'local' && this.stopTimer) {
      // Cancel local timer
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }

    this.timerType = null;
  }

  /**
   * Handle messages from service worker
   */
  handleServiceWorkerMessage(event) {
    const { type, data } = event.detail;

    if (type === 'TIMER_EXPIRED' && data.timerId === this.swTimerId) {
      console.log(`[AmbientSound] Service worker timer ${data.timerId} expired - stopping sound`);
      this.stopSound();
    }
  }

  /**
   * Setup TTS integration for auto-ducking
   */
  setupTTSIntegration() {
    // We'll hook into ttsService.speak() by checking periodically
    // Since we don't have event emitters, we'll poll isSpeaking
    this.ttsCheckInterval = setInterval(() => {
      if (ttsService.isSpeaking && !this.isDucked) {
        this.handleTTSStart();
      } else if (!ttsService.isSpeaking && this.isDucked) {
        this.handleTTSEnd();
      }
    }, 100); // Check every 100ms
  }

  cleanupTTSIntegration() {
    if (this.ttsCheckInterval) {
      clearInterval(this.ttsCheckInterval);
      this.ttsCheckInterval = null;
    }
  }

  /**
   * Handle TTS start - duck volume
   */
  handleTTSStart() {
    if (this.isPlaying && this.audioPlayer) {
      this.audioPlayer.volume = this.duckedVolume;
      this.isDucked = true;
      console.log('[AmbientSound] Ducked volume for TTS');
    }
  }

  /**
   * Handle TTS end - restore volume
   */
  handleTTSEnd() {
    if (this.isPlaying && this.audioPlayer) {
      this.audioPlayer.volume = this.originalVolume;
      this.isDucked = false;
      console.log('[AmbientSound] Restored volume after TTS');
    }
  }

  /**
   * Check if currently playing
   */
  isCurrentlyPlaying() {
    return this.isPlaying;
  }

  /**
   * Get current sound info
   */
  getCurrentSound() {
    if (!this.currentSound) return null;

    return {
      name: this.sounds[this.currentSound].name,
      key: this.currentSound,
      isPlaying: this.isPlaying
    };
  }

  /**
   * List available sounds
   */
  listSounds() {
    return Object.entries(this.sounds).map(([key, sound]) => ({
      key,
      name: sound.name,
      description: sound.description
    }));
  }
}

// Export singleton instance
export const ambientSoundPlugin = new AmbientSoundPlugin();
export default AmbientSoundPlugin;
