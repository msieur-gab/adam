import { pipeline, env } from '@xenova/transformers';
import { db } from './db-service.js';

/**
 * LLM Service for ADAM
 * Uses Transformers.js for in-browser inference
 * Optimized for elderly care conversations
 */

// Configure Transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

class LLMService {
  constructor() {
    this.generator = null;
    this.loading = false;
    this.modelName = 'Xenova/Phi-2'; // 2.7B quantized model - good balance
    // Alternative smaller models:
    // 'Xenova/TinyLlama-1.1B-Chat-v1.0' - faster, lighter
    // 'Xenova/gpt2' - very light but lower quality
    this.initialized = false;
    this.loadingProgress = 0;
  }

  /**
   * Initialize the LLM pipeline
   * Downloads model on first run (cached afterwards)
   */
  async initialize(onProgress) {
    if (this.initialized) {
      return true;
    }

    if (this.loading) {
      // Wait for existing initialization
      while (this.loading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.initialized;
    }

    this.loading = true;

    try {
      console.log('Loading LLM model:', this.modelName);

      // Check if model is already cached
      const cached = await db.modelCache.get('llm-model');
      if (cached) {
        console.log('Model found in cache, last updated:', cached.lastUpdated);
      }

      // Initialize text generation pipeline
      this.generator = await pipeline(
        'text-generation',
        this.modelName,
        {
          quantized: true, // Use quantized version for smaller size
          progress_callback: (progress) => {
            this.loadingProgress = progress;
            if (onProgress) {
              onProgress(progress);
            }
            console.log('Model loading progress:', progress);
          }
        }
      );

      // Mark as cached
      await db.modelCache.put({
        key: 'llm-model',
        lastUpdated: new Date()
      });

      this.initialized = true;
      this.loading = false;
      console.log('LLM model initialized successfully');
      return true;

    } catch (error) {
      console.error('Failed to initialize LLM:', error);
      this.loading = false;
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Build system context from companion profile
   */
  buildSystemContext(profile) {
    if (!profile) {
      return 'You are a kind, patient companion. Keep responses warm and concise.';
    }

    const familyNames = profile.family?.map(f => f.name).join(', ') || 'none listed';
    const activities = profile.activities?.join(', ') || 'various activities';
    const medications = profile.medications?.length || 0;

    return `You are a compassionate AI companion for ${profile.name}.

Important context:
- Family members: ${familyNames}
- Enjoys: ${activities}
- Has ${medications} medication(s) scheduled
- Timezone: ${profile.habits?.timezone || 'not set'}

Your role:
- Be warm, patient, and encouraging
- Keep responses SHORT (1-2 sentences max)
- Speak clearly and simply
- Remember what they tell you
- Show genuine interest in their well-being
- If they seem confused, gently clarify

Style: Conversational, supportive, like a caring friend.`;
  }

  /**
   * Generate a response to user input
   */
  async generate(userInput, profile, conversationHistory = []) {
    if (!this.initialized) {
      throw new Error('LLM not initialized. Call initialize() first.');
    }

    try {
      // Build the prompt
      const systemContext = this.buildSystemContext(profile);

      // Include recent conversation for context (last 3 exchanges)
      const recentHistory = conversationHistory.slice(-6); // 3 exchanges = 6 messages
      const historyText = recentHistory
        .map(msg => `${msg.type === 'user' ? 'User' : 'Companion'}: ${msg.text}`)
        .join('\n');

      const prompt = `${systemContext}

${historyText ? `Recent conversation:\n${historyText}\n` : ''}
User: ${userInput}
Companion:`;

      // Generate response
      const output = await this.generator(prompt, {
        max_new_tokens: 100, // Keep responses short
        temperature: 0.7, // Balanced creativity
        top_k: 50,
        top_p: 0.9,
        do_sample: true,
        repetition_penalty: 1.2,
        pad_token_id: 50256, // For GPT-2 based models
      });

      // Extract the generated text
      let response = output[0].generated_text;

      // Remove the prompt from the response
      response = response.replace(prompt, '').trim();

      // Clean up response (remove any "User:" or "Companion:" that might appear)
      response = response.split(/User:|Companion:/)[0].trim();

      // Limit to first 2-3 sentences for elderly users
      const sentences = response.match(/[^.!?]+[.!?]+/g) || [response];
      response = sentences.slice(0, 2).join(' ').trim();

      return response;

    } catch (error) {
      console.error('LLM generation failed:', error);
      throw error;
    }
  }

  /**
   * Check if model is ready
   */
  isReady() {
    return this.initialized && !this.loading;
  }

  /**
   * Get loading status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      loading: this.loading,
      progress: this.loadingProgress
    };
  }

  /**
   * Switch to a different model
   */
  async switchModel(modelName) {
    this.modelName = modelName;
    this.initialized = false;
    this.generator = null;
    await this.initialize();
  }

  /**
   * Get available models
   */
  getAvailableModels() {
    return [
      {
        name: 'Xenova/Phi-2',
        size: '~1.5GB',
        description: 'Balanced - Good quality, moderate speed',
        recommended: true
      },
      {
        name: 'Xenova/TinyLlama-1.1B-Chat-v1.0',
        size: '~600MB',
        description: 'Fast - Lower quality but very responsive'
      },
      {
        name: 'Xenova/gpt2',
        size: '~500MB',
        description: 'Lightest - Basic conversations only'
      }
    ];
  }
}

// Singleton instance
export const llmService = new LLMService();
