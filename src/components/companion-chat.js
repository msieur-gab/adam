import { LitElement, html, css } from 'lit';
import { logConversation, getRecentConversations } from '../services/db-service.js';
import { conversationService } from '../services/conversation-service.js';
import { ttsService } from '../services/tts-service.js';

/**
 * Companion Chat Component
 * Main conversational interface with intelligent rule-based responses
 * Features: Intent recognition, synonym matching, i18n support, natural language generation
 */
class CompanionChat extends LitElement {
  static properties = {
    profile: { type: Object },
    messages: { type: Array },
    processing: { type: Boolean },
    ttsLoading: { type: Boolean },
    ttsProgress: { type: Object }
  };

  static styles = css`
    :host {
      display: block;
    }

    .chat-container {
      background: var(--surface);
      border-radius: var(--radius);
      padding: var(--spacing);
      box-shadow: var(--shadow);
      margin-bottom: var(--spacing);
    }

    .messages {
      display: flex;
      flex-direction: column;
      gap: var(--spacing);
      max-height: calc(100vh - 300px);
      overflow-y: auto;
      padding: var(--spacing);
      padding-bottom: 2rem;
      scroll-behavior: smooth;
    }

    .message {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: 80%;
      padding: var(--spacing);
      border-radius: var(--radius);
      font-size: 1.125rem;
      line-height: 1.6;
    }

    .message.user {
      align-self: flex-end;
      background: var(--primary);
      color: white;
    }

    .message.companion {
      align-self: flex-start;
      background: var(--bg);
      color: var(--text);
      border: 2px solid var(--primary-light);
    }

    .message-time {
      font-size: 0.875rem;
      opacity: 0.7;
    }

    .processing {
      align-self: flex-start;
      padding: var(--spacing);
      color: var(--text-light);
      font-style: italic;
    }

    .welcome {
      text-align: center;
      color: var(--text-light);
      padding: 2rem;
      font-size: 1.125rem;
    }

    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: var(--spacing);
    }

    .dot {
      width: 8px;
      height: 8px;
      background: var(--primary);
      border-radius: 50%;
      animation: typing 1.4s infinite;
    }

    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typing {
      0%, 60%, 100% { opacity: 0.3; }
      30% { opacity: 1; }
    }

    .tts-loading {
      background: linear-gradient(135deg, var(--primary-light), var(--primary));
      border-radius: var(--radius);
      padding: calc(var(--spacing) * 1.5);
      margin-bottom: var(--spacing);
      text-align: center;
      box-shadow: var(--shadow);
      color: white;
    }

    .tts-loading-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .tts-loading-subtitle {
      font-size: 0.875rem;
      opacity: 0.9;
      margin-bottom: var(--spacing);
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 0.5rem;
    }

    .progress-fill {
      height: 100%;
      background: white;
      transition: width 0.3s ease;
      animation: shimmer 2s infinite;
    }

    @keyframes shimmer {
      0% { opacity: 0.7; }
      50% { opacity: 1; }
      100% { opacity: 0.7; }
    }

    .progress-text {
      font-size: 0.75rem;
      opacity: 0.9;
    }
  `;

  constructor() {
    super();
    this.profile = null;
    this.messages = [];
    this.processing = false;
    this.ttsReady = false;
    this.ttsLoading = false;
    this.ttsProgress = { status: '', progress: 0, loaded: 0, total: 0 };

    // Bind handler once for proper cleanup (prevents memory leak)
    this.boundVoiceInputHandler = this.handleVoiceInput.bind(this);

    // Limit message history to prevent unbounded growth
    this.maxMessages = 100; // Keep last 100 messages
  }

  async connectedCallback() {
    super.connectedCallback();

    // Load recent conversations
    const recent = await getRecentConversations(20);
    this.messages = recent.map(log => ([
      { text: log.input, type: 'user', timestamp: log.timestamp },
      { text: log.output, type: 'companion', timestamp: log.timestamp }
    ])).flat();

    // Listen for voice input from voice-input component
    window.addEventListener('voice-input', this.boundVoiceInputHandler);

    // Initialize TTS service
    await this.initializeTTS();

    // Send welcome message if first time
    if (this.messages.length === 0 && this.profile) {
      const greeting = await conversationService.generateResponse('hello', this.profile);
      this.addCompanionMessage(greeting);
    }
  }

