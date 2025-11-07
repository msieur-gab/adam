import { KokoroTTS } from 'kokoro-js';
import SamJs from 'sam-js';

/**
 * TTS Service for ADAM
 * Supports multiple TTS backends: SAM (retro), Kokoro (premium), Browser (fallback)
 */

class TTSService {
  constructor() {
    this.provider = 'sam'; // 'sam', 'kokoro', 'browser', 'elevenlabs'
    this.selectedVoice = null;
    this.apiKey = null;
    this.voicesLoaded = false;

    // SAM-specific properties
    this.samEngine = null;
    this.samReady = false;

    // Kokoro-specific properties
    this.kokoroModel = null;
    this.kokoroLoading = false;
    this.kokoroReady = false;
    this.kokoroVoice = 'af_aoede'; // AOede - performs well, no scrambling

    // Web Audio API for Kokoro playback
    this.audioContext = null;
    this.currentSource = null; // Track current playing source for stop functionality

    // Audio cache for common responses
    this.audioCache = new Map();
    this.maxCacheSize = 20; // Cache up to 20 common responses
    this.cacheMemoryLimit = 50 * 1024 * 1024; // 50MB limit for audio cache
    this.currentCacheSize = 0; // Track memory usage
  }

  /**
   * Initialize TTS with best available provider
   */
  async initialize(provider = 'sam', apiKey = null, onProgress = null) {
    this.provider = provider;
    this.apiKey = apiKey;

    switch (provider) {
      case 'sam':
        await this.initializeSAM();
        break;
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
        await this.initializeSAM();
    }
  }

