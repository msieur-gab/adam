/**
 * Asynchronous TTS Queue with Audio Playback Overlap
 *
 * Pipeline architecture where synthesis and playback happen in parallel:
 * Sentence 1: [Synthesizing] → [Playing................]
 * Sentence 2:      [Synthesizing] → [Playing................]
 * Sentence 3:           [Synthesizing] → [Playing................]
 *
 * Key principles:
 * - Aggressive pre-synthesis: Start synthesizing 2-3 sentences ahead
 * - Seamless transitions: Next audio ready when current finishes
 * - Rolling window: As you play sentence N, synthesize sentence N+3
 * - No gaps: Immediate playback transitions using Web Audio API
 */

export class TTSQueue {
  constructor(synthesizeFunc) {
    this.synthesizeFunc = synthesizeFunc; // Function that generates audio blob
    this.queue = []; // Queue of {index, audioBuffer, ready} objects
    this.synthesisInProgress = new Map(); // Track ongoing synthesis by index
    this.isPlaying = false;
    this.isStopped = false;
    this.audioContext = null;
    this.currentSource = null;

    // Configuration
    this.lookaheadCount = 3; // How many sentences to synthesize ahead
    this.sentences = [];
    this.currentIndex = 0;

    // Callbacks
    this.onProgress = null; // (current, total) => void
    this.onComplete = null; // () => void
    this.onError = null; // (error) => void

    // Promise resolution for async waiting
    this.completionResolve = null;
    this.completionReject = null;
    this.completionPromise = null;
  }

