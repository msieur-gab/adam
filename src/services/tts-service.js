import { KokoroTTS } from 'kokoro-js';

/**
 * TTS Service for ADAM
 * Supports multiple TTS backends with Kokoro-js for premium quality
 */

class TTSService {
  constructor() {
    this.provider = 'kokoro'; // 'kokoro', 'browser', 'elevenlabs'
    this.selectedVoice = null;
    this.apiKey = null;
    this.voicesLoaded = false;

    // Kokoro-specific properties
    this.kokoroModel = null;
    this.kokoroLoading = false;
    this.kokoroReady = false;
    this.kokoroVoice = 'af_bella'; // Default warm, natural voice

    // Web Audio API for Kokoro playback
    this.audioContext = null;
    this.currentSource = null; // Track current playing source for stop functionality

    // Audio cache for common responses
    this.audioCache = new Map();
    this.maxCacheSize = 20; // Cache up to 20 common responses
  }

  /**
   * Initialize TTS with best available provider
   */
  async initialize(provider = 'kokoro', apiKey = null, onProgress = null) {
    this.provider = provider;
    this.apiKey = apiKey;

    switch (provider) {
      case 'kokoro':
        try {
          await this.initializeKokoro(onProgress);
        } catch (error) {
          console.error('Failed to initialize Kokoro, falling back to browser TTS:', error);
          this.provider = 'browser';
          await this.initializeBrowserTTS();
        }
        break;
      case 'browser':
        await this.initializeBrowserTTS();
        break;
      case 'elevenlabs':
        // Future: ElevenLabs integration
        console.log('ElevenLabs TTS not yet implemented');
        await this.initializeBrowserTTS(); // Fallback
        break;
      default:
        await this.initializeKokoro(onProgress).catch(() => this.initializeBrowserTTS());
    }
  }

