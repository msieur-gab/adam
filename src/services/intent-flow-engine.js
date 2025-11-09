/**
 * Intent Flow Engine
 * Orchestrates declarative intent flows with Dialogflow-style architecture
 *
 * Features:
 * - Multi-signal intent scoring using declarative rules
 * - Context-aware follow-up detection
 * - Confidence-based routing
 * - Automatic parameter extraction
 * - Output context management
 * - Zero ML dependencies
 */

import { ConversationContext } from './conversation-context.js';
import { EnhancedNLUService } from './enhanced-nlu-service.js';

export class IntentFlowEngine {
  constructor() {
    // Services
    this.context = new ConversationContext();
    this.nluService = new EnhancedNLUService();

    // Registered intent flows from plugins
    // Map<intentName, { plugin, flow }>
    this.intentFlows = new Map();

    // Confidence thresholds
    this.thresholds = {
      HIGH: 0.7,      // Execute immediately
      MEDIUM: 0.45,   // Execute with hedging
      AMBIGUOUS: 0.15 // Difference threshold for ambiguity detection
    };

    // Pending parameter collection state
    // When waiting for user to provide missing parameter
    this.pendingCollection = null;
  }

  /**
   * Register a plugin's intent flows
   * @param {Object} plugin - Plugin instance
   */
  registerPlugin(plugin) {
    if (!plugin.getIntentFlows) {
      console.warn(`[IntentFlowEngine] Plugin ${plugin.id} doesn't have getIntentFlows() method`);
      return;
    }

    const flows = plugin.getIntentFlows();

    for (const [intentName, flow] of Object.entries(flows)) {
      // Validate flow structure
      if (!this.validateFlow(intentName, flow)) {
        console.error(`[IntentFlowEngine] Invalid flow definition for ${intentName}`);
        continue;
      }

      this.intentFlows.set(intentName, {
        plugin,
        flow
      });

      console.log(`[IntentFlowEngine] Registered intent: ${intentName} from plugin ${plugin.id}`);
    }
  }

  /**
   * Validate intent flow structure
   * @private
   */
  validateFlow(intentName, flow) {
    if (!flow.scoringRules || !flow.scoringRules.required) {
      console.error(`[IntentFlowEngine] ${intentName}: Missing scoringRules.required`);
      return false;
    }

    if (!flow.fulfill || typeof flow.fulfill !== 'function') {
      console.error(`[IntentFlowEngine] ${intentName}: Missing or invalid fulfill function`);
      return false;
    }

    if (!flow.parameters) {
      console.warn(`[IntentFlowEngine] ${intentName}: No parameters defined`);
    }

    return true;
  }

  /**
   * Main execution entry point
   * @param {string} userInput - User's input text
   * @returns {Object} Execution result
   */
  async execute(userInput) {
    console.log(`[IntentFlowEngine] Processing: "${userInput}"`);

    // 1. Extract linguistic signals
    const signals = await this.nluService.analyze(userInput, this.context);

    // 2. Check if we're collecting a missing parameter
    if (this.pendingCollection) {
      return await this.handleParameterCollection(userInput, signals);
    }

    // 3. Score all registered intents
    const scoredIntents = this.scoreAllIntents(signals);

    // 4. Check for follow-up modifiers (uses context)
    const followUp = this.checkFollowUps(userInput, signals);

    // 5. Decide: Follow-up or Primary Intent?
    // Follow-ups should only be used when they're more confident than primary intent
    // OR when the query is clearly a modification (short, lacks primary signals)
    if (followUp) {
      const bestPrimaryIntent = scoredIntents[0];

      // If there's a strong primary intent match, prefer it over follow-up
      if (bestPrimaryIntent && bestPrimaryIntent.confidence >= this.thresholds.HIGH) {
        console.log(`[IntentFlowEngine] Primary intent (${bestPrimaryIntent.confidence.toFixed(2)}) stronger than follow-up - using primary`);
        // Continue with primary intent
      } else if (followUp.confidence > (bestPrimaryIntent?.confidence || 0)) {
        // Follow-up is more confident
        return await this.executeFollowUp(followUp, userInput, signals);
      } else {
        console.log(`[IntentFlowEngine] Follow-up detected but primary intent stronger - using primary`);
      }
    }

    // 6. Handle primary intent scoring
    if (scoredIntents.length === 0) {
      console.log('[IntentFlowEngine] No intents matched');
      return this.fallback(userInput, signals);
    }

    const bestIntent = scoredIntents[0];
    const secondBest = scoredIntents[1];

    console.log('[IntentFlowEngine] Top intents:', {
      best: { intent: bestIntent.intent, confidence: bestIntent.confidence },
      second: secondBest ? { intent: secondBest.intent, confidence: secondBest.confidence } : null
    });

    // 7. Route based on confidence
    return await this.routeByConfidence(bestIntent, secondBest, userInput, signals);
  }

