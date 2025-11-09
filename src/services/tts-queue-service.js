/**
 * TTS Queue Service
 * Implements parallel synthesis pipeline for seamless long-form audio playback
 *
 * Architecture:
 * - Aggressively pre-synthesizes N+3 sentences ahead
 * - Uses Web Audio API for gapless playback
 * - Rolling window: As sentence N plays, synthesize sentence N+3
 * - Maintains buffer of 2-3 ready-to-play audio chunks
 * - Natural pauses between sentences for comprehension and rhythm
 *
 * Prosody (Pitch/Intonation):
 * - Piper's neural TTS models naturally handle sentence-final intonation
 * - Models are trained on human speech and include proper pitch drops at sentence ends
 * - No manual pitch manipulation needed - Piper handles this automatically
 */

import { ttsService } from './tts-service.js';
import { playbackController, PlaybackPriority } from './playback-controller.js';

class TTSQueueService {
  constructor() {
    // Audio context for Web Audio API playback
    this.audioContext = null;

    // Queue management
    this.sentences = []; // Array of text strings to synthesize
    this.audioBuffers = new Map(); // Map<index, AudioBuffer>
    this.synthesisPromises = new Map(); // Map<index, Promise>

    // Playback state
    this.currentIndex = 0;
    this.isPlaying = false;
    this.currentSource = null; // Current AudioBufferSourceNode

    // Configuration
    this.lookAhead = 3; // Synthesize N+3 ahead
    this.maxConcurrentSynthesis = 3; // Max parallel synthesis operations
    this.sentencePauseMs = 250; // Natural pause between sentences (in milliseconds)

    // Callbacks
    this.onComplete = null;
    this.onError = null;
    this.onProgress = null;

    // Register with global playback controller
    playbackController.register('tts-queue', this, PlaybackPriority.HIGH);
  }

