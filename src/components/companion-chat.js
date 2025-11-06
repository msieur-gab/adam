import { LitElement, html, css } from 'lit';
import { logConversation, getRecentConversations } from '../services/db-service.js';

/**
 * Companion Chat Component
 * Main conversational interface
 * Handles both rule-based and LLM responses
 */
class CompanionChat extends LitElement {
  static properties = {
    profile: { type: Object },
    messages: { type: Array },
    processing: { type: Boolean }
  };

  static styles = css`
    :host {
      display: block;
      margin-bottom: 140px;
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
      max-height: 60vh;
      overflow-y: auto;
      padding: var(--spacing);
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
  `;

  constructor() {
    super();
    this.profile = null;
    this.messages = [];
    this.processing = false;
    this.ttsSupported = 'speechSynthesis' in window;
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
    window.addEventListener('voice-input', this.handleVoiceInput.bind(this));

    // Send welcome message if first time
    if (this.messages.length === 0 && this.profile) {
      this.addCompanionMessage(`Hello ${this.profile.name}! How can I help you today?`);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('voice-input', this.handleVoiceInput.bind(this));
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
  }

  addCompanionMessage(text) {
    this.messages = [
      ...this.messages,
      { text, type: 'companion', timestamp: new Date() }
    ];

    // Speak the response using TTS
    this.speak(text);
  }

  async processInput(input) {
    this.processing = true;

    try {
      // Check for rule-based patterns first
      const ruleResponse = this.checkRuleBasedResponse(input);

      if (ruleResponse) {
        this.addCompanionMessage(ruleResponse);
        await logConversation(input, ruleResponse, 'rule-based');
      } else {
        // Fall back to conversational response
        // TODO: Integrate Transformers.js LLM
        const response = await this.generateResponse(input);
        this.addCompanionMessage(response);
        await logConversation(input, response, 'llm');
      }
    } catch (error) {
      console.error('Failed to process input:', error);
      this.addCompanionMessage("I'm sorry, I didn't quite catch that. Could you try again?");
    } finally {
      this.processing = false;
    }
  }

  checkRuleBasedResponse(input) {
    const lowerInput = input.toLowerCase();

    // Medication queries
    if (lowerInput.includes('medication') || lowerInput.includes('medicine') || lowerInput.includes('pills')) {
      const meds = this.profile?.medications || [];
      if (meds.length === 0) {
        return "You don't have any medications scheduled right now.";
      }

      const medList = meds.map(m => `${m.name} - ${m.dosage} at ${m.time}`).join(', ');
      return `Your medications are: ${medList}`;
    }

    // Family queries
    if (lowerInput.includes('family') || lowerInput.includes('daughter') || lowerInput.includes('son')) {
      const family = this.profile?.family || [];
      if (family.length === 0) {
        return "I don't have family information stored yet.";
      }

      const familyList = family.map(f => `${f.name} (${f.relation})`).join(', ');
      return `Your family: ${familyList}`;
    }

    // Doctor queries
    if (lowerInput.includes('doctor') || lowerInput.includes('appointment')) {
      const doctors = this.profile?.doctors || [];
      if (doctors.length === 0) {
        return "I don't have doctor information stored yet.";
      }

      const doctorInfo = doctors.map(d => `${d.name} - ${d.specialty}: ${d.phone}`).join('. ');
      return `Your doctors: ${doctorInfo}`;
    }

    // Hydration reminder
    if (lowerInput.includes('water') || lowerInput.includes('drink') || lowerInput.includes('hydrat')) {
      return "It's important to stay hydrated! Would you like me to remind you to drink water regularly?";
    }

    // No rule matched
    return null;
  }

  async generateResponse(input) {
    // Placeholder for LLM integration
    // TODO: Integrate Transformers.js with a small model
    // For now, return context-aware fallback

    const responses = [
      `I understand you said "${input}". How can I help you with that?`,
      "I'm here to help! Could you tell me more?",
      `That's interesting. I'm learning more about you every day, ${this.profile?.name}.`
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  speak(text) {
    if (!this.ttsSupported) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Slightly slower for elderly users
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Try to use a clear, natural voice
    const voices = speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice =>
      voice.lang.startsWith('en') && voice.name.includes('Natural')
    ) || voices[0];

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    speechSynthesis.speak(utterance);
  }

  formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  render() {
    if (this.messages.length === 0 && !this.processing) {
      return html`
        <div class="chat-container">
          <div class="welcome">
            <p>👋 Welcome! Tap the microphone below to start talking.</p>
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
