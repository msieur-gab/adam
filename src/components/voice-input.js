import { LitElement, html, css } from 'lit';

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
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: var(--surface);
      border-top: 2px solid var(--primary);
      box-shadow: 0 -4px 6px -1px rgb(0 0 0 / 0.1);
      z-index: 100;
    }

    .voice-container {
      padding: var(--spacing);
      max-width: 800px;
      margin: 0 auto;
    }

    .mic-button {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      border: none;
      background: var(--primary);
      color: white;
      font-size: 2rem;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: var(--shadow);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
    }

    .mic-button:hover {
      background: var(--primary-light);
      transform: scale(1.05);
    }

    .mic-button:active {
      transform: scale(0.95);
    }

    .mic-button.listening {
      background: var(--error);
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }

    .transcript-display {
      margin-top: var(--spacing);
      padding: var(--spacing);
      background: var(--bg);
      border-radius: var(--radius);
      min-height: 60px;
      font-size: 1.125rem;
      color: var(--text);
      text-align: center;
    }

    .transcript-display.empty {
      color: var(--text-light);
      font-style: italic;
    }

    .error-message {
      color: var(--error);
      text-align: center;
      padding: 0.5rem;
      font-size: 0.875rem;
    }

    .hint {
      text-align: center;
      color: var(--text-light);
      font-size: 1rem;
      margin-top: 0.5rem;
    }

    .visualizer {
      height: 40px;
      margin: var(--spacing) 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }

    .bar {
      width: 4px;
      height: 10px;
      background: var(--primary);
      border-radius: 2px;
      transition: height 0.1s;
    }

    .listening .bar {
      animation: wave 1s ease-in-out infinite;
    }

    .bar:nth-child(2) { animation-delay: 0.1s; }
    .bar:nth-child(3) { animation-delay: 0.2s; }
    .bar:nth-child(4) { animation-delay: 0.3s; }
    .bar:nth-child(5) { animation-delay: 0.4s; }

    @keyframes wave {
      0%, 100% { height: 10px; }
      50% { height: 30px; }
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
        <div class="voice-container">
          <p class="error-message">${this.error}</p>
          <p class="hint">Please use a browser that supports voice recognition</p>
        </div>
      `;
    }

    return html`
      <div class="voice-container">
        ${this.error ? html`<p class="error-message">${this.error}</p>` : ''}

        <div class="visualizer ${this.listening ? 'listening' : ''}">
          ${[...Array(5)].map(() => html`<div class="bar"></div>`)}
        </div>

        <button
          class="mic-button ${this.listening ? 'listening' : ''}"
          @click=${this.toggleListening}
          aria-label="${this.listening ? 'Stop listening' : 'Start listening'}"
        >
          ${this.listening ? '⏹️' : '🎤'}
        </button>

        <div class="transcript-display ${this.transcript ? '' : 'empty'}">
          ${this.transcript || 'Tap the microphone and speak...'}
        </div>

        <p class="hint">
          ${this.listening ? 'Listening... Speak clearly' : 'Press and hold to speak'}
        </p>
      </div>
    `;
  }
}

customElements.define('voice-input', VoiceInput);
