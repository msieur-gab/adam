import { PiperWebEngine, OnnxWebGPURuntime, PiperWebWorkerEngine, OnnxWebGPUWorkerRuntime, HuggingFaceVoiceProvider } from 'piper-tts-web';
import { TTSQueue } from './tts-queue.js';

/**
 * TTS Service for ADAM
 * Supports multiple TTS backends: Piper (primary), Browser TTS (fallback)
 * Now with asynchronous sentence queuing for seamless audio playback
 */

class TTSService {
  constructor() {
    this.provider = 'piper'; // 'piper' or 'browser'
    this.selectedVoice = null;
    this.voicesLoaded = false;

    // Piper-specific properties
    this.piperEngine = null;
    this.piperLoading = false;
    this.piperReady = false;
    this.piperVoice = 'en_US-libritts_r-medium'; // High quality English voice
    this.piperVoiceProvider = null;
    this.piperAvailableVoices = [];

    // Playback control
    this.currentAudio = null; // Track current HTML Audio element for Piper
    this.isSpeaking = false; // Track if currently speaking
    this.shouldStop = false; // Flag to interrupt ongoing generation

    // Async queue for overlapping synthesis and playback
    this.ttsQueue = null;
    this.useAsyncQueue = true; // Enable async queue by default
  }

  /**
   * Initialize TTS with best available provider
   */
  async initialize(provider = 'piper', onProgress = null) {
    this.provider = provider;

    switch (provider) {
      case 'piper':
        try {
          await this.initializePiper(onProgress);
        } catch (error) {
          console.error('Failed to initialize Piper, falling back to browser TTS:', error);
          this.provider = 'browser';
          await this.initializeBrowserTTS();
        }
        break;
      case 'browser':
        await this.initializeBrowserTTS();
        break;
      default:
        // Default to Piper, fallback to browser TTS
        await this.initializePiper(onProgress).catch(() => this.initializeBrowserTTS());
    }
  }