  /**
   * Initialize Web Audio API context
   */
  async initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log('🔊 Web Audio Context initialized');
    }

    // Resume if suspended (required by some browsers)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Split text into sentences
   */
  splitIntoSentences(text) {
    // Split on .?! followed by space or end of string
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    return sentences
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Main entry point: speak text with async pipeline
   */
  async speak(text) {
    console.log('🎤 [TTSQueue] Starting async speech pipeline');

    // Reset state
    this.stop();
    this.isStopped = false;
    this.sentences = this.splitIntoSentences(text);
    this.currentIndex = 0;
    this.queue = [];
    this.synthesisInProgress.clear();

    if (this.sentences.length === 0) {
      console.log('⚠️  [TTSQueue] No sentences to speak');
      return;
    }

    console.log(`📝 [TTSQueue] Processing ${this.sentences.length} sentences`);

    // Create completion promise
    this.completionPromise = new Promise((resolve, reject) => {
      this.completionResolve = resolve;
      this.completionReject = reject;
    });

    // Initialize Web Audio API
    try {
      await this.initAudioContext();
    } catch (error) {
      console.error('❌ [TTSQueue] Failed to initialize audio context:', error);
      if (this.completionReject) {
        this.completionReject(error);
      }
      throw error;
    }

    // Start synthesis pipeline: kick off first N sentences
    const initialBatch = Math.min(this.lookaheadCount, this.sentences.length);
    console.log(`🚀 [TTSQueue] Pre-synthesizing first ${initialBatch} sentences`);

    for (let i = 0; i < initialBatch; i++) {
      this.startSynthesis(i);
    }

    // Start playback (will play as soon as first sentence is ready)
    this.playNext();

    // Wait for all sentences to complete
    return this.completionPromise;
  }

  /**
   * Start synthesizing a specific sentence
   */
  async startSynthesis(index) {
    if (index >= this.sentences.length) {
      return; // Out of bounds
    }

    if (this.synthesisInProgress.has(index)) {
      return; // Already synthesizing this sentence
    }

    const sentence = this.sentences[index];
    console.log(`🔄 [TTSQueue] Starting synthesis for sentence ${index + 1}/${this.sentences.length}: "${sentence.substring(0, 40)}..."`);

    // Mark as in progress
    this.synthesisInProgress.set(index, true);

    try {
      // Generate audio blob
      const audioBlob = await this.synthesizeFunc(sentence);

      // Check if stopped during synthesis
      if (this.isStopped) {
        console.log(`🛑 [TTSQueue] Synthesis ${index + 1} cancelled (queue stopped)`);
        this.synthesisInProgress.delete(index);
        return;
      }

      // Convert blob to AudioBuffer for Web Audio API
      const audioBuffer = await this.blobToAudioBuffer(audioBlob);

      console.log(`✅ [TTSQueue] Synthesis complete for sentence ${index + 1}/${this.sentences.length}`);

      // Add to queue
      this.queue.push({
        index,
        audioBuffer,
        ready: true
      });

      // Sort queue by index to maintain order
      this.queue.sort((a, b) => a.index - b.index);

      this.synthesisInProgress.delete(index);

      // If nothing is playing and this is the next expected sentence, start playback
      if (!this.isPlaying && this.queue.length > 0 && this.queue[0].index === this.currentIndex) {
        this.playNext();
      }

    } catch (error) {
      console.error(`❌ [TTSQueue] Synthesis failed for sentence ${index + 1}:`, error);
      this.synthesisInProgress.delete(index);

      if (this.onError) {
        this.onError(error);
      }
    }
  }

  /**
   * Convert audio blob to AudioBuffer for Web Audio API
   */
  async blobToAudioBuffer(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    return await this.audioContext.decodeAudioData(arrayBuffer);
  }

  /**
   * Play next sentence in queue
   */
  async playNext() {
    // Check if stopped
    if (this.isStopped) {
      console.log('🛑 [TTSQueue] Playback stopped');
      this.isPlaying = false;
      if (this.completionReject) {
        this.completionReject(new Error('stopped'));
        this.completionResolve = null;
        this.completionReject = null;
      }
      return;
    }

    // Find the next sentence to play (must match currentIndex)
    const nextItem = this.queue.find(item => item.index === this.currentIndex);

    if (!nextItem) {
      // Next sentence not ready yet - wait for it
      if (this.synthesisInProgress.has(this.currentIndex)) {
        console.log(`⏳ [TTSQueue] Waiting for sentence ${this.currentIndex + 1} to finish synthesizing...`);
        this.isPlaying = false;
        // Synthesis completion will call playNext() again
        return;
      } else if (this.currentIndex < this.sentences.length) {
        // Not synthesizing and not ready - start it now
        console.log(`⚠️  [TTSQueue] Sentence ${this.currentIndex + 1} not queued, starting now`);
        this.startSynthesis(this.currentIndex);
        this.isPlaying = false;
        return;
      } else {
        // We've played everything
        console.log('✅ [TTSQueue] All sentences completed');
        this.isPlaying = false;
        if (this.onComplete) {
          this.onComplete();
        }
        if (this.completionResolve) {
          this.completionResolve();
          this.completionResolve = null;
          this.completionReject = null;
        }
        return;
      }
    }

    // Remove from queue
    this.queue = this.queue.filter(item => item.index !== this.currentIndex);

    console.log(`🔊 [TTSQueue] Playing sentence ${this.currentIndex + 1}/${this.sentences.length}`);
    this.isPlaying = true;

    // Trigger synthesis of next sentences in the rolling window
    const lookaheadIndex = this.currentIndex + this.lookaheadCount;
    if (lookaheadIndex < this.sentences.length && !this.synthesisInProgress.has(lookaheadIndex)) {
      console.log(`🔄 [TTSQueue] Triggering lookahead synthesis for sentence ${lookaheadIndex + 1}`);
      this.startSynthesis(lookaheadIndex);
    }

    // Play current audio using Web Audio API
    try {
      await this.playAudioBuffer(nextItem.audioBuffer);

      // Progress callback
      if (this.onProgress) {
        this.onProgress(this.currentIndex + 1, this.sentences.length);
      }

      // Move to next sentence
      this.currentIndex++;

      // Immediately play next (no gaps!)
      this.playNext();

    } catch (error) {
      if (error.message !== 'stopped') {
        console.error('❌ [TTSQueue] Playback error:', error);
        if (this.onError) {
          this.onError(error);
        }
        if (this.completionReject) {
          this.completionReject(error);
          this.completionResolve = null;
          this.completionReject = null;
        }
      }
      this.isPlaying = false;
    }
  }

  /**
   * Play audio buffer using Web Audio API with precise timing
   */
  playAudioBuffer(audioBuffer) {
    return new Promise((resolve, reject) => {
      if (this.isStopped) {
        reject(new Error('stopped'));
        return;
      }

      // Create source node
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      this.currentSource = source;

      // Set up callbacks
      source.onended = () => {
        this.currentSource = null;
        if (this.isStopped) {
          reject(new Error('stopped'));
        } else {
          resolve();
        }
      };

      // Start playback immediately
      source.start(0);
    });
  }

  /**
   * Stop all synthesis and playback
   */
  stop() {
    console.log('🛑 [TTSQueue] Stopping queue');
    this.isStopped = true;
    this.isPlaying = false;

    // Stop current audio
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch (e) {
        // Already stopped
      }
      this.currentSource = null;
    }

    // Clear queue and synthesis tracking
    this.queue = [];

    // Reject completion promise if pending
    if (this.completionReject) {
      this.completionReject(new Error('stopped'));
      this.completionResolve = null;
      this.completionReject = null;
    }

    // Note: We can't cancel ongoing synthesis promises, but isStopped flag will prevent them from being used
  }

  /**
   * Check if currently speaking
   */
  isSpeaking() {
    return this.isPlaying;
  }

  /**
   * Get current progress
   */
  getProgress() {
    return {
      current: this.currentIndex,
      total: this.sentences.length,
      percentage: this.sentences.length > 0 ? (this.currentIndex / this.sentences.length) * 100 : 0
    };
  }
}
