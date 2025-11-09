# Dialogflow-Style Intent Architecture for ADAM

## Overview

This document outlines ADAM's Dialogflow-inspired conversational AI architecture. The system uses **declarative intent flows** with **context management** to enable natural multi-turn conversations, all powered by Compromise.js without requiring heavy ML models.

## Design Philosophy

### Core Principles

1. **Declarative over Imperative** - Intent flows are data structures, not code
2. **Mobile-First Performance** - Zero ML dependencies, pure JavaScript
3. **Context-Aware** - Natural follow-up conversations using context lifespan
4. **Plugin-Owned Logic** - Each plugin defines its own scoring rules and fulfillment
5. **Dialogflow-Compatible** - Same mental model as Google's Dialogflow

### Why This Architecture?

**Current Problem:**
- Low confidence scores for valid queries ("weather next week" = 33%)
- No support for follow-up queries ("And tomorrow?")
- Fragmented intent detection logic
- Hard-coded response generation
- No conversation memory

**Solution:**
- Multi-signal intent scoring using all Compromise.js features
- Context-based follow-up intent routing
- Declarative plugin intent definitions
- Plugin-owned response generation
- Conversation context with automatic lifespan management

---

## Architecture Components

### 1. Intent Flow Definition (Plugin-Owned)

Each plugin defines its intents as declarative data structures:

```javascript
class WeatherPlugin extends BasePlugin {
  getIntentFlows() {
    return {
      weather_query: {
        // Scoring rules for intent matching
        scoringRules: {
          required: [
            { nouns: ['weather', 'forecast', 'temperature'] },
            { verbs: ['rain', 'snow'] },
            { adjectives: ['sunny', 'cloudy', 'rainy'] }
          ],
          boosters: [
            { hasDate: true, boost: 0.3 },
            { hasPlace: true, boost: 0.2 },
            { isQuestion: true, boost: 0.1 },
            { hasContext: 'weather-followup', boost: 0.4 }
          ],
          antiPatterns: [
            { nouns: ['reminder', 'alarm'], penalty: -0.5 }
          ]
        },

        // Required/optional parameters
        parameters: {
          location: {
            entity: 'place',
            required: false,
            default: () => userPreferences.location,
            prompt: 'Which location?'
          },
          timeframe: {
            entity: 'date',
            required: false,
            default: 'today',
            extractor: (signals) => signals.dates[0] || 'today'
          }
        },

        // Fulfillment function
        fulfill: async (params) => {
          const forecast = await this.fetchWeather(params.location, params.timeframe);
          return {
            text: `The weather in ${params.location} ${params.timeframe} will be ${forecast.description}, ${forecast.temp}°F`,
            data: { forecast, location: params.location, timeframe: params.timeframe }
          };
        },

        // Output contexts (Dialogflow-style)
        outputContexts: [
          {
            name: 'weather-followup',
            lifespan: 2,
            parameters: (result, params) => ({
              lastLocation: params.location,
              lastTimeframe: params.timeframe,
              lastForecast: result.data.forecast
            })
          }
        ],

        // Follow-up intent handlers
        followUps: {
          temporal_modifier: {
            triggers: ['tomorrow', 'next week', 'next month'],
            requiresContext: 'weather-followup',
            modifyParams: (contextData, signals) => ({
              location: contextData.lastLocation,
              timeframe: signals.dates[0] || 'tomorrow'
            }),
            reuseIntent: 'weather_query'
          },

          location_modifier: {
            triggers: ['in', 'at', 'for'],
            requiresContext: 'weather-followup',
            modifyParams: (contextData, signals) => ({
              location: signals.places[0],
              timeframe: contextData.lastTimeframe
            }),
            reuseIntent: 'weather_query'
          }
        }
      }
    };
  }
}
```

---

### 2. Conversation Context Manager

Manages conversation state and context lifespan (Dialogflow-style):