  /**
   * Initialize Piper TTS engine with smart GPU detection
   */
  async initializePiper(onProgress = null) {
    if (this.piperReady) {
      return true;
    }

    if (this.piperLoading) {
      // Wait for existing initialization
      while (this.piperLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.piperReady;
    }

    this.piperLoading = true;

    try {
      console.log('🎤 Loading Piper TTS engine...');
      this.logDeviceInfo();

      // Report initial progress
      if (onProgress) {
        onProgress({ status: 'Detecting device capabilities', progress: 0.1, device: 'detecting' });
      }

      // Detect best device
      const device = await this.detectBestDevice();
      console.log('🚀 Initializing Piper with device:', device);

      if (onProgress) {
        onProgress({ status: 'Initializing engine', progress: 0.2, device });
      }

      // Initialize with WebGPU if available, otherwise WASM
      if (device === 'webgpu') {
        console.log('✅ Using WebGPU for GPU acceleration');
        this.piperEngine = new PiperWebWorkerEngine(new OnnxWebGPUWorkerRuntime());
      } else {
        console.log('⚠️  Using WASM (CPU-only)');
        this.piperEngine = new PiperWebEngine();
      }

      // Initialize voice provider
      this.piperVoiceProvider = new HuggingFaceVoiceProvider();

      if (onProgress) {
        onProgress({ status: 'Loading voice catalog', progress: 0.3, device });
      }

      // Load available voices (optional, for voice selection later)
      try {
        console.log('📥 Loading available Piper voices...');
        this.piperAvailableVoices = await this.piperVoiceProvider.list();
        console.log(`✅ Loaded ${Object.keys(this.piperAvailableVoices).length} voices`);
      } catch (voiceError) {
        console.warn('Could not load voice list, using default voice:', voiceError);
      }

      if (onProgress) {
        onProgress({ status: `Downloading voice model (${this.piperVoice})`, progress: 0.5, device });
      }

      // Test audio generation (this will fetch the voice model automatically)
      console.log('🧪 Testing Piper audio generation...');
      console.log(`📥 Fetching voice model: ${this.piperVoice} (this may take 10-30 seconds)...`);
      const testResult = await this.piperEngine.generate('Hello', this.piperVoice, 0);

      if (onProgress) {
        onProgress({ status: 'Validating audio output', progress: 0.9, device });
      }

      console.log('📦 Piper test response:', {
        hasFile: !!testResult?.file,
        hasPhonemeData: !!testResult?.phonemeData,
        fileType: testResult?.file?.type,
        fileSize: testResult?.file?.size
      });

      if (testResult && testResult.file) {
        console.log('✅ Piper audio test successful');
        this.piperReady = true;
        this.piperLoading = false;
        this.piperDevice = device;

        if (onProgress) {
          onProgress({ status: 'Ready!', progress: 1.0, device });
        }

        console.log(`🎉 Piper TTS initialized successfully with ${device}`);
        return true;
      } else {
        throw new Error('Piper test audio generation failed - no audio file returned');
      }

    } catch (error) {
      console.error('Failed to initialize Piper TTS:', error);
      this.piperLoading = false;
      this.piperReady = false;
      throw error;
    }
  }

  /**
   * Detect the best available device (WebGPU or WASM)
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
   * Log device and browser information for debugging
   */
  logDeviceInfo() {
    const info = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory ? `${navigator.deviceMemory}GB` : 'unknown',
      hasWebGPU: 'gpu' in navigator,
      hasWebGL: !!document.createElement('canvas').getContext('webgl'),
      hasWebGL2: !!document.createElement('canvas').getContext('webgl2')
    };

    console.log('📱 Device Information:');
    console.table(info);

    // Additional WebGPU info if available
    if ('gpu' in navigator) {
      navigator.gpu.requestAdapter().then(adapter => {
        if (adapter) {
          console.log('🎮 WebGPU Adapter Info:', {
            vendor: adapter.info?.vendor || 'unknown',
            architecture: adapter.info?.architecture || 'unknown',
            device: adapter.info?.device || 'unknown',
            description: adapter.info?.description || 'unknown'
          });
        }
      }).catch(e => console.log('WebGPU adapter info unavailable:', e.message));
    }
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
   * Now supports async queue mode for seamless multi-sentence playback
   */
  async speak(text, options = {}) {
    const {
      rate = 0.9,  // Slightly slower for elderly users
      pitch = 1.0,
      volume = 1.0,
      voice = null,
      useQueue = this.useAsyncQueue // Use async queue by default
    } = options;

    // If using async queue and text has multiple sentences, use queue mode
    if (useQueue && this.provider === 'piper' && this.piperReady) {
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      if (sentences.length > 1) {
        console.log('🎵 [TTSService] Using async queue for multi-sentence playback');
        return this.speakWithQueue(text, { voice, rate });
      }
    }

    // Otherwise, use traditional single-sentence mode
    switch (this.provider) {
      case 'piper':
        if (this.piperReady) {
          return this.speakPiper(text, { voice, rate });
        } else {
          console.warn('Piper not ready, falling back to browser TTS');
          return this.speakBrowser(text, { rate, pitch, volume });
        }
      case 'browser':
        return this.speakBrowser(text, { rate, pitch, volume });
      default:
        return this.speakBrowser(text, { rate, pitch, volume });
    }
  }

  /**
   * Speak using async queue with overlapping synthesis and playback
   */
  async speakWithQueue(text, { voice = null, rate = 0.9 } = {}) {
    console.log('🎵 [TTSService] Starting async queued speech');

    // Stop any existing queue
    if (this.ttsQueue) {
      this.ttsQueue.stop();
    }

    // Create synthesis function for queue
    const synthesizeFunc = async (sentence) => {
      return await this.generatePiperAudio(sentence, { voice, rate });
    };

    // Create new queue
    this.ttsQueue = new TTSQueue(synthesizeFunc);

    // Set up callbacks
    this.ttsQueue.onProgress = (current, total) => {
      console.log(`📊 [TTSService] Progress: ${current}/${total}`);
    };

    this.ttsQueue.onComplete = () => {
      console.log('✅ [TTSService] Async queue completed');
      this.isSpeaking = false;
    };

    this.ttsQueue.onError = (error) => {
      console.error('❌ [TTSService] Queue error:', error);
      this.isSpeaking = false;
    };

    // Start speaking
    this.isSpeaking = true;
    await this.ttsQueue.speak(text);
  }

  /**
   * Generate Piper audio and return blob (without playing)
   * Used by async queue for synthesis-only operations
   */
  async generatePiperAudio(text, { voice = null, rate = 0.9 } = {}) {
    try {
      const selectedVoice = voice || this.piperVoice;
      const speakerId = 0;

      console.log(`🎤 [TTSService] Generating audio: "${text.substring(0, 40)}..."`);
      const startTime = performance.now();

      const result = await this.piperEngine.generate(text, selectedVoice, speakerId);

      const elapsed = performance.now() - startTime;
      console.log(`✅ [TTSService] Audio generated in ${elapsed.toFixed(0)}ms`);

      if (!result || !result.file) {
        throw new Error('Piper generated no audio file');
      }

      return result.file; // Return the blob
    } catch (error) {
      console.error('❌ [TTSService] Failed to generate Piper audio:', error);
      throw error;
    }
  }

  /**
   * Speak using Piper TTS
   * Piper returns audio as a Blob (WAV file) which we play using HTML Audio
   */
  async speakPiper(text, { voice = null, rate = 0.9 }) {
    try {
      // Reset stop flag at start of new speech
      this.shouldStop = false;
      this.isSpeaking = true;

      const startTime = performance.now();
      console.log('🎤 Generating speech with Piper:', text.substring(0, 50) + '...');

      const selectedVoice = voice || this.piperVoice;
      const speakerId = 0; // Default speaker

      // Check if we should stop before generation
      if (this.shouldStop) {
        console.log('🛑 TTS interrupted before generation');
        this.isSpeaking = false;
        throw new Error('interrupted');
      }

      // Generate audio
      const genStart = performance.now();
      const result = await this.piperEngine.generate(text, selectedVoice, speakerId);
      const genTime = performance.now() - genStart;
      console.log(`🔄 Generated Piper audio in ${genTime.toFixed(0)}ms`);

      // Check if we should stop after generation
      if (this.shouldStop) {
        console.log('🛑 TTS interrupted after generation');
        this.isSpeaking = false;
        throw new Error('interrupted');
      }

      if (!result || !result.file) {
        throw new Error('Piper generated no audio file');
      }

      // Piper returns { file: Blob, phonemeData: {...} }
      const audioBlob = result.file;
      console.log(`📦 Audio blob: ${audioBlob.type}, ${audioBlob.size} bytes`);

      // Play the audio blob
      const playStart = performance.now();
      await this.playAudioBlob(audioBlob);
      const playTime = performance.now() - playStart;

      this.isSpeaking = false;

      const totalTime = performance.now() - startTime;
      console.log(`✅ Total Piper TTS time: ${totalTime.toFixed(0)}ms (gen: ${genTime.toFixed(0)}ms, play: ${playTime.toFixed(0)}ms)`);

    } catch (error) {
      this.isSpeaking = false;

      // If interrupted, don't fall back - just throw the error
      if (error.message === 'interrupted') {
        throw error;
      }

      console.error('Failed to generate Piper speech:', error);
      console.log('Falling back to browser TTS');
      return this.speakBrowser(text, { rate: 0.9, pitch: 1.0, volume: 1.0 });
    }
  }

  /**
   * Play audio from a Blob using HTML Audio element
   */
  async playAudioBlob(blob) {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const url = URL.createObjectURL(blob);

      audio.src = url;
      audio.autoplay = true;

      // Track current audio for stop functionality
      this.currentAudio = audio;

      // Check for stop during playback
      const stopCheckInterval = setInterval(() => {
        if (this.shouldStop) {
          clearInterval(stopCheckInterval);
          audio.pause();
          URL.revokeObjectURL(url);
          this.currentAudio = null;
          console.log('🛑 Audio playback interrupted');
          reject(new Error('interrupted'));
        }
      }, 100); // Check every 100ms

      audio.onended = () => {
        clearInterval(stopCheckInterval);
        URL.revokeObjectURL(url);
        this.currentAudio = null;
        console.log('✅ Audio playback completed');
        resolve();
      };

      audio.onerror = (error) => {
        clearInterval(stopCheckInterval);
        URL.revokeObjectURL(url);
        this.currentAudio = null;
        console.error('❌ Audio playback error:', error);
        reject(error);
      };

      // Start playback
      audio.play().catch((err) => {
        clearInterval(stopCheckInterval);
        reject(err);
      });
    });
  }

  /**
   * Speak using browser's Web Speech API
   */
  speakBrowser(text, { rate = 0.9, pitch = 1.0, volume = 1.0 }) {
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }

      utterance.onend = () => {
        resolve();
      };

      utterance.onerror = (event) => {
        reject(event.error);
      };

      // Stop any ongoing speech and speak immediately
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    });
  }

  /**
   * Stop any ongoing speech
   */
  stop() {
    console.log('🛑 TTS stop() called');

    // Set flag to interrupt ongoing generation
    this.shouldStop = true;
    this.isSpeaking = false;

    // Stop async queue if active
    if (this.ttsQueue) {
      this.ttsQueue.stop();
    }

    if (this.provider === 'browser') {
      speechSynthesis.cancel();
    } else if (this.provider === 'piper' && this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio = null;
        console.log('🛑 Piper audio playback stopped');
      } catch (error) {
        console.log('Audio element already stopped');
      }
    }
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
    if (this.provider === 'piper') {
      return {
        provider: 'piper',
        voice: this.piperVoice,
        device: this.piperDevice || 'unknown'
      };
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
    if (this.provider === 'piper') {
      return this.piperReady;
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
      loading: this.piperLoading,
      voice: this.getCurrentVoice()
    };
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats() {
    const cacheSizeMB = (this.currentCacheSize / (1024 * 1024)).toFixed(2);
    const cacheLimit = (this.cacheMemoryLimit / (1024 * 1024)).toFixed(2);
    const usage = ((this.currentCacheSize / this.cacheMemoryLimit) * 100).toFixed(1);

    // Try to get browser memory info if available
    let browserMemory = 'Not available';
    if (performance.memory) {
      const usedMB = (performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(2);
      const limitMB = (performance.memory.jsHeapSizeLimit / (1024 * 1024)).toFixed(2);
      browserMemory = `${usedMB}MB / ${limitMB}MB`;
    }

    return {
      cacheEntries: this.audioCache.size,
      maxCacheEntries: this.maxCacheSize,
      cacheSize: `${cacheSizeMB}MB`,
      cacheLimit: `${cacheLimit}MB`,
      cacheUsage: `${usage}%`,
      browserMemory: browserMemory,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Log memory statistics to console
   */
  logMemoryStats() {
    const stats = this.getMemoryStats();
    console.log('📊 TTS Memory Statistics:');
    console.table(stats);
    return stats;
  }
}

// Singleton instance
export const ttsService = new TTSService();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.ttsService = ttsService;
  window.checkMemory = () => ttsService.logMemoryStats();

  // Async queue debugging
  window.enableAsyncQueue = () => {
    ttsService.useAsyncQueue = true;
    console.log('✅ Async queue enabled');
  };

  window.disableAsyncQueue = () => {
    ttsService.useAsyncQueue = false;
    console.log('⚠️  Async queue disabled (using legacy mode)');
  };

  window.queueStatus = () => {
    if (!ttsService.ttsQueue) {
      console.log('No active queue');
      return;
    }
    const progress = ttsService.ttsQueue.getProgress();
    console.log('🎵 Queue Status:');
    console.table({
      current: progress.current,
      total: progress.total,
      percentage: `${progress.percentage.toFixed(1)}%`,
      isPlaying: ttsService.ttsQueue.isSpeaking(),
      queueLength: ttsService.ttsQueue.queue.length,
      synthesizing: ttsService.ttsQueue.synthesisInProgress.size
    });
  };

  // Helper to list available Piper voices
  window.listVoices = async () => {
    if (!ttsService.piperAvailableVoices || ttsService.piperAvailableVoices.length === 0) {
      console.log('⏳ Loading voices list...');
      try {
        ttsService.piperAvailableVoices = await ttsService.piperVoiceProvider.list();
      } catch (error) {
        console.error('❌ Failed to load voices:', error);
        return;
      }
    }

    console.log('🎤 Available Piper Voices:');
    console.log('Format: voice_id (language, quality, speakers)');
    console.log('');

    const voices = ttsService.piperAvailableVoices;
    Object.keys(voices).forEach(voiceId => {
      const voice = voices[voiceId];
      const current = voiceId === ttsService.piperVoice ? '⭐ ' : '   ';
      console.log(`${current}${voiceId} (${voice.language?.name_english || 'unknown'}, ${voice.quality || 'unknown'}, ${voice.num_speakers} speaker(s))`);
    });

    console.log('');
    console.log('To test a voice, use: testVoice("voice_id")');
    console.log(`Current voice: ${ttsService.piperVoice}`);
  };

  // Helper to test a specific voice
  window.testVoice = async (voiceId, text = "Hello, this is a test of the Piper voice.") => {
    if (!ttsService.piperAvailableVoices || ttsService.piperAvailableVoices.length === 0) {
      console.log('Loading voices first...');
      await window.listVoices();
    }

    const voice = ttsService.piperAvailableVoices[voiceId];
    if (!voice) {
      console.error(`❌ Voice "${voiceId}" not found.`);
      console.log('Run listVoices() to see available voices');
      return;
    }

    console.log(`🎤 Testing voice: ${voiceId}`);
    console.log(`   Language: ${voice.language?.name_english || 'unknown'}`);
    console.log(`   Quality: ${voice.quality || 'unknown'}`);
    console.log(`   Speakers: ${voice.num_speakers}`);

    // Temporarily change voice
    const originalVoice = ttsService.piperVoice;
    ttsService.piperVoice = voiceId;

    try {
      await ttsService.speak(text);
      console.log('✅ Test complete');
    } catch (error) {
      console.error('❌ Test failed:', error);
      ttsService.piperVoice = originalVoice; // Restore on error
    }
  };

  // Helper to change voice permanently
  window.setVoice = (voiceId) => {
    if (!ttsService.piperAvailableVoices || ttsService.piperAvailableVoices.length === 0) {
      console.error('❌ Run listVoices() first to see available voices');
      return;
    }

    const voice = ttsService.piperAvailableVoices[voiceId];
    if (!voice) {
      console.error(`❌ Voice "${voiceId}" not found.`);
      console.log('Run listVoices() to see available voices');
      return;
    }

    ttsService.piperVoice = voiceId;
    console.log(`✅ Voice changed to: ${voiceId}`);
    console.log(`   Language: ${voice.language?.name_english || 'unknown'}`);
    console.log(`   Quality: ${voice.quality || 'unknown'}`);
  };

  console.log('🎤 Piper TTS Debug Commands:');
  console.log('  listVoices()           - Show all available voices');
  console.log('  testVoice("voice_id")  - Test a specific voice');
  console.log('  setVoice("voice_id")   - Change current voice');
  console.log('  checkMemory()          - Show memory usage');
  console.log('');
  console.log('🎵 Async Queue Commands:');
  console.log('  enableAsyncQueue()     - Enable async sentence queue (default)');
  console.log('  disableAsyncQueue()    - Use legacy mode (no overlap)');
  console.log('  queueStatus()          - Show current queue status');
}