  /**
   * Check if input is a follow-up to previous intent
   * @private
   */
  checkFollowUps(userInput, signals) {
    const activeContexts = this.context.getActive();

    if (activeContexts.length === 0) {
      return null; // No active contexts, can't be a follow-up
    }

    let bestFollowUp = null;
    let bestConfidence = 0;

    // Check each active context for matching follow-up handlers
    for (const contextName of activeContexts) {
      for (const [intentName, { flow }] of this.intentFlows) {
        if (!flow.followUps) continue;

        for (const [followUpName, followUpDef] of Object.entries(flow.followUps)) {
          // Check if this follow-up requires the active context
          if (followUpDef.requiresContext !== contextName) continue;

          // Calculate follow-up confidence
          const confidence = this.scoreFollowUp(
            userInput,
            signals,
            followUpDef,
            flow
          );

          if (confidence > bestConfidence) {
            bestConfidence = confidence;
            bestFollowUp = {
              originalIntent: intentName,
              followUpName,
              followUpDef,
              contextData: this.context.get(contextName),
              confidence
            };
          }
        }
      }
    }

    if (bestFollowUp) {
      console.log(`[IntentFlowEngine] Detected follow-up: ${bestFollowUp.followUpName} (confidence: ${bestConfidence.toFixed(2)})`);
    }

    return bestFollowUp;
  }