  async initializeTTS() {
    this.ttsLoading = true;

    try {
      // Use Kokoro for high-quality speech
      await ttsService.initialize('kokoro', null, (progress) => {
        this.ttsProgress = progress || { status: 'loading', progress: 0 };
        this.requestUpdate();
      });

      this.ttsReady = true;
      const currentVoice = ttsService.getCurrentVoice();
      console.log('🔊 TTS initialized with Kokoro voice:', currentVoice);
    } catch (error) {
      console.error('Failed to initialize Kokoro, falling back to browser TTS:', error);
      // Fallback to browser TTS
      try {
        await ttsService.initialize('browser');
        this.ttsReady = true;
        console.log('🔊 Using browser TTS fallback');
      } catch (fallbackError) {
        console.error('All TTS failed:', fallbackError);
        this.ttsReady = false;
      }
    } finally {
      this.ttsLoading = false;
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('voice-input', this.boundVoiceInputHandler);

    // Stop any ongoing TTS
    ttsService.stop();

    // Clear messages to free memory
    this.messages = [];
  }

  async handleVoiceInput(event) {
    const { transcript } = event.detail;

    if (!transcript || transcript.trim().length === 0) {
      return;
    }

    // Add user message
    this.addUserMessage(transcript);

    // Process and respond
    await this.processInput(transcript);
  }

  addUserMessage(text) {
    this.messages = [
      ...this.messages,
      { text, type: 'user', timestamp: new Date() }
    ];

    // Limit message history to prevent memory leaks
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }

    // Auto-scroll to the latest message
    this.updateComplete.then(() => {
      const messagesContainer = this.shadowRoot.querySelector('.messages');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    });
  }

  addCompanionMessage(text) {
    this.messages = [
      ...this.messages,
      { text, type: 'companion', timestamp: new Date() }
    ];

    // Limit message history to prevent memory leaks
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }

    // Auto-scroll to the latest message
    this.updateComplete.then(() => {
      const messagesContainer = this.shadowRoot.querySelector('.messages');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    });

    // Speak the response using TTS
    this.speak(text);
  }

  async processInput(input) {
    this.processing = true;

    try {
      // Use conversation service for intelligent rule-based responses
      const response = await conversationService.generateResponse(input, this.profile);
      this.addCompanionMessage(response);
      await logConversation(input, response, 'rule-based');
    } catch (error) {
      console.error('Failed to process input:', error);
      this.addCompanionMessage("I'm sorry, I didn't quite catch that. Could you try again?");
    } finally {
      this.processing = false;
    }
  }


  async speak(text) {
    if (!this.ttsReady) {
      return;
    }

    try {
      await ttsService.speak(text, {
        rate: 0.9,
        pitch: 1.0,
        volume: 1.0
      });
    } catch (error) {
      // Ignore interrupted errors - they're expected
      if (error !== 'interrupted') {
        console.error('Speech error:', error);
      }
    }
  }

  formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  render() {
    // Show TTS loading progress
    if (this.ttsLoading) {
      const progress = this.ttsProgress.progress || 0;
      const progressPercent = Math.round(progress * 100);
      const device = this.ttsProgress.device || 'wasm';
      const deviceIcon = device === 'webgpu' ? '🚀' : '⚡';
      const deviceLabel = device === 'webgpu' ? 'GPU Accelerated' : 'WASM';

      return html`
        <div class="tts-loading">
          <div class="tts-loading-title">🎤 Loading Premium Voice...</div>
          <div class="tts-loading-subtitle">
            ${deviceIcon} ${deviceLabel} - Preparing Kokoro TTS
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progressPercent}%"></div>
          </div>
          <div class="progress-text">
            ${progressPercent}% - ${this.ttsProgress.status || 'Initializing'}
          </div>
        </div>
      `;
    }

    if (this.messages.length === 0 && !this.processing) {
      return html`
        <div class="chat-container">
          <div class="welcome">
            <p>👋 Welcome! Tap the microphone below to start talking.</p>
            <p style="color: var(--text-light); font-size: 0.875rem; margin-top: 1rem;">
              🎤 Using premium Kokoro voice for natural speech
            </p>
          </div>
        </div>
      `;
    }

    return html`
      <div class="chat-container">
        <div class="messages">
          ${this.messages.map(msg => html`
            <div class="message ${msg.type}">
              <div>${msg.text}</div>
              <div class="message-time">${this.formatTime(msg.timestamp)}</div>
            </div>
          `)}

          ${this.processing ? html`
            <div class="processing">
              <div class="typing-indicator">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
}

customElements.define('companion-chat', CompanionChat);