  /**
   * Initialize SAM (Software Automatic Mouth) - Retro 1980s TTS
   */
  async initializeSAM() {
    try {
      console.log('🎙️  Initializing SAM (Retro 1980s TTS)...');
      this.samEngine = new SamJs();
      this.samReady = true;
      console.log('✅ SAM TTS ready - expect robotic Commodore 64 voice!');
      return true;
    } catch (error) {
      console.error('Failed to initialize SAM:', error);
      this.samReady = false;
      throw error;
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

      // Try q4 for faster WASM generation (trades quality for speed)
      // Options: fp32 (slow, best), q8 (medium, good), q4 (fast, okay)
      const device = 'wasm';
      const dtype = 'q4';  // Faster than q8, lower quality

      console.log('🚀 Using device:', device, 'with dtype:', dtype);
      console.log('💡 Performance tip: WebGPU is 10-100x faster than WASM');

      this.kokoroModel = await KokoroTTS.from_pretrained(model_id, {
        dtype: dtype,
        device: device,
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
      this.kokoroDevice = device; // Store for debugging
      this.kokoroDtype = dtype;
      console.log(`✅ Kokoro TTS initialized successfully with ${device} (${dtype})`);
      console.log(`⚡ Expected generation time: ${device === 'webgpu' ? '50-200ms' : '200-1000ms'} per sentence`);
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
      case 'sam':
        if (this.samReady) {
          return this.speakSAM(text, { pitch, rate });
        } else {
          console.warn('SAM not ready, falling back to browser TTS');
          return this.speakBrowser(text, { rate, pitch, volume });
        }
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
   * Speak using SAM (Software Automatic Mouth) - 1980s retro TTS
   */
  async speakSAM(text, { pitch = 64, rate = 72 }) {
    try {
      const startTime = performance.now();
      console.log('🎙️  SAM speaking:', text.substring(0, 50) + '...');

      // Configure SAM parameters (0-255)
      this.samEngine.setPitch(pitch);     // Default 64 (0=high, 255=low)
      this.samEngine.setSpeed(rate);      // Default 72 (0=fast, 255=slow)
      this.samEngine.setMouth(128);       // Mouth size
      this.samEngine.setThroat(128);      // Throat size

      // Generate 8-bit audio buffer
      const audioBuffer = this.samEngine.buf8(text);

      if (!audioBuffer || audioBuffer.length === 0) {
        throw new Error('SAM failed to generate audio');
      }

      const genTime = performance.now() - startTime;
      console.log(`⚡ SAM generated in ${genTime.toFixed(0)}ms (instant!)`);

      // Play using Web Audio API
      await this.playSAMAudio(audioBuffer);

      const totalTime = performance.now() - startTime;
      console.log(`✅ Total SAM time: ${totalTime.toFixed(0)}ms`);

    } catch (error) {
      console.error('SAM speech failed:', error);
      // Fallback to browser TTS
      return this.speakBrowser(text, { rate: 0.9, pitch: 1.0, volume: 1.0 });
    }
  }

  /**
   * Play SAM audio buffer using Web Audio API
   */
  async playSAMAudio(uint8Buffer) {
    return new Promise(async (resolve, reject) => {
      try {
        // Create audio context if needed
        if (!this.audioContext) {
          this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // SAM outputs 8-bit unsigned PCM at 22050 Hz
        const sampleRate = 22050;
        const samples = new Float32Array(uint8Buffer.length);

        // Convert 8-bit unsigned to float32 (-1 to 1)
        for (let i = 0; i < uint8Buffer.length; i++) {
          samples[i] = (uint8Buffer[i] - 128) / 128.0;
        }

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

        // Resume context if suspended
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }

        // Handle playback completion
        source.onended = () => {
          console.log('✅ SAM speech completed');
          resolve();
        };

        // Start playback
        source.start(0);
        console.log('🔊 Playing SAM audio...');

      } catch (error) {
        console.error('❌ Failed to play SAM audio:', error);
        reject(error);
      }
    });
  }

  /**
   * Speak using Kokoro TTS with progressive sentence-level playback
   * This plays sentences as they're generated for faster perceived response
   */
  async speakKokoro(text, { voice = null, rate = 0.9, progressive = true }) {
    try {
      const startTime = performance.now();
      console.log('🎤 Generating speech with Kokoro:', text.substring(0, 50) + '...');

      // Use provided voice or default
      const selectedVoice = voice || this.kokoroVoice;

      // Progressive mode: split into sentences and play as we generate
      if (progressive && text.length > 100) {
        return await this.speakKokoroProgressive(text, { voice: selectedVoice, rate });
      }

      // Standard mode: generate and cache full text
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
   * Progressive sentence-level playback
   * Splits text into sentences and plays them as they're generated
   * This dramatically improves perceived performance
   */
  async speakKokoroProgressive(text, { voice, rate }) {
    const startTime = performance.now();
    const sentences = this.splitIntoSentences(text);

    console.log(`🚀 Progressive playback: ${sentences.length} sentences`);

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (!sentence) continue;

      const sentenceStart = performance.now();

      // Check cache for this sentence
      const cacheKey = `${voice}:${rate}:${sentence}`;
      let audioData = this.audioCache.get(cacheKey);

      if (!audioData) {
        // Generate audio for this sentence
        audioData = await this.kokoroModel.generate(sentence, {
          voice: voice,
          speed: rate
        });

        const genTime = performance.now() - sentenceStart;
        console.log(`📝 Sentence ${i + 1}/${sentences.length}: ${genTime.toFixed(0)}ms - "${sentence.substring(0, 40)}..."`);

        // Cache this sentence
        this.cacheAudio(cacheKey, audioData);
      } else {
        console.log(`⚡ Cached sentence ${i + 1}/${sentences.length}`);
      }

      // Play immediately
      await this.playKokoroAudio(audioData);
    }

    const totalTime = performance.now() - startTime;
    console.log(`✅ Progressive playback complete: ${totalTime.toFixed(0)}ms total`);
  }

  /**
   * Split text into sentences for progressive playback
   */
  splitIntoSentences(text) {
    // Split on sentence boundaries (. ! ?) followed by space or end
    // Keep the punctuation with the sentence
    return text
      .replace(/([.!?])\s+/g, '$1|')  // Replace sentence boundaries with delimiter
      .split('|')                      // Split on delimiter
      .map(s => s.trim())              // Trim whitespace
      .filter(s => s.length > 0);      // Remove empty strings
  }

  /**
   * Cache audio for faster playback with memory management
   */
  cacheAudio(key, audioData) {
    // Calculate size of this audio sample (Float32Array bytes)
    const audioSize = audioData.audio.length * 4; // 4 bytes per float32

    // Check memory limit
    if (this.currentCacheSize + audioSize > this.cacheMemoryLimit) {
      console.log('⚠️  Cache memory limit reached, clearing oldest entries');
      this.clearOldestCacheEntries(audioSize);
    }

    // Implement LRU cache - remove oldest if at count capacity
    if (this.audioCache.size >= this.maxCacheSize) {
      const firstKey = this.audioCache.keys().next().value;
      const firstData = this.audioCache.get(firstKey);
      const firstSize = firstData.audio.length * 4;
      this.audioCache.delete(firstKey);
      this.currentCacheSize -= firstSize;
    }

    // Mark as cached for logging
    audioData.cached = true;
    audioData.cacheSize = audioSize;
    this.audioCache.set(key, audioData);
    this.currentCacheSize += audioSize;

    const sizeMB = (this.currentCacheSize / (1024 * 1024)).toFixed(2);
    console.log(`💾 Cached audio (${this.audioCache.size}/${this.maxCacheSize}, ${sizeMB}MB)`);
  }

  /**
   * Clear oldest cache entries to free memory
   */
  clearOldestCacheEntries(neededSpace) {
    let freedSpace = 0;
    const entries = Array.from(this.audioCache.entries());

    for (const [key, data] of entries) {
      if (freedSpace >= neededSpace) break;

      const size = data.cacheSize || (data.audio.length * 4);
      this.audioCache.delete(key);
      this.currentCacheSize -= size;
      freedSpace += size;
    }

    console.log(`🗑️  Freed ${(freedSpace / (1024 * 1024)).toFixed(2)}MB from cache`);
  }

  /**
   * Clear all cached audio
   */
  clearCache() {
    this.audioCache.clear();
    this.currentCacheSize = 0;
    console.log('🗑️  Audio cache cleared');
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

        // Debug: Log audio data structure
        console.log('🔍 Audio data structure:', {
          hasAudio: !!audioData.audio,
          audioType: audioData.audio?.constructor?.name,
          audioLength: audioData.audio?.length,
          samplingRate: audioData.sampling_rate,
          keys: Object.keys(audioData)
        });

        // Get audio samples from Kokoro output
        const samples = audioData.audio; // Float32Array of audio samples
        const sampleRate = audioData.sampling_rate || 24000; // Kokoro default sample rate

        // Check sample values for issues
        const sampleSlice = samples.slice(0, 100);
        const minSample = Math.min(...sampleSlice);
        const maxSample = Math.max(...sampleSlice);
        const avgSample = sampleSlice.reduce((a, b) => a + Math.abs(b), 0) / sampleSlice.length;

        console.log('🎵 Audio details:', {
          sampleRate,
          samplesLength: samples?.length,
          duration: (samples?.length / sampleRate).toFixed(2) + 's',
          minSample: minSample.toFixed(4),
          maxSample: maxSample.toFixed(4),
          avgAbsSample: avgSample.toFixed(4),
          firstFewSamples: Array.from(samples.slice(0, 10)).map(s => s.toFixed(4))
        });

        // Check if audio seems valid
        if (Math.abs(maxSample) < 0.001 && Math.abs(minSample) < 0.001) {
          console.warn('⚠️  Audio appears to be silent or nearly silent');
        }
        if (Math.abs(maxSample) > 10 || Math.abs(minSample) > 10) {
          console.warn('⚠️  Audio values seem unnormalized (too large)');
        }

        if (!samples || samples.length === 0) {
          throw new Error('No audio samples in Kokoro output');
        }

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
   * Based on testing and community feedback
   */
  getKokoroVoices() {
    return [
      // American English Female (recommended)
      { id: 'af_aoede', name: 'Aoede', description: '⭐ High quality, no scrambling (recommended)', quality: 'excellent' },
      { id: 'af_bella', name: 'Bella', description: 'Warm, friendly voice', quality: 'good' },
      { id: 'af_sarah', name: 'Sarah', description: 'Clear, articulate voice', quality: 'good' },
      { id: 'af_sky', name: 'Sky', description: 'Bright, energetic voice', quality: 'good' },

      // American English Male
      { id: 'am_adam', name: 'Adam', description: 'Professional male voice', quality: 'good' },
      { id: 'am_michael', name: 'Michael', description: 'Deep, reassuring male voice', quality: 'good' },

      // British English Female
      { id: 'bf_emma', name: 'Emma', description: 'Bright British accent', quality: 'good' },
      { id: 'bf_isabella', name: 'Isabella', description: 'Elegant British accent', quality: 'good' },

      // British English Male
      { id: 'bm_george', name: 'George', description: 'Calm British accent', quality: 'good' },
      { id: 'bm_lewis', name: 'Lewis', description: 'Friendly British accent', quality: 'good' }
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

  // Helper to switch TTS engines
  window.switchTTS = async (engine) => {
    console.log(`🔄 Switching to ${engine} TTS...`);
    await ttsService.initialize(engine);
    console.log(`✅ Now using ${engine} TTS`);
  };

  // Helper to test SAM with different parameters
  window.testSAM = async (text = "Hello world, this is SAM speaking.", pitch = 64, speed = 72) => {
    console.log(`🎙️  Testing SAM (pitch: ${pitch}, speed: ${speed})`);
    await ttsService.speakSAM(text, { pitch, rate: speed });
  };

  // Helper to test different Kokoro voices
  window.testVoice = async (voiceId, text = "Hello, this is a test of the Kokoro voice.") => {
    const voices = ttsService.getKokoroVoices();
    const voice = voices.find(v => v.id === voiceId);

    if (!voice) {
      console.error('Voice not found. Available voices:');
      voices.forEach(v => console.log(`  ${v.id} - ${v.name}: ${v.description}`));
      return;
    }

    console.log(`🎤 Testing voice: ${voice.name} (${voiceId})`);
    ttsService.setKokoroVoice(voiceId);
    await ttsService.speak(text);
  };

  // Helper to list all voices
  window.listVoices = () => {
    console.log('🎤 Available Kokoro Voices:');
    ttsService.getKokoroVoices().forEach(v => {
      const star = v.quality === 'excellent' ? '⭐' : '';
      console.log(`${star} ${v.id.padEnd(15)} - ${v.name.padEnd(10)} - ${v.description}`);
    });
  };

  // Helper to show all commands
  window.ttsHelp = () => {
    console.log('🎙️  TTS Testing Commands:');
    console.log('');
    console.log('  switchTTS("sam")       - Switch to SAM (instant, retro)');
    console.log('  switchTTS("kokoro")    - Switch to Kokoro (slow, high quality)');
    console.log('  switchTTS("browser")   - Switch to Browser TTS');
    console.log('');
    console.log('  testSAM("text")        - Test SAM with default settings');
    console.log('  testSAM("text", 32, 100) - Test SAM (pitch 0-255, speed 0-255)');
    console.log('');
    console.log('  listVoices()           - Show Kokoro voices');
    console.log('  testVoice("af_aoede")  - Test specific Kokoro voice');
    console.log('');
    console.log('Current TTS: ' + ttsService.provider);
  };

  console.log('💡 Type window.ttsHelp() for TTS testing commands');
}
