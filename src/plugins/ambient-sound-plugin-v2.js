/**
 * Ambient Sound Plugin v2
 * Migrated to Dialogflow-style architecture
 *
 * Features:
 * - Play ambient sounds with optional duration timer
 * - Stop ambient sounds
 * - Auto-duck volume during TTS
 * - Service worker integration for reliable background timers
 */

import { BasePlugin } from './plugin-base.js';
import { ttsService } from '../services/tts-service.js';
import { playbackController, PlaybackPriority } from '../services/playback-controller.js';

export class AmbientSoundPluginV2 extends BasePlugin {
  constructor() {
    super({
      id: 'ambient-sound-v2',
      name: 'Ambient Sound v2',
      version: '2.0.0',
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
    this.playing = false;  // Internal state (renamed to avoid conflict with isPlaying() method)
    this.currentSound = null;
    this.originalVolume = 0.3; // Default 30% volume
    this.duckedVolume = 0.05;  // 5% during speech
    this.stopTimer = null;
    this.timerType = null; // 'local' or 'sw' (service worker)
    this.swTimerId = null; // Service worker timer ID
    this.isDucked = false;

    // Bind handlers
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

    console.log('[AmbientSoundV2] Initialized with', Object.keys(this.sounds).length, 'sounds');
  }

  async cleanup() {
    this.stopSound();
    this.cleanupTTSIntegration();
    window.removeEventListener('sw-message', this.boundSWMessageHandler);
  }

  /**
   * Define intent flows
   */
  getIntentFlows() {
    return {
      play_ambient: {
        // Scoring rules
        scoringRules: {
          // Required: ambient/sound related words OR specific sound names
          required: [
            {
              nouns: ['sound', 'sounds', 'noise', 'ambiance', 'ambience', 'background',
                      'ocean', 'rain', 'forest', 'fireplace', 'waves', 'nature'],
              verbs: ['play', 'start', 'turn']
            }
          ],

          // Boosters
          boosters: [
            { adjectives: ['ambient', 'relaxing', 'calming', 'peaceful', 'white'], boost: 0.2 },
            { nouns: ['ocean', 'rain', 'forest', 'fireplace', 'waves'], boost: 0.3 },
            { verbs: ['play', 'start'], boost: 0.1 },
            { isCommand: true, boost: 0.1 }
          ],

          // Anti-patterns
          antiPatterns: [
            { nouns: ['weather', 'news', 'time', 'reminder'], penalty: -0.5 },
            { verbs: ['stop', 'pause', 'end'], penalty: -0.7 }
          ]
        },

        // Parameters
        parameters: {
          soundName: {
            entity: 'any',
            required: false,
            default: 'forest',
            extractor: (signals) => this.extractSoundName(signals)
          },
          duration: {
            entity: 'any',
            required: false,
            extractor: (signals) => this.extractDuration(signals),
            validator: (duration) => {
              if (duration && (duration < 1 || duration > 480)) {
                return { valid: false, error: 'Duration must be between 1 and 480 minutes (8 hours)' };
              }
              return { valid: true };
            }
          }
        },

        // Fulfillment
        fulfill: async (params) => {
          try {
            const soundName = params.soundName;
            const duration = params.duration;
            const sound = this.sounds[soundName];

            if (!sound) {
              const available = Object.values(this.sounds).map(s => s.name).join(', ');
              return {
                text: `I don't have that sound. Available sounds are: ${available}`,
                error: 'Sound not found'
              };
            }

            // Play the sound
            await this.playSound(soundName);

            // Set timer if duration specified
            if (duration) {
              await this.setStopTimer(duration);
              return {
                text: `Playing ${sound.name} for ${duration} ${duration === 1 ? 'minute' : 'minutes'}`,
                data: {
                  sound: sound.name,
                  soundKey: soundName,
                  duration,
                  hasTimer: true
                }
              };
            }

            return {
              text: `Playing ${sound.name}`,
              data: {
                sound: sound.name,
                soundKey: soundName,
                hasTimer: false
              }
            };

          } catch (error) {
            console.error('[AmbientSoundV2] Error playing sound:', error);
            return {
              text: 'Sorry, I had trouble playing that sound. Please try again.',
              error: error.message
            };
          }
        },

        // Output contexts
        outputContexts: [
          {
            name: 'ambient-playing',
            lifespan: 5,
            parameters: (result, params) => ({
              sound: params.soundName,
              duration: params.duration
            })
          }
        ]
      },

      stop_ambient: {
        // Scoring rules
        scoringRules: {
          // Required: stop/pause + sound/ambient/music/audio
          required: [
            { verbs: ['stop', 'pause', 'end', 'turn'] },
            { nouns: ['sound', 'sounds', 'music', 'audio', 'ambient', 'noise'] }
          ],

          // Boosters
          boosters: [
            { hasContext: 'ambient-playing', boost: 0.5 },
            { isCommand: true, boost: 0.2 },
            { prepositions: ['off'], boost: 0.1 }
          ],

          // Anti-patterns
          antiPatterns: [
            { verbs: ['play', 'start'], penalty: -0.7 },
            { nouns: ['reminder', 'timer', 'alarm'], penalty: -0.3 }
          ]
        },

        // No parameters needed
        parameters: {},

        // Fulfillment
        fulfill: async (params) => {
          try {
            if (!this.playing) {
              return {
                text: 'No ambient sound is currently playing',
                data: { wasPlaying: false }
              };
            }

            const currentSoundName = this.sounds[this.currentSound]?.name || 'ambient sound';
            await this.stopSound();

            return {
              text: `Stopped ${currentSoundName}`,
              data: {
                wasPlaying: true,
                stoppedSound: currentSoundName
              }
            };

          } catch (error) {
            console.error('[AmbientSoundV2] Error stopping sound:', error);
            return {
              text: 'Sorry, I had trouble stopping the sound.',
              error: error.message
            };
          }
        },

        // Output contexts
        outputContexts: [
          {
            name: 'ambient-stopped',
            lifespan: 2,
            parameters: (result) => ({
              wasPlaying: result.data?.wasPlaying
            })
          }
        ]
      }
    };
  }

  /**
   * Extract sound name from signals
   * @private
   */
  extractSoundName(signals) {
    const text = signals.normalizedText;

    // Check for specific sound names
    if (text.includes('ocean') || text.includes('waves') || text.includes('water')) {
      return 'ocean';
    }
    if (text.includes('rain') || text.includes('storm') || text.includes('thunder')) {
      return 'rain';
    }
    if (text.includes('forest') || text.includes('nature') || text.includes('birds')) {
      return 'forest';
    }
    if (text.includes('fireplace') || text.includes('fire') || text.includes('crackling')) {
      return 'fireplace';
    }
    if (text.includes('white') && text.includes('noise')) {
      return 'white_noise';
    }

    // Default to forest
    return 'forest';
  }

  /**
   * Extract duration in minutes from signals
   * @private
   */
  extractDuration(signals) {
    // Check for numeric time values from NLU
    if (signals.durations && signals.durations.length > 0) {
      const duration = signals.durations[0];
      if (duration.minutes) return duration.minutes;
      if (duration.hours) return duration.hours * 60;
    }

    // Pattern matching as fallback
    const text = signals.originalText;
    const match = text.match(/(\d+)\s*(minute|min|minutes|hour|hours|hr)s?/i);

    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();

      if (unit.startsWith('hour') || unit === 'hr') {
        return value * 60; // Convert to minutes
      }
      return value;
    }

    return null;
  }

  /**
   * Play ambient sound
   * @private
   */
  async playSound(soundName) {
    const sound = this.sounds[soundName];

    if (!sound) {
      throw new Error(`Sound "${soundName}" not found`);
    }

    try {
      // Stop current sound if playing
      if (this.playing) {
        await this.stopSound();
      }

      // Load and play new sound
      this.audioPlayer.src = sound.url;
      this.audioPlayer.volume = this.originalVolume;
      this.currentSound = soundName;

      await this.audioPlayer.play();
      this.playing = true;

      // Notify playback controller
      playbackController.setPlaying('ambient-sound');

      console.log(`[AmbientSoundV2] Playing: ${sound.name}`);

    } catch (error) {
      console.error('[AmbientSoundV2] Failed to play sound:', error);
      throw error;
    }
  }

  /**
   * Stop ambient sound
   * @private
   */
  async stopSound() {
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer.currentTime = 0;
    }

    this.playing = false;
    this.currentSound = null;

    // Cancel any active timer (service worker or local)
    await this.cancelTimer();

    // Notify playback controller
    playbackController.setStopped('ambient-sound');

    console.log('[AmbientSoundV2] Stopped');
  }

