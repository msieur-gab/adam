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
// Optional: Use custom remote URL for models
// env.remoteURL = 'http://localhost:8080/models/'; // Serve models locally
// env.remotePathTemplate = '{model}/'; // Model directory structure

class LLMService {
  constructor() {
    this.generator = null;
    this.loading = false;
    // Using SmolLM2 - Most popular transformers.js model, instruction-tuned
    this.modelName = 'HuggingFaceTB/SmolLM2-360M-Instruct'; // ~400MB, top downloads
    // Alternative models (all verified working with transformers.js):
    // 'HuggingFaceTB/SmolLM2-135M-Instruct' - 135MB, faster but lower quality
    // 'HuggingFaceTB/SmolLM2-1.7B-Instruct' - 1.7GB, better quality
    // 'Xenova/gpt2' - 500MB, classic but not instruction-tuned
    this.initialized = false;
    this.loadingProgress = 0;

    // Track individual file progress
    this.fileProgress = new Map();
    this.totalFiles = 0;
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
            // Calculate overall progress from individual file progress
            const overallProgress = this.calculateOverallProgress(progress);

            if (onProgress) {
              onProgress(overallProgress);
            }
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
- Never ask multiple questions at once
- Use simple, natural language

Style: Conversational, supportive, like a caring friend. Always respond in complete sentences.`;
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

      // Include recent conversation for context (last 2 exchanges only to avoid buffer issues)
      const recentHistory = conversationHistory.slice(-4); // 2 exchanges = 4 messages
      const historyText = recentHistory
        .map(msg => `${msg.type === 'user' ? 'User' : 'Companion'}: ${msg.text}`)
        .join('\n');

      // Simple, clean prompt format that works with Phi-2 and most models
      const prompt = `${systemContext}

${historyText ? `Recent conversation:\n${historyText}\n\n` : ''}User: ${userInput}
Companion:`;

      console.log('📝 Prompt length:', prompt.length, 'chars');

      // Generate response
      const output = await this.generator(prompt, {
        max_new_tokens: 120, // Reduced to avoid buffer overflow
        temperature: 0.85, // Higher creativity for more natural conversation
        top_k: 50,
        top_p: 0.95,
        do_sample: true,
        repetition_penalty: 1.2,
        pad_token_id: 50256, // Standard GPT-2 tokenizer pad token
      });

      // Extract the generated text
      let response = output[0].generated_text;

      // Remove the prompt from the response
      response = response.replace(prompt, '').trim();

      // Clean up response - stop at conversation markers or special tokens
      response = response.split(/\n(User:|Companion:)/)[0].trim();
      response = response.split(/<\||\<\/s\>|<\|user\||<\|system\|/)[0].trim();

      // Let the model express itself naturally (no hard sentence limit)
      // Only clean up if response is completely empty
      if (!response || response.trim().length === 0) {
        console.warn('⚠️ Empty response from LLM');
        return "I'm here for you. What would you like to talk about?";
      }

      console.log('✅ Generated response:', response.substring(0, 100) + '...');
      return response;

    } catch (error) {
      console.error('LLM generation failed:', error);
      throw error;
    }
  }

  /**
   * Calculate overall progress from individual file progress
   */
  calculateOverallProgress(progress) {
    if (!progress) return { progress: 0, status: 'initializing', file: '' };

    const { status, file, loaded, total } = progress;

    // Track this file's progress
    if (file && total) {
      this.fileProgress.set(file, { loaded, total });
    }

    // Count unique files
    const uniqueFiles = new Set(
      Array.from(this.fileProgress.keys()).map(f => f.split('/').pop())
    );

    // Calculate overall progress
    let totalLoaded = 0;
    let totalSize = 0;

    this.fileProgress.forEach(({ loaded, total }) => {
      totalLoaded += loaded || 0;
      totalSize += total || 0;
    });

    // Calculate percentage (0-1)
    const percentage = totalSize > 0 ? totalLoaded / totalSize : 0;

    // Friendly status messages
    let statusMessage = status || 'loading';
    if (status === 'progress') {
      statusMessage = 'downloading';
    } else if (status === 'done') {
      statusMessage = 'complete';
    } else if (status === 'initiate') {
      statusMessage = 'initializing';
    }

    const currentFile = file ? file.split('/').pop() : '';

    const result = {
      progress: percentage,
      status: statusMessage,
      file: currentFile,
      loaded: this.formatBytes(totalLoaded),
      total: this.formatBytes(totalSize),
      filesLoaded: this.fileProgress.size,
      percentage: Math.round(percentage * 100)
    };

    console.log(`📥 Loading: ${result.percentage}% (${result.loaded}/${result.total}) - ${currentFile}`);

    return result;
  }

  /**
   * Format bytes to human-readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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