  /**
   * Initialize Kokoro TTS model
   */
  async initializeKokoro(onProgress = null) {
    if (this.kokoroReady) {
      return true;
    }

    if (this.kokoroLoading) {
      // Wait for existing initialization
      while (this.kokoroLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.kokoroReady;
    }

    this.kokoroLoading = true;

    try {
      console.log('🎤 Loading Kokoro TTS model...');

      const model_id = 'onnx-community/Kokoro-82M-v1.0-ONNX';

      // Detect best device (WebGPU > WASM)
      const device = await this.detectBestDevice();
      console.log('🚀 Using device:', device);

      // Use q8 as minimum quality standard
      // Options: 'fp32' (best quality, slowest), 'q8' (good balance)
      const dtype = 'q8'; // Always use q8 for consistent high quality

      this.kokoroModel = await KokoroTTS.from_pretrained(model_id, {
        dtype: dtype,
        device: device, // WebGPU if available, WASM fallback
        progress_callback: (progress) => {
          if (onProgress) {
            onProgress({
              status: progress.status,
              progress: progress.progress || 0,
              loaded: progress.loaded || 0,
              total: progress.total || 0,
              file: progress.file || '',
              device: device // Show which device we're using
            });
          }
        }
      });

      this.kokoroReady = true;
      this.kokoroLoading = false;
      console.log('✅ Kokoro TTS initialized successfully with', device);
      return true;

    } catch (error) {
      console.error('Failed to initialize Kokoro TTS:', error);
      this.kokoroLoading = false;
      this.kokoroReady = false;
      throw error;
    }
  }

  /**
   * Detect the best available device for Kokoro
   * WebGPU is much faster (10-100x) than WASM
   */
  async detectBestDevice() {
    // Check for WebGPU support
    if ('gpu' in navigator) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          console.log('✅ WebGPU available - using GPU acceleration');
          return 'webgpu';
        }
      } catch (error) {
        console.log('WebGPU not available:', error.message);
      }
    }

    console.log('⚠️  Using WASM (slower) - WebGPU not available');
    return 'wasm';
  }

  /**
   * Initialize browser's Web Speech API with best voice selection
   */
  async initializeBrowserTTS() {
    if (!('speechSynthesis' in window)) {
      throw new Error('Speech synthesis not supported');
    }

    // Load voices
    return new Promise((resolve) => {
      const loadVoices = () => {
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
          this.selectBestBrowserVoice(voices);
          this.voicesLoaded = true;
          resolve();
        }
      };

      // Try loading immediately
      loadVoices();

      // Also listen for voiceschanged event
      speechSynthesis.addEventListener('voiceschanged', loadVoices);
    });
  }

  /**
   * Select the best quality voice from browser voices
   */
  selectBestBrowserVoice(voices) {
    console.log('Available voices:', voices.map(v => ({
      name: v.name,
      lang: v.lang,
      local: v.localService
    })));

    // Priority 1: Premium/Enhanced voices (usually marked as remote/online)
    const premiumVoices = [
      // Google Chrome voices (high quality, online)
      'Google US English',
      'Google UK English Female',
      'Google UK English Male',

      // Microsoft Edge voices (Neural TTS, online)
      'Microsoft Aria Online (Natural) - English (United States)',
      'Microsoft Jenny Online (Natural) - English (United States)',
      'Microsoft Guy Online (Natural) - English (United States)',
      'Microsoft Zira - English (United States)',

      // Apple voices (macOS/iOS)
      'Samantha',
      'Alex',
      'Ava',
      'Nicky',
      'Fiona',
      'Moira',
      'Tessa',
      'Karen',
    ];

    // Try to find premium voice
    for (const voiceName of premiumVoices) {
      const voice = voices.find(v =>
        v.name.includes(voiceName) || v.name === voiceName
      );
      if (voice) {
        this.selectedVoice = voice;
        console.log('✅ Selected premium voice:', voice.name);
        return;
      }
    }

    // Priority 2: Online/Remote voices (usually better quality)
    const onlineVoice = voices.find(v =>
      v.lang.startsWith('en') && !v.localService
    );
    if (onlineVoice) {
      this.selectedVoice = onlineVoice;
      console.log('✅ Selected online voice:', onlineVoice.name);
      return;
    }

    // Priority 3: Any voice with "Enhanced", "Premium", "Natural" in name
    const qualityVoice = voices.find(v =>
      v.lang.startsWith('en') &&
      (v.name.includes('Enhanced') ||
       v.name.includes('Premium') ||
       v.name.includes('Natural'))
    );
    if (qualityVoice) {
      this.selectedVoice = qualityVoice;
      console.log('✅ Selected quality voice:', qualityVoice.name);
      return;
    }

    // Fallback: First English voice
    this.selectedVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
    console.log('⚠️  Fallback voice:', this.selectedVoice?.name);
  }

  /**
   * Speak text using the selected provider
   */
  async speak(text, options = {}) {
    const {
      rate = 0.9,  // Slightly slower for elderly users
      pitch = 1.0,
      volume = 1.0,
      voice = null
    } = options;

    switch (this.provider) {
      case 'kokoro':
        if (this.kokoroReady) {
          return this.speakKokoro(text, { voice, rate });
        } else {
          console.warn('Kokoro not ready, falling back to browser TTS');
          return this.speakBrowser(text, { rate, pitch, volume });
        }
      case 'browser':
        return this.speakBrowser(text, { rate, pitch, volume });
      case 'elevenlabs':
        // Future implementation
        return this.speakBrowser(text, { rate, pitch, volume }); // Fallback
      default:
        return this.speakBrowser(text, { rate, pitch, volume });
    }
  }

  /**
   * Speak using Kokoro TTS
   */
  async speakKokoro(text, { voice = null, rate = 0.9 }) {
    try {
      const startTime = performance.now();
      console.log('🎤 Generating speech with Kokoro:', text.substring(0, 50) + '...');

      // Use provided voice or default
      const selectedVoice = voice || this.kokoroVoice;

      // Create cache key
      const cacheKey = `${selectedVoice}:${rate}:${text}`;

      // Check cache first
      let audioData = this.audioCache.get(cacheKey);
      let genTime = 0;

      if (audioData) {
        const cacheTime = performance.now() - startTime;
        console.log(`⚡ Using cached audio (${cacheTime.toFixed(0)}ms)`);
      } else {
        // Generate audio data
        const genStart = performance.now();
        audioData = await this.kokoroModel.generate(text, {
          voice: selectedVoice,
          speed: rate // Speed control (0.5 to 2.0)
        });
        genTime = performance.now() - genStart;
        console.log(`🔄 Generated audio in ${genTime.toFixed(0)}ms`);

        // Cache for future use
        this.cacheAudio(cacheKey, audioData);
      }

      // Play using Web Audio API
      const playStart = performance.now();
      await this.playKokoroAudio(audioData);
      const playTime = performance.now() - playStart;

      const totalTime = performance.now() - startTime;
      console.log(`✅ Total TTS time: ${totalTime.toFixed(0)}ms (gen: ${audioData.cached ? 'cached' : genTime.toFixed(0) + 'ms'}, play: ${playTime.toFixed(0)}ms)`);

    } catch (error) {
      console.error('Failed to generate Kokoro speech:', error);
      // Fallback to browser TTS
      console.log('Falling back to browser TTS');
      return this.speakBrowser(text, { rate: 0.9, pitch: 1.0, volume: 1.0 });
    }
  }

  /**
   * Cache audio for faster playback
   */
  cacheAudio(key, audioData) {
    // Implement LRU cache - remove oldest if at capacity
    if (this.audioCache.size >= this.maxCacheSize) {
      const firstKey = this.audioCache.keys().next().value;
      this.audioCache.delete(firstKey);
    }

    // Mark as cached for logging
    audioData.cached = true;
    this.audioCache.set(key, audioData);
    console.log(`💾 Cached audio (${this.audioCache.size}/${this.maxCacheSize})`);
  }

  /**
   * Play Kokoro audio data using Web Audio API
   */
  async playKokoroAudio(audioData) {
    return new Promise(async (resolve, reject) => {
      try {
        // Create audio context if needed
        if (!this.audioContext) {
          this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Get audio samples from Kokoro output
        const samples = audioData.audio; // Float32Array of audio samples
        const sampleRate = audioData.sampling_rate || 24000; // Kokoro default sample rate

        // Create audio buffer
        const audioBuffer = this.audioContext.createBuffer(
          1, // mono
          samples.length,
          sampleRate
        );

        // Copy samples to buffer
        audioBuffer.getChannelData(0).set(samples);

        // Create buffer source
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);

        // Track current source for stop functionality
        this.currentSource = source;

        // Resume context if suspended (browser autoplay policy)
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }

        // Handle playback completion
        source.onended = () => {
          console.log('✅ Kokoro speech completed');
          this.currentSource = null;
          resolve();
        };

        // Start playback
        source.start(0);
        console.log('🔊 Playing Kokoro audio...');

      } catch (error) {
        console.error('❌ Failed to play Kokoro audio:', error);
        reject(error);
      }
    });
  }

  /**
   * Speak using browser's Web Speech API
   */
  speakBrowser(text, { rate, pitch, volume }) {
    return new Promise((resolve, reject) => {
      // Cancel any ongoing speech
      speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }

      utterance.onend = () => {
        console.log('Speech completed');
        resolve();
      };

      utterance.onerror = (event) => {
        console.error('Speech error:', event.error);
        reject(event.error);
      };

      utterance.onstart = () => {
        console.log('Speaking:', text.substring(0, 50) + '...');
      };

      speechSynthesis.speak(utterance);
    });
  }

  /**
   * Stop any ongoing speech
   */
  stop() {
    if (this.provider === 'browser') {
      speechSynthesis.cancel();
    } else if (this.provider === 'kokoro' && this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource = null;
        console.log('🛑 Kokoro playback stopped');
      } catch (error) {
        // Source might already be stopped
        console.log('Kokoro source already stopped');
      }
    }
  }

  /**
   * Get available Kokoro voices
   */
  getKokoroVoices() {
    return [
      { id: 'af_bella', name: 'Bella', description: 'Warm, friendly female voice (recommended for elderly care)' },
      { id: 'af_sarah', name: 'Sarah', description: 'Clear, articulate female voice' },
      { id: 'am_adam', name: 'Adam', description: 'Professional male voice' },
      { id: 'am_michael', name: 'Michael', description: 'Deep, reassuring male voice' },
      { id: 'bf_emma', name: 'Emma', description: 'Bright, cheerful female voice' },
      { id: 'bf_isabella', name: 'Isabella', description: 'Elegant female voice' },
      { id: 'bm_george', name: 'George', description: 'Calm, steady male voice' },
      { id: 'bm_lewis', name: 'Lewis', description: 'Friendly male voice' }
    ];
  }

  /**
   * Set Kokoro voice
   */
  setKokoroVoice(voiceId) {
    const voices = this.getKokoroVoices();
    const voice = voices.find(v => v.id === voiceId);
    if (voice) {
      this.kokoroVoice = voiceId;
      console.log('Kokoro voice changed to:', voice.name);
      return true;
    }
    return false;
  }

  /**
   * Get list of available voices
   */
  getAvailableVoices() {
    if (this.provider === 'browser') {
      return speechSynthesis.getVoices();
    }
    return [];
  }

  /**
   * Manually set voice by name
   */
  setVoice(voiceName) {
    const voices = this.getAvailableVoices();
    const voice = voices.find(v => v.name === voiceName);
    if (voice) {
      this.selectedVoice = voice;
      console.log('Voice changed to:', voiceName);
      return true;
    }
    return false;
  }

  /**
   * Get current voice info
   */
  getCurrentVoice() {
    if (this.provider === 'kokoro') {
      const voices = this.getKokoroVoices();
      const currentVoice = voices.find(v => v.id === this.kokoroVoice);
      return currentVoice ? {
        provider: 'kokoro',
        name: currentVoice.name,
        description: currentVoice.description,
        id: currentVoice.id
      } : null;
    }

    return this.selectedVoice ? {
      provider: 'browser',
      name: this.selectedVoice.name,
      lang: this.selectedVoice.lang,
      local: this.selectedVoice.localService
    } : null;
  }

  /**
   * Check if TTS is ready
   */
  isReady() {
    if (this.provider === 'kokoro') {
      return this.kokoroReady;
    }
    return this.voicesLoaded;
  }

  /**
   * Get loading status
   */
  getStatus() {
    return {
      provider: this.provider,
      ready: this.isReady(),
      loading: this.kokoroLoading,
      voice: this.getCurrentVoice()
    };
  }
}

// Singleton instance
export const ttsService = new TTSService();
