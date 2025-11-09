import { LitElement, html, css } from 'lit';
import { logConversation, getRecentConversations, getProfile } from '../services/db-service.js';
// Use enhanced conversation service with compromise NLU
import { enhancedConversationService as conversationService } from '../services/enhanced-conversation-service.js';
// Fallback: import { conversationService } from '../services/conversation-service.js';
import { ttsService } from '../services/tts-service.js';
import { ttsQueueService } from '../services/tts-queue-service.js';
import { ambientSoundPlugin } from '../plugins/ambient-sound-plugin.js';
import { playbackController } from '../services/playback-controller.js';

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
    ttsProgress: { type: Object },
    showNluDebug: { type: Boolean },
    lastNluResult: { type: Object }
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

    .nlu-debug {
      background: #f0f9ff;
      border: 2px solid #0ea5e9;
      border-radius: var(--radius);
      padding: 1rem;
      margin: 1rem 0;
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
    }

    .nlu-debug-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
      font-weight: bold;
      color: #0369a1;
    }

    .nlu-debug-toggle {
      background: #0ea5e9;
      color: white;
      border: none;
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.75rem;
    }

    .nlu-debug-content {
      display: grid;
      gap: 0.5rem;
    }

    .nlu-field {
      display: flex;
      gap: 0.5rem;
    }

    .nlu-label {
      font-weight: bold;
      color: #0369a1;
      min-width: 100px;
    }

    .nlu-value {
      color: #334155;
    }

    .nlu-value.highlight {
      background: #fef08a;
      padding: 0 4px;
      border-radius: 2px;
    }

    .nlu-nouns {
      color: #059669;
      font-weight: 500;
    }

    .nlu-scores {
      font-size: 0.75rem;
      color: #64748b;
      margin-top: 0.25rem;
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
    this.showNluDebug = true; // Show NLU debug by default for testing
    this.lastNluResult = null;

    // Bind handlers once for proper cleanup (prevents memory leak)
    this.boundVoiceInputHandler = this.handleVoiceInput.bind(this);
    this.boundVoiceInterruptHandler = this.handleVoiceInterrupt.bind(this);

    // Track pending TTS to prevent overlaps
    this.pendingTTS = null;

    // Track current request to prevent speaking outdated responses
    this.currentRequestId = 0;

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
    window.addEventListener('voice-interrupt', this.boundVoiceInterruptHandler);

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
      // Use Piper for high-quality, fast speech
      await ttsService.initialize('piper', (progress) => {
        this.ttsProgress = progress || { status: 'loading', progress: 0 };
        this.requestUpdate();
      });

      this.ttsReady = true;
      const currentVoice = ttsService.getCurrentVoice();
      console.log('🔊 TTS initialized with Piper voice:', currentVoice);
    } catch (error) {
      console.error('Failed to initialize Piper, falling back to browser TTS:', error);
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
    window.removeEventListener('voice-interrupt', this.boundVoiceInterruptHandler);

    // Use global playback controller to stop everything
    playbackController.stopAll();

    // Cancel any pending TTS
    if (this.pendingTTS) {
      clearTimeout(this.pendingTTS);
      this.pendingTTS = null;
    }

    // Clear messages to free memory
    this.messages = [];
  }

  handleVoiceInterrupt(event) {
    console.log('[CompanionChat] Voice interrupt received - using global playback controller');

    // Cancel any pending TTS that hasn't started yet
    if (this.pendingTTS) {
      clearTimeout(this.pendingTTS);
      this.pendingTTS = null;
    }

    // Use global playback controller to stop all TTS (but not ambient sound)
    // TTS has HIGH priority, ambient sound has LOW priority
    // Only stop HIGH priority sources (TTS)
    playbackController.stopByPriority(playbackController.PRIORITY.HIGH);
  }

  async handleVoiceInput(event) {
    const { transcript } = event.detail;

    if (!transcript || transcript.trim().length === 0) {
      return;
    }

    // Increment request ID to invalidate any pending responses
    this.currentRequestId++;
    const requestId = this.currentRequestId;
    console.log(`[CompanionChat] New input request #${requestId}`);

    // Cancel any pending TTS from previous input
    if (this.pendingTTS) {
      clearTimeout(this.pendingTTS);
      this.pendingTTS = null;
      console.log('[CompanionChat] Cancelled pending TTS for new input');
    }

    // Add user message
    this.addUserMessage(transcript);

    // Process and respond
    await this.processInput(transcript, requestId);
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

  addCompanionMessage(text, requestId = null) {
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

    // Speak the response using TTS (only if this is the current request)
    this.speak(text, requestId);
  }

  async processInput(input, requestId = null) {
    this.processing = true;

    try {
      // Check if request is still current before processing
      if (requestId && requestId !== this.currentRequestId) {
        console.log(`[CompanionChat] Request #${requestId} cancelled (current: #${this.currentRequestId})`);
        return;
      }

      // Use enhanced conversation service with NLU
      const result = await conversationService.generateResponse(input, this.profile);

      // Check again after async operation
      if (requestId && requestId !== this.currentRequestId) {
        console.log(`[CompanionChat] Request #${requestId} cancelled after processing (current: #${this.currentRequestId})`);
        return;
      }

      // Enhanced service returns {text, response, nlu}
      const responseText = result.text || result;

      // Check for stop intent
      if (result.nlu && result.nlu.intent === 'stop_speaking') {
        console.log('[CompanionChat] Stop intent detected - using global playback controller');

        // Use global playback controller to stop everything
        const stopResult = playbackController.stopAll();

        // Generate appropriate response
        let responseText = "Okay, I've stopped";
        if (stopResult.stopped > 0) {
          if (stopResult.sources.includes('ambient-sound')) {
            responseText += " everything";
          }
        }
        responseText += ".";

        this.addCompanionMessage(responseText, requestId);

        await logConversation(input, responseText, 'stop-intent');
        return;
      }

      // Store NLU result for debug display
      if (result.nlu) {
        this.lastNluResult = result.nlu;
        console.log('🧠 NLU Analysis:', {
          subject: result.nlu.subject,
          intent: result.nlu.intent,
          confidence: result.nlu.confidence,
          nouns: result.nlu._debug?.nouns
        });
      }

      // Add response and speak it (pass requestId to check before speaking)
      this.addCompanionMessage(responseText, requestId);

      await logConversation(input, responseText, 'nlu-enhanced');

      // Reload profile in case it was updated (e.g., location was saved)
      const updatedProfile = await getProfile();
      if (updatedProfile) {
        this.profile = updatedProfile;
        console.log('🔄 Profile reloaded after conversation');
      }
    } catch (error) {
      console.error('Failed to process input:', error);
      this.addCompanionMessage("I'm sorry, I didn't quite catch that. Could you try again?", requestId);
    } finally {
      this.processing = false;
    }
  }


  /**
   * Split text into sentences for progressive TTS
   * Reduces latency for long articles
   */
  splitIntoSentences(text) {
    // Split on .?! followed by space or end of string
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    // Clean up and filter empty sentences
    return sentences
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  async speak(text, requestId = null) {
    if (!this.ttsReady) {
      return;
    }

    // Check if this request is still current before speaking
    if (requestId && requestId !== this.currentRequestId) {
      console.log(`[CompanionChat] Skipping TTS for outdated request #${requestId} (current: #${this.currentRequestId})`);
      return;
    }

    // Split long text into sentences for progressive reading
    const sentences = this.splitIntoSentences(text);
    console.log(`[CompanionChat] Speaking ${sentences.length} sentences`);

    // Use TTSQueue for long articles (>3 sentences) to eliminate gaps
    // Use sequential method for short texts (lower latency for simple responses)
    const useTTSQueue = sentences.length > 3;

    if (useTTSQueue) {
      console.log('[CompanionChat] Using TTS Queue for seamless playback');

      try {
        await ttsQueueService.queueAndPlay(sentences, {
          onProgress: (progress) => {
            console.log(`[TTSQueue] Progress: ${progress.currentIndex + 1}/${progress.total} (${progress.synthesized} buffered)`);
          },
          onComplete: () => {
            console.log('[CompanionChat] TTS Queue playback complete');
          },
          onError: (error) => {
            console.error('[CompanionChat] TTS Queue error:', error);
          }
        });
      } catch (error) {
        // Ignore interrupted errors - they're expected
        if (error !== 'interrupted') {
          console.error('TTS Queue error:', error);
        } else {
          console.log('[CompanionChat] TTS Queue interrupted by user');
        }
      }
    } else {
      // Sequential method for short texts (original implementation)
      console.log('[CompanionChat] Using sequential TTS for short response');

      try {
        // Speak each sentence one by one
        for (let i = 0; i < sentences.length; i++) {
          // Check if request is still current before each sentence
          if (requestId && requestId !== this.currentRequestId) {
            console.log(`[CompanionChat] Stopping TTS - request #${requestId} superseded by #${this.currentRequestId}`);
            break;
          }

          const sentence = sentences[i];
          console.log(`[CompanionChat] Speaking sentence ${i + 1}/${sentences.length}: "${sentence.substring(0, 50)}..."`);

          await ttsService.speak(sentence, {
            rate: 0.9,
            pitch: 1.0,
            volume: 1.0
          });

          // Very brief pause between sentences for natural flow
          if (i < sentences.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }

        console.log('[CompanionChat] Finished speaking all sentences');
      } catch (error) {
        // Ignore interrupted errors - they're expected
        if (error !== 'interrupted') {
          console.error('Speech error:', error);
        } else {
          console.log('[CompanionChat] Speech interrupted by user');
        }
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
          <div class="tts-loading-title">🎤 Loading Voice Model...</div>
          <div class="tts-loading-subtitle">
            ${deviceIcon} ${deviceLabel} - Preparing Piper TTS
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
              🎤 Using high-quality Piper voice for natural speech
            </p>
          </div>
        </div>
      `;
    }

    return html`
      <div class="chat-container">
        ${this.showNluDebug && this.lastNluResult ? html`
          <div class="nlu-debug">
            <div class="nlu-debug-header">
              <span>🧠 NLU Analysis (Compromise)</span>
              <button class="nlu-debug-toggle" @click=${() => this.showNluDebug = false}>
                Hide
              </button>
            </div>
            <div class="nlu-debug-content">
              <div class="nlu-field">
                <span class="nlu-label">Input:</span>
                <span class="nlu-value">"${this.lastNluResult.originalInput}"</span>
              </div>
              <div class="nlu-field">
                <span class="nlu-label">Subject:</span>
                <span class="nlu-value highlight">${this.lastNluResult.subject}</span>
              </div>
              <div class="nlu-field">
                <span class="nlu-label">Intent:</span>
                <span class="nlu-value highlight">${this.lastNluResult.intent}</span>
              </div>
              <div class="nlu-field">
                <span class="nlu-label">Action:</span>
                <span class="nlu-value">${this.lastNluResult.action}</span>
              </div>
              <div class="nlu-field">
                <span class="nlu-label">Confidence:</span>
                <span class="nlu-value">${(this.lastNluResult.confidence * 100).toFixed(1)}%</span>
              </div>
              ${this.lastNluResult._debug?.nouns?.length > 0 ? html`
                <div class="nlu-field">
                  <span class="nlu-label">Nouns found:</span>
                  <span class="nlu-value nlu-nouns">[${this.lastNluResult._debug.nouns.join(', ')}]</span>
                </div>
              ` : ''}
              ${this.lastNluResult._debug?.subjects_scored ? html`
                <div class="nlu-scores">
                  Scores: ${JSON.stringify(this.lastNluResult._debug.subjects_scored, null, 0)}
                </div>
              ` : ''}
            </div>
          </div>
        ` : !this.showNluDebug ? html`
          <button class="nlu-debug-toggle" @click=${() => this.showNluDebug = true} style="margin: 1rem;">
            Show NLU Debug
          </button>
        ` : ''}

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