  /**
   * Initialize Web Audio API context
   */
  async initialize() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log('[TTSQueue] Web Audio API initialized');
    }

    // Resume context if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Queue an array of sentences for seamless playback
   * @param {string[]} sentences - Array of text chunks to synthesize and play
   * @param {Object} options - Options including callbacks
   */
  async queueAndPlay(sentences, options = {}) {
    const {
      onComplete = null,
      onError = null,
      onProgress = null
    } = options;

    // Initialize if needed
    await this.initialize();

    // Store sentences and callbacks
    this.sentences = sentences;
    this.onComplete = onComplete;
    this.onError = onError;
    this.onProgress = onProgress;

    // Reset state
    this.currentIndex = 0;
    this.isPlaying = true;
    this.audioBuffers.clear();
    this.synthesisPromises.clear();

    // Notify playback controller
    playbackController.setPlaying('tts-queue');

    console.log(`[TTSQueue] Starting playback queue with ${sentences.length} sentences`);
    console.log(`[TTSQueue] Strategy: Pre-synthesize ${this.lookAhead} sentences ahead`);

    try {
      // Phase 1: Aggressive pre-synthesis
      // Start synthesizing first N+3 sentences in parallel (non-blocking)
      const initialBatch = Math.min(this.lookAhead + 1, sentences.length);
      console.log(`[TTSQueue] Pre-synthesizing first ${initialBatch} sentences in background...`);

      // Start synthesis for sentence 0 (we'll wait for it)
      if (!this.audioBuffers.has(0) && !this.synthesisPromises.has(0)) {
        const promise = this.synthesizeSentence(0);
        this.synthesisPromises.set(0, promise);
      }

      // Kick off background synthesis for sentences 1-N (don't wait)
      for (let i = 1; i < initialBatch && i < sentences.length; i++) {
        if (!this.audioBuffers.has(i) && !this.synthesisPromises.has(i)) {
          const promise = this.synthesizeSentence(i);
          this.synthesisPromises.set(i, promise);
        }
      }

      // Wait ONLY for first sentence to be ready
      console.log('[TTSQueue] Waiting for first sentence...');
      if (this.synthesisPromises.has(0)) {
        await this.synthesisPromises.get(0);
      }

      // Phase 2: Start playback immediately
      // Background synthesis continues while we play
      console.log('[TTSQueue] First sentence ready - starting playback pipeline...');
      await this.playNext();

    } catch (error) {
      console.error('[TTSQueue] Queue playback failed:', error);
      this.isPlaying = false;

      if (this.onError) {
        this.onError(error);
      }
    }
  }

  /**
   * Synthesize a batch of sentences in parallel
   * @param {number} startIndex - Starting sentence index
   * @param {number} count - Number of sentences to synthesize
   */
  async synthesizeBatch(startIndex, count) {
    const promises = [];

    for (let i = startIndex; i < startIndex + count && i < this.sentences.length; i++) {
      // Skip if already synthesized or in progress
      if (this.audioBuffers.has(i) || this.synthesisPromises.has(i)) {
        continue;
      }

      // Start synthesis
      const promise = this.synthesizeSentence(i);
      this.synthesisPromises.set(i, promise);
      promises.push(promise);

      // Respect concurrent synthesis limit
      if (promises.length >= this.maxConcurrentSynthesis) {
        break;
      }
    }

    // Wait for all synthesis to complete
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  /**
   * Synthesize a single sentence and convert to AudioBuffer
   * @param {number} index - Sentence index
   */
  async synthesizeSentence(index) {
    if (index >= this.sentences.length) {
      return;
    }

    const text = this.sentences[index];
    console.log(`[TTSQueue] Synthesizing sentence ${index + 1}/${this.sentences.length}: "${text.substring(0, 50)}..."`);

    try {
      const startTime = performance.now();

      // Generate audio using Piper
      const selectedVoice = ttsService.piperVoice;
      const speakerId = 0;
      const result = await ttsService.piperEngine.generate(text, selectedVoice, speakerId);

      if (!result || !result.file) {
        throw new Error(`No audio generated for sentence ${index}`);
      }

      // Convert Blob to AudioBuffer
      const arrayBuffer = await result.file.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      // Store in buffer map
      this.audioBuffers.set(index, audioBuffer);
      this.synthesisPromises.delete(index);

      const duration = performance.now() - startTime;
      console.log(`[TTSQueue] ✅ Sentence ${index + 1} ready (${duration.toFixed(0)}ms, ${audioBuffer.duration.toFixed(2)}s audio)`);

      // Report progress
      if (this.onProgress) {
        this.onProgress({
          synthesized: this.audioBuffers.size,
          total: this.sentences.length,
          currentIndex: this.currentIndex
        });
      }

    } catch (error) {
      console.error(`[TTSQueue] Failed to synthesize sentence ${index}:`, error);
      this.synthesisPromises.delete(index);
      throw error;
    }
  }

  /**
   * Play the next sentence in the queue
   */
  async playNext() {
    // Check if we should stop
    if (!this.isPlaying) {
      console.log('[TTSQueue] Playback stopped');
      return;
    }

    // Check if we're done
    if (this.currentIndex >= this.sentences.length) {
      console.log('[TTSQueue] ✅ All sentences played');
      this.isPlaying = false;

      // Notify playback controller
      playbackController.setStopped('tts-queue');

      if (this.onComplete) {
        this.onComplete();
      }
      return;
    }

    // Wait for current sentence to be synthesized
    const maxWaitTime = 30000; // 30 seconds timeout
    const startWait = performance.now();

    while (!this.audioBuffers.has(this.currentIndex)) {
      // Check timeout
      if (performance.now() - startWait > maxWaitTime) {
        throw new Error(`Timeout waiting for sentence ${this.currentIndex} to synthesize`);
      }

      // Check if synthesis failed
      if (!this.synthesisPromises.has(this.currentIndex)) {
        // Synthesis not started or failed, try to start it
        await this.synthesizeSentence(this.currentIndex);
      }

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Get audio buffer
    const audioBuffer = this.audioBuffers.get(this.currentIndex);
    const sentenceIndex = this.currentIndex;

    console.log(`[TTSQueue] ▶️  Playing sentence ${sentenceIndex + 1}/${this.sentences.length}`);

    // Create and configure audio source
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    this.currentSource = source;

    // Set up completion handler BEFORE starting playback
    source.onended = () => {
      console.log(`[TTSQueue] ✅ Sentence ${sentenceIndex + 1} playback complete`);

      // Clean up old buffer (free memory)
      this.audioBuffers.delete(sentenceIndex);

      // Move to next sentence
      this.currentIndex++;

      // Trigger synthesis of next batch (rolling window)
      // As we play sentence N, ensure sentence N+3 is synthesizing
      const nextSynthIndex = this.currentIndex + this.lookAhead;
      if (nextSynthIndex < this.sentences.length) {
        this.synthesizeBatch(nextSynthIndex, 1).catch(err => {
          console.error('[TTSQueue] Background synthesis failed:', err);
        });
      }

      // Add natural pause between sentences for breathing room
      // This helps with comprehension and makes speech sound more natural
      setTimeout(() => {
        // Play next sentence after pause
        this.playNext().catch(err => {
          console.error('[TTSQueue] Playback error:', err);
          if (this.onError) {
            this.onError(err);
          }
        });
      }, this.sentencePauseMs);
    };

    // Start playback
    source.start(0);

    // Report progress
    if (this.onProgress) {
      this.onProgress({
        synthesized: this.audioBuffers.size,
        total: this.sentences.length,
        currentIndex: this.currentIndex
      });
    }
  }

  /**
   * Stop playback and clear queue
   */
  stop() {
    console.log('[TTSQueue] Stop requested');

    this.isPlaying = false;

    // Stop current audio source
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch (error) {
        // Already stopped, ignore
      }
      this.currentSource = null;
    }

    // Clear buffers and promises
    this.audioBuffers.clear();
    this.synthesisPromises.clear();

    // Reset state
    this.currentIndex = 0;
    this.sentences = [];

    // Notify playback controller
    playbackController.setStopped('tts-queue');
  }

  /**
   * Check if currently playing
   */
  getIsPlaying() {
    return this.isPlaying;
  }

  /**
   * Get current playback progress
   */
  getProgress() {
    return {
      currentIndex: this.currentIndex,
      total: this.sentences.length,
      synthesized: this.audioBuffers.size,
      isPlaying: this.isPlaying
    };
  }
}