```javascript
class ConversationContext {
  constructor() {
    this.contexts = new Map();  // Active contexts
    this.turnHistory = [];       // Last 10 conversation turns
  }

  // Set context with lifespan
  set(name, data, lifespan = 2) {
    this.contexts.set(name, {
      data,
      lifespan,
      createdAt: Date.now()
    });
  }

  // Get active context data
  get(name) {
    const ctx = this.contexts.get(name);
    return ctx?.lifespan > 0 ? ctx.data : null;
  }

  // Get all active context names
  getActive() {
    return Array.from(this.contexts.entries())
      .filter(([_, ctx]) => ctx.lifespan > 0)
      .map(([name]) => name);
  }

  // Track conversation turn and decrement lifespans
  addTurn(userInput, intent, response) {
    this.turnHistory.push({
      user: userInput,
      intent,
      response,
      timestamp: Date.now()
    });

    // Keep last 10 turns only
    if (this.turnHistory.length > 10) {
      this.turnHistory.shift();
    }

    // Decrement all context lifespans
    for (const [name, ctx] of this.contexts.entries()) {
      ctx.lifespan--;
      if (ctx.lifespan <= 0) {
        this.contexts.delete(name);
      }
    }
  }

  // Get last mentioned entity (for pronoun resolution)
  getLastMentioned(entityType) {
    for (let i = this.turnHistory.length - 1; i >= 0; i--) {
      const turn = this.turnHistory[i];
      if (turn.intent?.extractedParams?.[entityType]) {
        return turn.intent.extractedParams[entityType];
      }
    }
    return null;
  }
}
```

---

### 3. Enhanced NLU Service (Multi-Signal Analysis)

Extracts all available signals from Compromise.js:

```javascript
class EnhancedNLUService {
  async analyzeIntent(text, context) {
    const doc = nlp(text);

    // Extract ALL linguistic signals
    const signals = {
      // Core POS tags
      nouns: doc.nouns().out('array'),
      verbs: doc.verbs().out('array'),
      adjectives: doc.adjectives().out('array'),

      // Named entities
      dates: doc.dates().json(),
      times: doc.times().json(),
      people: doc.people().out('array'),
      places: doc.places().out('array'),
      numbers: doc.numbers().out('array'),

      // Sentence structure
      isQuestion: doc.questions().length > 0,
      isCommand: doc.imperatives().length > 0,
      hasNegation: doc.has('#Negative'),

      // Temporal markers
      hasFuture: doc.has('#Future'),
      hasPast: doc.has('#Past'),

      // Context from previous turns
      activeContexts: context.getActive(),

      // Full document for custom extractors
      doc
    };

    return signals;
  }
}
```

---

### 4. Intent Flow Engine (Execution Engine)

Orchestrates the entire intent flow:

