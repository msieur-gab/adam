import { LitElement, html, css } from 'lit';
import { ttsService } from '../services/tts-service.js';

/**
 * Voice Input Component
 * Uses Web Speech API for voice recognition
 * Designed for elderly users with clear visual feedback
 */
class VoiceInput extends LitElement {
  static properties = {
    listening: { type: Boolean },
    transcript: { type: String },
    supported: { type: Boolean },
    error: { type: String }
  };

  static styles = css`
    :host {
      display: block;
    }

    /* Floating Action Button */
    .fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      border: none;
      background: var(--primary);
      color: white;
      font-size: 1.75rem;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2), 0 6px 20px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .fab:hover {
      background: var(--primary-light);
      transform: scale(1.1);
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.25), 0 8px 24px rgba(0, 0, 0, 0.2);
    }

    .fab:active {
      transform: scale(0.95);
    }

    .fab.listening {
      background: var(--error);
      animation: pulse 1.5s ease-in-out infinite;
      width: 72px;
      height: 72px;
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2), 0 0 0 0 rgba(220, 38, 38, 0.4);
      }
      50% {
        opacity: 0.9;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2), 0 0 0 12px rgba(220, 38, 38, 0);
      }
    }

    /* Transcript overlay - only shown when listening */
    .transcript-overlay {
      position: fixed;
      bottom: 104px;
      right: 24px;
      max-width: 320px;
      background: var(--surface);
      border-radius: 12px;
      padding: 1rem;
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
      z-index: 999;
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .transcript-text {
      font-size: 1rem;
      color: var(--text);
      line-height: 1.5;
      min-height: 24px;
    }

    .transcript-text.empty {
      color: var(--text-light);
      font-style: italic;
    }

    .visualizer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 3px;
      margin-bottom: 0.75rem;
      height: 24px;
    }

    .bar {
      width: 3px;
      height: 8px;
      background: var(--primary);
      border-radius: 2px;
      transition: height 0.1s;
    }

    .visualizer.active .bar {
      animation: wave 1s ease-in-out infinite;
    }

    .bar:nth-child(1) { animation-delay: 0s; }
    .bar:nth-child(2) { animation-delay: 0.1s; }
    .bar:nth-child(3) { animation-delay: 0.2s; }
    .bar:nth-child(4) { animation-delay: 0.3s; }
    .bar:nth-child(5) { animation-delay: 0.4s; }

    @keyframes wave {
      0%, 100% { height: 8px; }
      50% { height: 20px; }
    }

    .error-toast {
      position: fixed;
      bottom: 104px;
      right: 24px;
      background: var(--error);
      color: white;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.875rem;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      z-index: 999;
      animation: slideUp 0.3s ease-out;
    }

    .not-supported {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--surface);
      color: var(--text);
      padding: 1rem;
      border-radius: 12px;
      max-width: 280px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      z-index: 1000;
      text-align: center;
    }

    .not-supported-title {
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--error);
    }

    .not-supported-text {
      font-size: 0.875rem;
      color: var(--text-light);
    }
  `;

  constructor() {
    super();
    this.listening = false;
    this.transcript = '';
    this.supported = false;
    this.error = '';
    this.recognition = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this.initializeSpeechRecognition();
  }

  initializeSpeechRecognition() {
    // Check for Web Speech API support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.supported = false;
      this.error = 'Voice recognition is not supported in this browser';
      return;
    }

    this.supported = true;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US'; // TODO: Make this configurable from profile

    this.recognition.onresult = (event) => {
      const results = Array.from(event.results);
      const transcript = results
        .map(result => result[0].transcript)
        .join('');

      this.transcript = transcript;

      // If this is a final result, dispatch event
      if (event.results[event.results.length - 1].isFinal) {
        this.dispatchTranscript(transcript);
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.error = `Error: ${event.error}`;
      this.listening = false;
    };

    this.recognition.onend = () => {
      this.listening = false;
    };
  }

  toggleListening() {
    if (!this.supported) {
      return;
    }

    if (this.listening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  startListening() {
    this.error = '';
    this.transcript = '';
    this.listening = true;

    // Stop any ongoing TTS playback when user clicks mic
    ttsService.stop();
    console.log('[VoiceInput] Stopped TTS for new voice input');

    // Dispatch event to signal interruption (for companion-chat to cancel pending responses)
    this.dispatchEvent(new CustomEvent('voice-interrupt', {
      bubbles: true,
      composed: true
    }));

    try {
      this.recognition.start();
    } catch (error) {
      console.error('Failed to start recognition:', error);
      this.error = 'Failed to start voice recognition';
      this.listening = false;
    }
  }

  stopListening() {
    this.listening = false;
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  dispatchTranscript(text) {
    // Emit custom event with transcript
    this.dispatchEvent(new CustomEvent('voice-input', {
      detail: { transcript: text },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    if (!this.supported) {
      return html`
        <div class="not-supported">
          <div class="not-supported-title">Voice Not Supported</div>
          <div class="not-supported-text">
            Please use Chrome, Edge, or Safari for voice features
          </div>
        </div>
      `;
    }

    return html`
      <!-- Floating Action Button -->
      <button
        class="fab ${this.listening ? 'listening' : ''}"
        @click=${this.toggleListening}
        aria-label="${this.listening ? 'Stop listening' : 'Start voice input'}"
        title="${this.listening ? 'Stop listening' : 'Tap to speak'}"
      >
        ${this.listening ? '⏹️' : '🎤'}
      </button>

      <!-- Transcript overlay - only shown when listening -->
      ${this.listening ? html`
        <div class="transcript-overlay">
          <div class="visualizer active">
            ${[...Array(5)].map(() => html`<div class="bar"></div>`)}
          </div>
          <div class="transcript-text ${this.transcript ? '' : 'empty'}">
            ${this.transcript || 'Listening... speak now'}
          </div>
        </div>
      ` : ''}

      <!-- Error toast -->
      ${this.error && !this.listening ? html`
        <div class="error-toast">${this.error}</div>
      ` : ''}
    `;
  }
}

customElements.define('voice-input', VoiceInput);