// Export singleton instance
export const ttsQueueService = new TTSQueueService();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.ttsQueueService = ttsQueueService;

  // Debug helper
  window.testTTSQueue = async () => {
    const testSentences = [
      "This is the first sentence in our test.",
      "Notice how there is no gap between sentences.",
      "The synthesis happens in parallel with playback.",
      "This creates a seamless listening experience.",
      "Even with many sentences, playback is continuous."
    ];

    console.log('🎤 Testing TTS Queue with 5 sentences...');

    await ttsQueueService.queueAndPlay(testSentences, {
      onProgress: (progress) => {
        console.log(`Progress: ${progress.currentIndex + 1}/${progress.total} (${progress.synthesized} buffered)`);
      },
      onComplete: () => {
        console.log('✅ Queue test complete!');
      },
      onError: (error) => {
        console.error('❌ Queue test failed:', error);
      }
    });
  };

  // Helper to adjust sentence pause
  window.setSentencePause = (milliseconds) => {
    ttsQueueService.sentencePauseMs = milliseconds;
    console.log(`✅ Sentence pause set to ${milliseconds}ms`);
    console.log('💡 Recommended range: 150-400ms (natural speech rhythm)');
  };

  console.log('🎤 TTS Queue Debug Commands:');
  console.log('  testTTSQueue()              - Test queue with sample sentences');
  console.log('  setSentencePause(250)       - Adjust pause between sentences (ms)');
  console.log('  ttsQueueService.getProgress() - Check current playback status');
}