  /**
   * Score a follow-up query
   * Follow-ups should be short modifications that lack the primary intent's required signals
   * @private
   */
  scoreFollowUp(userInput, signals, followUpDef, parentFlow) {
    let score = 0;

    // Check if input matches triggers
    const matchesTrigger = this.matchesFollowUpTriggers(
      userInput,
      signals,
      followUpDef.triggers
    );

    if (!matchesTrigger) {
      return 0; // No trigger match
    }

    // Base score for trigger match
    score = 0.4;

    // Boost for short queries (follow-ups are typically brief)
    const wordCount = signals.wordCount;
    if (wordCount <= 3) {
      score += 0.3; // "And tomorrow?" = very likely follow-up
    } else if (wordCount <= 5) {
      score += 0.15; // "What about Paris?" = likely follow-up
    }

    // Penalty for having primary intent's required signals
    // If the query has all the signals for a fresh primary intent, it's probably not a follow-up
    if (parentFlow.scoringRules?.required) {
      const hasRequiredSignals = parentFlow.scoringRules.required.some(rule =>
        this.matchesRule(rule, signals)
      );

      if (hasRequiredSignals) {
        score -= 0.3; // "What's the weather in Paris?" has "weather" noun = probably primary intent
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Check if input matches follow-up triggers
   * @private
   */
  matchesFollowUpTriggers(userInput, signals, triggers) {
    const normalized = userInput.toLowerCase();

    for (const trigger of triggers) {
      // Check in verbs
      if (signals.verbs.includes(trigger.toLowerCase())) {
        return true;
      }

      // Check in nouns
      if (signals.nouns.includes(trigger.toLowerCase())) {
        return true;
      }

      // Check in raw text
      if (normalized.includes(trigger.toLowerCase())) {
        return true;
      }

      // Check in dates (for temporal modifiers)
      if (signals.dates.some(d => d.normalized.includes(trigger.toLowerCase()))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Execute follow-up intent
   * @private
   */
  async executeFollowUp(followUpInfo, userInput, signals) {
    const { originalIntent, followUpName, followUpDef, contextData } = followUpInfo;

    console.log(`[IntentFlowEngine] Executing follow-up: ${followUpName}`);

    // Get the target intent to reuse
    const targetIntentName = followUpDef.reuseIntent || originalIntent;
    const targetFlow = this.intentFlows.get(targetIntentName);

    if (!targetFlow) {
      console.error(`[IntentFlowEngine] Target intent not found: ${targetIntentName}`);
      return this.fallback(userInput, signals);
    }

    // Modify parameters using context + new signals
    let modifiedParams;

    if (followUpDef.modifyParams) {
      modifiedParams = followUpDef.modifyParams(contextData, signals);
    } else if (followUpDef.autoFillParams) {
      modifiedParams = followUpDef.autoFillParams(contextData);
    } else {
      console.error(`[IntentFlowEngine] Follow-up ${followUpName} has no param modification function`);
      return this.fallback(userInput, signals);
    }

    // Execute the target intent with modified params
    const result = await this.fulfillIntent({
      intent: targetIntentName,
      confidence: 1.0, // Follow-ups are high confidence
      plugin: targetFlow.plugin,
      flow: targetFlow.flow,
      extractedParams: modifiedParams,
      isFollowUp: true
    }, userInput, signals);

    return result;
  }

  /**
   * Score all registered intents using their declarative rules
   * @private
   */
  scoreAllIntents(signals) {
    const scores = [];

    for (const [intentName, { plugin, flow }] of this.intentFlows) {
      const score = this.scoreIntent(flow, signals);

      if (score > 0) {
        scores.push({
          intent: intentName,
          confidence: score,
          plugin,
          flow,
          extractedParams: null // Will be extracted during fulfillment
        });
      }
    }

    // Sort by confidence (highest first)
    return scores.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Score single intent using declarative rules
   * @private
   */
  scoreIntent(flow, signals) {
    const rules = flow.scoringRules;
    let score = 0;

    // Check required patterns (at least ONE must match)
    const hasRequired = rules.required.some(rule => {
      return this.matchesRule(rule, signals);
    });

    if (!hasRequired) {
      return 0; // Intent doesn't match at all
    }

    // Base score for matching required pattern
    score = 0.5;

    // Apply boosters
    if (rules.boosters) {
      for (const booster of rules.boosters) {
        if (this.matchesBooster(booster, signals)) {
          score += booster.boost;
        }
      }
    }

    // Apply penalties (anti-patterns)
    if (rules.antiPatterns) {
      for (const antiPattern of rules.antiPatterns) {
        if (this.matchesRule(antiPattern, signals)) {
          score += antiPattern.penalty; // Penalty is negative
        }
      }
    }

    // Clamp score to [0, 1]
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Check if a rule matches the signals
   * @private
   */
  matchesRule(rule, signals) {
    // Check noun matching
    if (rule.nouns && rule.nouns.length > 0) {
      const hasNoun = rule.nouns.some(n =>
        signals.nouns.includes(n.toLowerCase())
      );
      if (hasNoun) return true;
    }

    // Check verb matching
    if (rule.verbs && rule.verbs.length > 0) {
      const hasVerb = rule.verbs.some(v =>
        signals.verbs.includes(v.toLowerCase())
      );
      if (hasVerb) return true;
    }

    // Check adjective matching
    if (rule.adjectives && rule.adjectives.length > 0) {
      const hasAdj = rule.adjectives.some(a =>
        signals.adjectives.includes(a.toLowerCase())
      );
      if (hasAdj) return true;
    }

    return false;
  }

  /**
   * Check if a booster matches the signals
   * @private
   */
  matchesBooster(booster, signals) {
    if (booster.hasDate && signals.dates.length > 0) return true;
    if (booster.hasTime && signals.times.length > 0) return true;
    if (booster.hasPlace && signals.places.length > 0) return true;
    if (booster.hasPerson && signals.people.length > 0) return true;
    if (booster.hasNumber && signals.numbers.length > 0) return true;
    if (booster.isQuestion && signals.isQuestion) return true;
    if (booster.isCommand && signals.isCommand) return true;
    if (booster.hasNegation && signals.hasNegation) return true;
    if (booster.hasFuture && signals.hasFuture) return true;
    if (booster.hasPast && signals.hasPast) return true;

    // Check for active context
    if (booster.hasContext && signals.activeContexts.includes(booster.hasContext)) {
      return true;
    }

    return false;
  }

  /**
   * Route intent based on confidence thresholds
   * @private
   */
  async routeByConfidence(bestIntent, secondBest, userInput, signals) {
    if (!bestIntent) {
      return this.fallback(userInput, signals);
    }

    // HIGH confidence: Execute immediately
    if (bestIntent.confidence >= this.thresholds.HIGH) {
      console.log(`[IntentFlowEngine] HIGH confidence (${bestIntent.confidence.toFixed(2)}) - executing`);
      return await this.fulfillIntent(bestIntent, userInput, signals);
    }

    // AMBIGUOUS: Two intents close in score
    if (secondBest && (bestIntent.confidence - secondBest.confidence) < this.thresholds.AMBIGUOUS) {
      console.log('[IntentFlowEngine] AMBIGUOUS - disambiguating');
      return this.disambiguate([bestIntent, secondBest]);
    }

    // MEDIUM confidence: Hedge and execute
    if (bestIntent.confidence >= this.thresholds.MEDIUM) {
      console.log(`[IntentFlowEngine] MEDIUM confidence (${bestIntent.confidence.toFixed(2)}) - hedging`);
      const result = await this.fulfillIntent(bestIntent, userInput, signals);
      result.hedged = true;
      result.text = `I think you're asking about this. ${result.text}`;
      return result;
    }

    // LOW confidence: Fallback
    console.log(`[IntentFlowEngine] LOW confidence (${bestIntent.confidence.toFixed(2)}) - fallback`);
    return this.fallback(userInput, signals);
  }

  /**
   * Fulfill an intent (extract params, execute, set context)
   * @private
   */
  async fulfillIntent(intent, userInput, signals) {
    const { flow, plugin } = intent;

    console.log(`[IntentFlowEngine] Fulfilling intent: ${intent.intent}`);

    // Extract parameters (if not already provided by follow-up)
    if (!intent.extractedParams) {
      intent.extractedParams = this.extractParameters(flow.parameters || {}, signals);
    }

    // Check for missing required parameters
    const missingParam = this.findMissingRequiredParam(flow.parameters || {}, intent.extractedParams);

    if (missingParam) {
      return this.promptForParameter(intent, flow, missingParam, userInput);
    }

    // Execute fulfillment
    const result = await flow.fulfill(intent.extractedParams);

    // Set output contexts
    if (flow.outputContexts) {
      for (const contextDef of flow.outputContexts) {
        this.context.set(
          contextDef.name,
          contextDef.parameters(result, intent.extractedParams),
          contextDef.lifespan
        );
      }
    }

    // Track conversation turn
    this.context.addTurn(userInput, intent, result);

    return result;
  }

  /**
   * Extract parameters from signals using flow definition
   * @private
   */
  extractParameters(paramDefs, signals) {
    const extracted = {};

    for (const [paramName, paramDef] of Object.entries(paramDefs)) {
      // Use custom extractor if provided
      if (paramDef.extractor) {
        extracted[paramName] = paramDef.extractor(signals);
        continue;
      }

      // Standard extraction by entity type
      switch (paramDef.entity) {
        case 'date':
          extracted[paramName] = signals.dates[0] || paramDef.default;
          break;

        case 'time':
          extracted[paramName] = signals.times[0] || paramDef.default;
          break;

        case 'place':
        case 'location':
          extracted[paramName] = signals.places[0] || paramDef.default;
          break;

        case 'person':
          extracted[paramName] = signals.people[0] || paramDef.default;
          break;

        case 'number':
          extracted[paramName] = signals.numbers[0]?.value || paramDef.default;
          break;

        case 'any':
          // Extract remaining text (remove entities and focus words)
          extracted[paramName] = this.extractRemainingText(signals) || paramDef.default;
          break;

        default:
          // Apply default if specified
          extracted[paramName] = paramDef.default;
      }

      // Handle default as function
      if (typeof extracted[paramName] === 'function') {
        extracted[paramName] = extracted[paramName]();
      }
    }

    return extracted;
  }

  /**
   * Extract remaining text after removing detected entities
   * @private
   */
  extractRemainingText(signals) {
    // This is a simplified version
    // In production, you'd strip out detected entities
    return signals.normalizedText;
  }

  /**
   * Find first missing required parameter
   * @private
   */
  findMissingRequiredParam(paramDefs, extractedParams) {
    for (const [paramName, paramDef] of Object.entries(paramDefs)) {
      if (paramDef.required && !extractedParams[paramName]) {
        return paramName;
      }
    }
    return null;
  }

  /**
   * Prompt user for missing parameter
   * @private
   */
  promptForParameter(intent, flow, paramName, userInput) {
    const paramDef = flow.parameters[paramName];

    // Set pending collection state
    this.pendingCollection = {
      intent,
      flow,
      collectedParams: intent.extractedParams,
      awaitingParam: paramName,
      originalInput: userInput
    };

    // Get prompt text
    const promptText = paramDef.prompt || `What ${paramName}?`;

    // Set input context if defined in parameterFlow
    const paramFlow = flow.parameterFlow?.[`onMissing${paramName.charAt(0).toUpperCase() + paramName.slice(1)}`];
    if (paramFlow?.inputContext) {
      this.context.set(
        paramFlow.inputContext,
        this.pendingCollection,
        paramFlow.lifespan || 1
      );
    }

    console.log(`[IntentFlowEngine] Prompting for parameter: ${paramName}`);

    return {
      text: promptText,
      awaitingInput: paramName,
      requiresUserInput: true
    };
  }

  /**
   * Handle parameter collection (when user responds to prompt)
   * @private
   */
  async handleParameterCollection(userInput, signals) {
    const { intent, flow, collectedParams, awaitingParam } = this.pendingCollection;

    console.log(`[IntentFlowEngine] Collecting parameter: ${awaitingParam}`);

    // Extract the missing parameter from user's response
    const paramDef = flow.parameters[awaitingParam];
    const paramValue = this.extractParameters({ [awaitingParam]: paramDef }, signals)[awaitingParam];

    // Validate the parameter if validator is defined
    if (paramDef.validator) {
      const validation = paramDef.validator(paramValue);
      if (!validation.valid) {
        // Validation failed - re-prompt with error message
        console.log(`[IntentFlowEngine] Validation failed for ${awaitingParam}: ${validation.error}`);

        return {
          text: validation.error,
          awaitingInput: awaitingParam,
          requiresUserInput: true,
          isFollowUp: true,
          metadata: {
            validationError: true,
            parameter: awaitingParam
          }
        };
      }
    }

    // Add to collected params
    collectedParams[awaitingParam] = paramValue;

    // Clear pending collection
    this.pendingCollection = null;

    // Check if there are more missing params
    const nextMissing = this.findMissingRequiredParam(flow.parameters, collectedParams);

    if (nextMissing) {
      // Still missing params, prompt for next one
      return this.promptForParameter(
        { ...intent, extractedParams: collectedParams },
        flow,
        nextMissing,
        userInput
      );
    }

    // All params collected, fulfill the intent
    return await this.fulfillIntent(
      { ...intent, extractedParams: collectedParams },
      userInput,
      signals
    );
  }

  /**
   * Handle ambiguous intents (two intents with similar scores)
   * @private
   */
  disambiguate(intents) {
    return {
      type: 'disambiguation',
      text: 'Did you want to:',
      choices: intents.map(i => ({
        label: `Check ${i.intent.replace('_', ' ')}`,
        intent: i.intent,
        confidence: i.confidence
      })),
      requiresUserInput: true
    };
  }

  /**
   * Fallback when no intent matches
   * @private
   */
  fallback(userInput, signals) {
    console.log('[IntentFlowEngine] Fallback response');

    // Smart fallback based on what we understood
    if (signals.isQuestion) {
      return {
        text: "I'm not sure how to answer that question. Could you rephrase it?",
        fallback: true
      };
    }

    return {
      text: "I'm not sure how to help with that. You can ask me about weather, time, or set reminders.",
      fallback: true
    };
  }

  /**
   * Get all registered intents
   * @returns {Array} Array of intent names
   */
  getRegisteredIntents() {
    return Array.from(this.intentFlows.keys());
  }

  /**
   * Get debug information
   * @returns {Object} Debug info
   */
  getDebugInfo() {
    return {
      registeredIntents: this.getRegisteredIntents(),
      intentCount: this.intentFlows.size,
      thresholds: this.thresholds,
      contextInfo: this.context.getDebugInfo(),
      pendingCollection: this.pendingCollection ? {
        intent: this.pendingCollection.intent.intent,
        awaitingParam: this.pendingCollection.awaitingParam
      } : null
    };
  }

  /**
   * Reset engine state
   */
  reset() {
    this.context.reset();
    this.pendingCollection = null;
    console.log('[IntentFlowEngine] Reset complete');
  }
}

// Export singleton instance
export const intentFlowEngine = new IntentFlowEngine();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.intentFlowEngine = intentFlowEngine;

  window.debugIntents = () => {
    console.log('[Intent Flow Engine]', intentFlowEngine.getDebugInfo());
  };

  window.testIntent = async (text) => {
    const result = await intentFlowEngine.execute(text);
    console.log('[Test Result]', result);
    return result;
  };

  console.log('🎯 IntentFlowEngine Debug Commands:');
  console.log('  debugIntents()           - Show engine state');
  console.log('  testIntent("your text")  - Test intent matching');
}
