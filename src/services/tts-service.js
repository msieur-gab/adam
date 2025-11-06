/**
 * TTS Service for ADAM
 * Supports multiple TTS backends for better voice quality
 */

class TTSService {
  constructor() {
    this.provider = 'browser'; // 'browser', 'elevenlabs', 'google'
    this.selectedVoice = null;
    this.apiKey = null;
    this.voicesLoaded = false;
  }

  /**
   * Initialize TTS with best available provider
   */
  async initialize(provider = 'browser', apiKey = null) {
    this.provider = provider;
    this.apiKey = apiKey;

    switch (provider) {
      case 'browser':
        await this.initializeBrowserTTS();
        break;
      case 'elevenlabs':
        // Future: ElevenLabs integration
        console.log('ElevenLabs TTS not yet implemented');
        await this.initializeBrowserTTS(); // Fallback
        break;
      default:
        await this.initializeBrowserTTS();
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
   */
  async speak(text, options = {}) {
    const {
      rate = 0.9,  // Slightly slower for elderly users
      pitch = 1.0,
      volume = 1.0
    } = options;

    switch (this.provider) {
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
    return this.selectedVoice ? {
      name: this.selectedVoice.name,
      lang: this.selectedVoice.lang,
      local: this.selectedVoice.localService
    } : null;
  }
}

// Singleton instance
export const ttsService = new TTSService();