```javascript
class IntentFlowEngine {
  constructor() {
    this.context = new ConversationContext();
    this.nluService = new EnhancedNLUService();
    this.intentFlows = new Map();
  }

  // Main execution entry point
  async execute(userInput) {
    // 1. Extract signals
    const signals = await this.nluService.analyzeIntent(userInput, this.context);

    // 2. Check for follow-up modifiers first
    const followUp = this.checkFollowUps(signals);
    if (followUp) {
      return await this.executeFollowUp(followUp, signals);
    }

    // 3. Score all intents
    const intents = this.scoreAllIntents(signals);
    const bestIntent = intents[0];
    const secondBest = intents[1];

    // 4. Route based on confidence
    return await this.routeByConfidence(bestIntent, secondBest, signals);
  }

  // Check if input is a follow-up to previous intent
  checkFollowUps(signals) {
    const activeContexts = this.context.getActive();

    for (const contextName of activeContexts) {
      for (const [intentName, { flow }] of this.intentFlows) {
        if (!flow.followUps) continue;

        for (const [followUpName, followUpDef] of Object.entries(flow.followUps)) {
          if (followUpDef.requiresContext !== contextName) continue;

          const matchesTrigger = followUpDef.triggers.some(trigger =>
            signals.verbs.includes(trigger) ||
            signals.nouns.includes(trigger) ||
            userInput.toLowerCase().includes(trigger)
          );

          if (matchesTrigger) {
            return {
              originalIntent: intentName,
              followUp: followUpDef,
              contextData: this.context.get(contextName)
            };
          }
        }
      }
    }

    return null;
  }

  // Score all intents using plugin-defined rules
  scoreAllIntents(signals) {
    const scores = [];

    for (const [intentName, { plugin, flow }] of this.intentFlows) {
      const score = this.scoreIntent(flow, signals);
      if (score > 0) {
        scores.push({
          intent: intentName,
          confidence: score,
          plugin,
          flow
        });
      }
    }

    return scores.sort((a, b) => b.confidence - a.confidence);
  }

  // Score single intent using declarative rules
  scoreIntent(flow, signals) {
    let score = 0;

    // Check required patterns
    const hasRequired = flow.scoringRules.required.some(rule => {
      if (rule.nouns) {
        return rule.nouns.some(n => signals.nouns.includes(n));
      }
      if (rule.verbs) {
        return rule.verbs.some(v => signals.verbs.includes(v));
      }
      if (rule.adjectives) {
        return rule.adjectives.some(a => signals.adjectives.includes(a));
      }
      return false;
    });

    if (!hasRequired) return 0;

    score = 0.5; // Base score for matching required

    // Apply boosters
    for (const booster of flow.scoringRules.boosters) {
      if (booster.hasDate && signals.dates.length > 0) {
        score += booster.boost;
      }
      if (booster.hasPlace && signals.places.length > 0) {
        score += booster.boost;
      }
      if (booster.isQuestion && signals.isQuestion) {
        score += booster.boost;
      }
      if (booster.hasContext && signals.activeContexts.includes(booster.hasContext)) {
        score += booster.boost;
      }
    }

    // Apply penalties
    for (const antiPattern of flow.scoringRules.antiPatterns || []) {
      if (antiPattern.nouns) {
        const hasAnti = antiPattern.nouns.some(n => signals.nouns.includes(n));
        if (hasAnti) score += antiPattern.penalty;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  // Route based on confidence thresholds
  async routeByConfidence(bestIntent, secondBest, signals) {
    if (!bestIntent) {
      return this.fallback(signals);
    }

    // HIGH: Execute directly
    if (bestIntent.confidence >= 0.7) {
      return await this.fulfillIntent(bestIntent, signals);
    }

    // AMBIGUOUS: Two intents close in score
    if (secondBest && (bestIntent.confidence - secondBest.confidence) < 0.15) {
      return this.disambiguate([bestIntent, secondBest]);
    }

    // MEDIUM: Hedge and execute
    if (bestIntent.confidence >= 0.45) {
      const result = await this.fulfillIntent(bestIntent, signals);
      result.hedged = true;
      result.text = `I think you're asking about weather. ${result.text}`;
      return result;
    }

    // LOW: Fallback
    return this.fallback(signals);
  }

  // Fulfill intent with parameter collection
  async fulfillIntent(intent, signals) {
    const { flow } = intent;

    // Extract parameters
    const params = this.extractParameters(flow.parameters, signals);

    // Check for missing required parameters
    const missingParam = this.findMissingRequiredParam(flow.parameters, params);
    if (missingParam) {
      return this.promptForParameter(intent, missingParam, params);
    }

    // Execute fulfillment
    const result = await flow.fulfill(params);

    // Set output contexts
    if (flow.outputContexts) {
      for (const contextDef of flow.outputContexts) {
        this.context.set(
          contextDef.name,
          contextDef.parameters(result, params),
          contextDef.lifespan
        );
      }
    }

    // Track turn
    this.context.addTurn(userInput, intent, result);

    return result;
  }
}
```

---

## Example Conversation Flows

### Weather Follow-Up Conversation

```
User: "What's the weather?"
→ Signals: { nouns: ['weather'], isQuestion: true }
→ Intent: weather_query (confidence: 0.6)
→ Params: { location: 'San Francisco' (default), timeframe: 'today' (default) }
→ Sets context: weather-followup { lastLocation: 'San Francisco', lastTimeframe: 'today' }
→ Response: "The weather in San Francisco today will be sunny, 72°F"