  /**
   * Set timer to auto-stop sound
   * Uses service worker for reliable background timers
   * @private
   */
  async setStopTimer(minutes) {
    // Clear any existing timer
    await this.cancelTimer();

    // Check if service worker is available
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      // Use service worker for reliable background timer
      this.timerType = 'sw';
      this.swTimerId = `ambient-sound-${Date.now()}`;

      console.log(`[AmbientSoundV2] Scheduling service worker timer ${this.swTimerId} for ${minutes} minutes`);

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
      console.log(`[AmbientSoundV2] Service worker not available, using local timer for ${minutes} minutes`);
      this.timerType = 'local';

      const milliseconds = minutes * 60 * 1000;
      this.stopTimer = setTimeout(() => {
        console.log(`[AmbientSoundV2] Local timer expired (${minutes} min) - stopping sound`);
        this.stopSound();
        this.stopTimer = null;
      }, milliseconds);
    }
  }

  /**
   * Cancel active timer (service worker or local)
   * @private
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
   * @private
   */
  handleServiceWorkerMessage(event) {
    const { type, data } = event.detail;

    if (type === 'TIMER_EXPIRED' && data.timerId === this.swTimerId) {
      console.log(`[AmbientSoundV2] Service worker timer ${data.timerId} expired - stopping sound`);
      this.stopSound();
    }
  }

  /**
   * Setup TTS integration for auto-ducking
   * @private
   */
  setupTTSIntegration() {
    // Poll ttsService.isSpeaking to detect TTS activity
    this.ttsCheckInterval = setInterval(() => {
      if (ttsService.isSpeaking && !this.isDucked) {
        this.handleTTSStart();
      } else if (!ttsService.isSpeaking && this.isDucked) {
        this.handleTTSEnd();
      }
    }, 100); // Check every 100ms
  }

  /**
   * Cleanup TTS integration
   * @private
   */
  cleanupTTSIntegration() {
    if (this.ttsCheckInterval) {
      clearInterval(this.ttsCheckInterval);
      this.ttsCheckInterval = null;
    }
  }

  /**
   * Handle TTS start - duck volume
   * @private
   */
  handleTTSStart() {
    if (this.playing && this.audioPlayer) {
      this.audioPlayer.volume = this.duckedVolume;
      this.isDucked = true;
      console.log('[AmbientSoundV2] Ducked volume for TTS');
    }
  }

  /**
   * Handle TTS end - restore volume
   * @private
   */
  handleTTSEnd() {
    if (this.playing && this.audioPlayer) {
      this.audioPlayer.volume = this.originalVolume;
      this.isDucked = false;
      console.log('[AmbientSoundV2] Restored volume after TTS');
    }
  }

  // ============================================================================
  // PlaybackController Interface Overrides
  // ============================================================================

  /**
   * Check if currently playing (required by PlaybackController)
   */
  isPlaying() {
    return this.playing;
  }

  /**
   * Stop playback (required by PlaybackController)
   */
  async stop() {
    return this.stopSound();
  }

  /**
   * Pause playback (for PlaybackController)
   */
  async pause() {
    if (this.audioPlayer && this.playing) {
      this.audioPlayer.pause();
      console.log('[AmbientSoundV2] Paused');
    }
  }

  /**
   * Resume playback (for PlaybackController)
   */
  async resume() {
    if (this.audioPlayer && this.currentSound) {
      this.audioPlayer.play();
      console.log('[AmbientSoundV2] Resumed');
    }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Get current sound info
   */
  getCurrentSound() {
    if (!this.currentSound) return null;

    return {
      name: this.sounds[this.currentSound].name,
      key: this.currentSound,
      isPlaying: this.playing
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
export const ambientSoundPluginV2 = new AmbientSoundPluginV2();
export default AmbientSoundPluginV2;