User: "And tomorrow?"
→ Signals: { dates: ['tomorrow'] }
→ Active contexts: ['weather-followup']
→ Matches followUp: temporal_modifier
→ Modified params: { location: 'San Francisco' (from context), timeframe: 'tomorrow' }
→ Re-executes: weather_query
→ Response: "Tomorrow in San Francisco will be partly cloudy, 68°F"

User: "What about Paris?"
→ Signals: { places: ['Paris'] }
→ Active contexts: ['weather-followup'] (lifespan: 1 remaining)
→ Matches followUp: location_modifier
→ Modified params: { location: 'Paris', timeframe: 'today' (from context) }
→ Re-executes: weather_query
→ Response: "The weather in Paris today will be rainy, 55°F"
```

### Multi-Turn Reminder Creation

```
User: "Set a reminder"
→ Intent: reminder_create (confidence: 0.8)
→ Missing params: task, timeframe
→ Prompts: "What should I remind you about?"
→ Sets context: reminder-awaiting-task { collectedParams: {} }

User: "Call Maria"
→ Active context: reminder-awaiting-task
→ Extracts: task = "Call Maria"
→ Still missing: timeframe
→ Prompts: "When should I remind you?"
→ Sets context: reminder-awaiting-time { collectedParams: { task: "Call Maria" } }

User: "Tomorrow morning"
→ Active context: reminder-awaiting-time
→ Extracts: timeframe = "tomorrow morning"
→ All params collected
→ Executes: scheduleReminder({ task: "Call Maria", timeframe: "tomorrow morning" })
→ Sets context: reminder-created { reminderId: '123', scheduledFor: '2025-11-10 09:00' }
→ Response: "I'll remind you tomorrow morning at 9:00 AM: Call Maria"

User: "Actually, change it to 10am"
→ Active context: reminder-created
→ Matches followUp: modify_time
→ Params: { reminderId: '123', newTime: '10:00' }
→ Executes: reminder_update
→ Response: "I've updated your reminder to 10:00 AM"
```

---

## Performance Characteristics

### Bundle Size Impact
- **Zero ML dependencies** - No TensorFlow.js, no BERT models
- **Compromise.js only** - ~210KB minified
- **Pure JavaScript** - Runs smoothly on mobile browsers

### Runtime Performance
- Intent scoring: ~5-10ms per intent
- Context lookup: O(1) map access
- Follow-up detection: O(n) where n = active contexts (typically 1-3)
- Total latency: <50ms for intent resolution

### Memory Footprint
- Context storage: ~1KB per context
- Turn history: ~10 turns × ~500 bytes = ~5KB
- Intent definitions: Loaded once, ~50KB total

---

## Comparison with Current System

| Feature | Current System | Dialogflow Architecture |
|---------|---------------|------------------------|
| Intent Matching | Single pattern match | Multi-signal scoring |
| Confidence | Basic score | Boosted by entities + context |
| Follow-Ups | Not supported | Native with context lifespan |
| Parameter Extraction | Manual | Declarative with auto-prompting |
| Response Generation | Centralized | Plugin-owned |
| Conversation Memory | None | 10-turn history + contexts |
| Disambiguation | Fallback only | Smart ambiguity handling |
| Mobile Performance | Good | Excellent (no ML) |

---

## Benefits

### For Plugin Developers
- **Declarative** - Define intents as data, not code
- **Self-contained** - Plugin owns scoring, params, fulfillment, contexts
- **Testable** - Pure functions, easy to unit test
- **Documented** - Intent flow is self-documenting

### For Users
- **Natural follow-ups** - "And tomorrow?" just works
- **Better accuracy** - Multi-signal scoring improves confidence
- **Graceful degradation** - Hedging for medium confidence
- **Conversation memory** - System remembers context

### For System
- **Maintainable** - Clear separation of concerns
- **Extensible** - Add new intents without touching engine
- **Debuggable** - Declarative flows easy to trace
- **Performant** - No ML, pure JavaScript, fast

---

## Next Steps

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for detailed phased rollout strategy.
