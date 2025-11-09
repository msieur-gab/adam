# Plugin Migration Strategy

## Overview

This document provides step-by-step guidance for migrating existing ADAM plugins from the current NLU pattern system to the new Dialogflow-style intent flow architecture.

---

## Before vs After Comparison

### Current Plugin Structure

```javascript
class WeatherPlugin extends BasePlugin {
  getIntents() {
    return ['weather_query'];
  }

  getNLUPatterns() {
    return {
      subjects: {
        weather: {
          nouns: ['weather', 'forecast'],
          verbs: ['rain', 'snow'],
          priority: 10
        }
      },
      actions: {
        get: ['get', 'check', 'show']
      },
      intents: {
        weather_query: {
          patterns: [
            { action: 'get', subject: 'weather' }
          ]
        }
      }
    };
  }

  async handleQuery(intent, params) {
    if (intent === 'weather_query') {
      const location = params.location || userPreferences.location;
      const forecast = await this.fetchWeather(location);
      return {
        success: true,
        message: `The weather will be ${forecast.description}`
      };
    }
  }
}
```

### New Intent Flow Structure

```javascript
class WeatherPlugin extends BasePlugin {
  getIntentFlows() {
    return {
      weather_query: {
        // Scoring rules (replaces getNLUPatterns)
        scoringRules: {
          required: [
            { nouns: ['weather', 'forecast', 'temperature'] },
            { verbs: ['rain', 'snow'] }
          ],
          boosters: [
            { hasDate: true, boost: 0.3 },
            { hasPlace: true, boost: 0.2 },
            { isQuestion: true, boost: 0.1 }
          ]
        },

        // Parameters (explicit definition)
        parameters: {
          location: {
            entity: 'place',
            required: false,
            default: () => userPreferences.location
          },
          timeframe: {
            entity: 'date',
            required: false,
            default: 'today'
          }
        },

        // Fulfillment (replaces handleQuery)
        fulfill: async (params) => {
          const forecast = await this.fetchWeather(params.location, params.timeframe);
          return {
            text: `The weather in ${params.location} ${params.timeframe} will be ${forecast.description}`,
            data: { forecast }
          };
        },

        // NEW: Output contexts for follow-ups
        outputContexts: [
          {
            name: 'weather-followup',
            lifespan: 2,
            parameters: (result, params) => ({
              lastLocation: params.location,
              lastTimeframe: params.timeframe
            })
          }
        ],

        // NEW: Follow-up handlers
        followUps: {
          temporal_modifier: {
            triggers: ['tomorrow', 'next week'],
            requiresContext: 'weather-followup',
            modifyParams: (contextData, signals) => ({
              location: contextData.lastLocation,
              timeframe: signals.dates[0]
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

## Migration Checklist

### Step 1: Analyze Current Plugin

- [ ] List all intents handled by plugin
- [ ] Document all NLU patterns used
- [ ] Document all parameters extracted
- [ ] Document all entity types used
- [ ] Identify potential follow-up scenarios

### Step 2: Design Scoring Rules

- [ ] Convert `getNLUPatterns().subjects` to `required` patterns
- [ ] Identify boosters (dates, places, numbers, etc.)
- [ ] Identify anti-patterns (words that reduce confidence)
- [ ] Test scoring with example inputs

### Step 3: Define Parameters

- [ ] List all parameters explicitly
- [ ] Specify entity types (date, place, person, number, any)
- [ ] Determine which are required vs optional
- [ ] Write custom extractors if needed
- [ ] Define prompts for missing required parameters

### Step 4: Implement Fulfillment

- [ ] Extract logic from `handleQuery()` to `fulfill()`
- [ ] Change function signature to accept `params` object
- [ ] Return structured result with `text` and `data`
- [ ] Handle errors gracefully

### Step 5: Add Context Support

- [ ] Identify what data should persist for follow-ups
- [ ] Define output contexts with lifespan
- [ ] Define context parameters to store

### Step 6: Add Follow-Up Handlers

- [ ] Identify follow-up scenarios ("And tomorrow?", "What about Paris?")
- [ ] Define triggers for each follow-up type
- [ ] Specify required contexts
- [ ] Write parameter modification functions

### Step 7: Test

- [ ] Write unit tests for scoring rules
- [ ] Write unit tests for parameter extraction
- [ ] Write integration tests for full flow
- [ ] Write tests for follow-up scenarios
- [ ] Test error handling and edge cases

### Step 8: Clean Up

- [ ] Remove old `getIntents()` method
- [ ] Remove old `getNLUPatterns()` method
- [ ] Remove old `handleQuery()` method
- [ ] Update plugin documentation
- [ ] Update examples

---

## Common Migration Patterns

### Pattern 1: Simple Intent (No Parameters)

**Before:**
```javascript
getNLUPatterns() {
  return {
    subjects: {
      time: { nouns: ['time', 'clock'], priority: 10 }
    },
    intents: {
      time_query: { patterns: [{ subject: 'time' }] }
    }
  };
}

async handleQuery(intent, params) {
  if (intent === 'time_query') {
    const now = new Date();
    return {
      success: true,
      message: `It's ${now.toLocaleTimeString()}`
    };
  }
}
```

**After:**
```javascript
getIntentFlows() {
  return {
    time_query: {
      scoringRules: {
        required: [
          { nouns: ['time', 'clock', 'hour'] }
        ],
        boosters: [
          { isQuestion: true, boost: 0.2 }
        ]
      },

      parameters: {}, // No parameters needed

      fulfill: async (params) => {
        const now = new Date();
        return {
          text: `It's ${now.toLocaleTimeString()}`
        };
      }
    }
  };
}
```

---

### Pattern 2: Intent with Optional Parameters

**Before:**
```javascript
async handleQuery(intent, params) {
  if (intent === 'weather_query') {
    const location = params.location || userPreferences.location;
    const timeframe = params.timeframe || 'today';

    const forecast = await this.fetchWeather(location, timeframe);
    return {
      success: true,
      message: `Weather: ${forecast.description}`
    };
  }
}
```

**After:**
```javascript
getIntentFlows() {
  return {
    weather_query: {
      scoringRules: { /* ... */ },

      parameters: {
        location: {
          entity: 'place',
          required: false,
          default: () => userPreferences.location
        },
        timeframe: {
          entity: 'date',
          required: false,
          default: 'today',
          extractor: (signals) => signals.dates[0] || 'today'
        }
      },

      fulfill: async (params) => {
        const forecast = await this.fetchWeather(params.location, params.timeframe);
        return {
          text: `The weather in ${params.location} ${params.timeframe} will be ${forecast.description}`
        };
      }
    }
  };
}
```

---

### Pattern 3: Intent with Required Parameters

**Before:**
```javascript
async handleQuery(intent, params) {
  if (intent === 'reminder_create') {
    if (!params.task || !params.timeframe) {
      return {
        success: false,
        error: 'Missing required parameters'
      };
    }

    await this.createReminder(params.task, params.timeframe);
    return {
      success: true,
      message: `Reminder set: ${params.task}`
    };
  }
}
```

**After:**
```javascript
getIntentFlows() {
  return {
    reminder_create: {
      scoringRules: { /* ... */ },

      parameters: {
        task: {
          entity: 'any',
          required: true,
          prompt: 'What should I remind you about?',
          extractor: (signals) => {
            // Extract everything after "remind me to"
            const match = signals.doc.text().match(/remind me to (.+?)(?:\s+in|\s+at|\s+tomorrow|$)/i);
            return match ? match[1].trim() : null;
          }
        },
        timeframe: {
          entity: 'date',
          required: true,
          prompt: 'When should I remind you?',
          extractor: (signals) => signals.dates[0] || null
        }
      },

      fulfill: async (params) => {
        const scheduledFor = this.calculateScheduledTime(params.timeframe);
        await this.createReminder(params.task, scheduledFor);
        return {
          text: `I'll remind you ${this.formatTime(params.timeframe)}: ${params.task}`
        };
      },

      // Multi-turn parameter collection
      parameterFlow: {
        onMissingTask: {
          prompt: 'What should I remind you about?',
          inputContext: 'reminder-awaiting-task',
          lifespan: 1
        },
        onMissingTimeframe: {
          prompt: 'When should I remind you?',
          inputContext: 'reminder-awaiting-time',
          lifespan: 1
        }
      }
    }
  };
}
```

---

### Pattern 4: Adding Follow-Up Support (NEW)

**After (with follow-ups):**
```javascript
getIntentFlows() {
  return {
    weather_query: {
      scoringRules: { /* ... */ },
      parameters: { /* ... */ },
      fulfill: async (params) => { /* ... */ },

      // NEW: Output context
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

      // NEW: Follow-up handlers
      followUps: {
        temporal_modifier: {
          triggers: ['tomorrow', 'next week', 'next month', 'later'],
          requiresContext: 'weather-followup',
          modifyParams: (contextData, signals) => ({
            location: contextData.lastLocation,  // Reuse from context
            timeframe: signals.dates[0] || 'tomorrow'
          }),
          reuseIntent: 'weather_query'
        },

        location_modifier: {
          triggers: ['in', 'at', 'for', 'about'],
          requiresContext: 'weather-followup',
          modifyParams: (contextData, signals) => ({
            location: signals.places[0],  // New location
            timeframe: contextData.lastTimeframe  // Reuse from context
          }),
          reuseIntent: 'weather_query'
        }
      }
    }
  };
}
```

---

## Custom Parameter Extractors

### When to Use Custom Extractors

Use custom extractors when:
- Standard entity extraction isn't sufficient
- You need complex parsing logic
- Entity is embedded in specific phrase structure
- Multiple extraction strategies needed

### Example: Reminder Task Extraction

```javascript
parameters: {
  task: {
    entity: 'any',
    required: true,
    extractor: (signals) => {
      const text = signals.doc.text();

      // Strategy 1: "remind me to [task]"
      let match = text.match(/remind me to (.+?)(?:\s+in|\s+at|\s+for|\s+tomorrow|$)/i);
      if (match) return match[1].trim();

      // Strategy 2: "set a reminder to [task]"
      match = text.match(/set a reminder to (.+?)(?:\s+in|\s+at|\s+for|$)/i);
      if (match) return match[1].trim();

      // Strategy 3: "reminder: [task]"
      match = text.match(/reminder:?\s+(.+?)(?:\s+in|\s+at|\s+for|$)/i);
      if (match) return match[1].trim();

      return null;
    }
  }
}
```

### Example: Timeframe with Relative Terms

```javascript
parameters: {
  timeframe: {
    entity: 'date',
    required: false,
    default: 'today',
    extractor: (signals) => {
      // Priority 1: Compromise dates
      if (signals.dates.length > 0) {
        return signals.dates[0];
      }

      // Priority 2: Temporal keywords
      const text = signals.doc.text().toLowerCase();
      if (text.includes('tomorrow')) return 'tomorrow';
      if (text.includes('tonight')) return 'tonight';
      if (text.includes('morning')) return 'morning';
      if (text.includes('afternoon')) return 'afternoon';
      if (text.includes('evening')) return 'evening';

      // Priority 3: Relative time "in X minutes/hours"
      const match = text.match(/in\s+(\d+)\s+(minute|hour|min|hr)/i);
      if (match) {
        return {
          type: 'relative',
          value: parseInt(match[1]),
          unit: match[2].startsWith('hour') ? 'hours' : 'minutes'
        };
      }

      return 'today'; // Default
    }
  }
}
```

---

## Scoring Rules Best Practices

### 1. Start with Required Patterns

**Required patterns** are the minimum to match the intent:

```javascript
scoringRules: {
  required: [
    // At least ONE of these must match
    { nouns: ['weather', 'forecast', 'temperature'] },
    { verbs: ['rain', 'snow'] },
    { adjectives: ['sunny', 'cloudy', 'rainy'] }
  ]
}
```

**Rule:** If none of the required patterns match, intent score = 0 (won't be considered)

### 2. Add Boosters for Confidence

**Boosters** increase confidence when additional signals are present:

```javascript
scoringRules: {
  required: [ /* ... */ ],

  boosters: [
    { hasDate: true, boost: 0.3 },        // "next week" adds 30%
    { hasPlace: true, boost: 0.2 },       // "in Paris" adds 20%
    { isQuestion: true, boost: 0.1 },     // "what's the..." adds 10%
    { hasNumber: true, boost: 0.15 },     // "5 day forecast" adds 15%
    { hasContext: 'weather-followup', boost: 0.4 }  // Follow-up adds 40%
  ]
}
```

**Tuning tips:**
- Entity boosters: 0.2-0.3 (significant confidence increase)
- Structural boosters (question, command): 0.1-0.15 (small increase)
- Context boosters: 0.3-0.5 (strong signal for follow-ups)

### 3. Add Anti-Patterns to Reduce False Positives

**Anti-patterns** reduce confidence when conflicting signals are present:

```javascript
scoringRules: {
  required: [ /* ... */ ],
  boosters: [ /* ... */ ],

  antiPatterns: [
    { nouns: ['reminder', 'alarm'], penalty: -0.5 },  // Not about reminders
    { verbs: ['remind', 'schedule'], penalty: -0.3 }, // Not scheduling
    { hasNegation: true, penalty: -0.2 }              // "Don't tell me the weather"
  ]
}
```

**Tuning tips:**
- Strong conflicts: -0.4 to -0.6 (almost disqualifies intent)
- Moderate conflicts: -0.2 to -0.3 (reduces confidence significantly)
- Weak conflicts: -0.1 to -0.15 (minor reduction)

### 4. Test with Real Examples

```javascript
// Test cases for weather_query intent
const testCases = [
  { input: "What's the weather?", expectedScore: 0.6 },  // Base + question
  { input: "Weather tomorrow in Paris", expectedScore: 0.9 },  // Base + date + place
  { input: "Will it rain?", expectedScore: 0.6 },  // Verb match + question
  { input: "Remind me about the weather", expectedScore: 0.1 },  // Anti-pattern penalty
];
```

---

## Testing Your Migrated Plugin

### Unit Test Template

```javascript
import { IntentFlowEngine } from '../services/intent-flow-engine.js';
import { WeatherPlugin } from './weather-plugin.js';

describe('Weather Plugin Intent Flow', () => {
  let engine;
  let plugin;

  beforeEach(() => {
    engine = new IntentFlowEngine();
    plugin = new WeatherPlugin();
    engine.registerPlugin(plugin);
  });

  describe('Scoring Rules', () => {
    test('should score high for basic weather query', async () => {
      const result = await engine.execute("What's the weather?");
      expect(result.intent).toBe('weather_query');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('should boost score with date entity', async () => {
      const result = await engine.execute("What's the weather tomorrow?");
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('should reduce score with anti-pattern', async () => {
      const result = await engine.execute("Remind me about the weather");
      expect(result.confidence).toBeLessThan(0.3);
    });
  });

  describe('Parameter Extraction', () => {
    test('should use default location', async () => {
      const result = await engine.execute("What's the weather?");
      expect(result.params.location).toBe(userPreferences.location);
    });

    test('should extract explicit location', async () => {
      const result = await engine.execute("What's the weather in Paris?");
      expect(result.params.location).toBe('Paris');
    });

    test('should extract timeframe', async () => {
      const result = await engine.execute("Weather next week");
      expect(result.params.timeframe).toContain('next week');
    });
  });

  describe('Follow-Ups', () => {
    test('should handle temporal follow-up', async () => {
      // First query
      await engine.execute("What's the weather in Tokyo?");

      // Follow-up
      const result = await engine.execute("And tomorrow?");
      expect(result.params.location).toBe('Tokyo');
      expect(result.params.timeframe).toContain('tomorrow');
    });

    test('should handle location follow-up', async () => {
      // First query
      await engine.execute("What's the weather tomorrow?");

      // Follow-up
      const result = await engine.execute("What about London?");
      expect(result.params.location).toBe('London');
      expect(result.params.timeframe).toContain('tomorrow');
    });

    test('should expire context after lifespan', async () => {
      await engine.execute("What's the weather?");

      // Two more turns (lifespan = 2)
      await engine.execute("What time is it?");
      await engine.execute("Set a reminder");

      // Context expired, should not be follow-up
      const result = await engine.execute("And tomorrow?");
      expect(result.isFollowUp).toBe(false);
    });
  });
});
```

---

## Common Pitfalls and Solutions

### Pitfall 1: Overly Strict Required Patterns

**Problem:** Intent never matches because required patterns are too specific

```javascript
// TOO STRICT - requires ALL nouns to be present
scoringRules: {
  required: [
    { nouns: ['weather', 'forecast', 'temperature', 'climate'] }  // All must match
  ]
}
```

**Solution:** Use OR logic - at least one match

```javascript
// BETTER - requires at least ONE noun
scoringRules: {
  required: [
    { nouns: ['weather', 'forecast', 'temperature', 'climate'] }  // Any one matches
  ]
}
```

### Pitfall 2: Boosters Too High

**Problem:** Intent always scores 1.0 even without good match

```javascript
// TOO HIGH - boosters exceed 1.0
scoringRules: {
  required: [ /* ... */ ],
  boosters: [
    { hasDate: true, boost: 0.5 },
    { hasPlace: true, boost: 0.5 },
    { isQuestion: true, boost: 0.5 }  // Total: 1.5!
  ]
}
```

**Solution:** Keep total boosters under 0.5

```javascript
// BETTER - max boost ~0.6
scoringRules: {
  required: [ /* ... */ ],
  boosters: [
    { hasDate: true, boost: 0.3 },
    { hasPlace: true, boost: 0.2 },
    { isQuestion: true, boost: 0.1 }  // Total: 0.6 (reasonable)
  ]
}
```

### Pitfall 3: Missing Anti-Patterns

**Problem:** Intent matches when it shouldn't

```javascript
// User: "Remind me to check the weather"
// Matches weather_query even though it's about reminders!
```

**Solution:** Add anti-patterns for conflicting intents

```javascript
scoringRules: {
  required: [ /* ... */ ],
  boosters: [ /* ... */ ],
  antiPatterns: [
    { nouns: ['reminder', 'alarm'], penalty: -0.5 },
    { verbs: ['remind', 'schedule'], penalty: -0.3 }
  ]
}
```

### Pitfall 4: Context Lifespan Too Long

**Problem:** Follow-ups work too long after original query

```javascript
// Context active for 10 turns - too long!
outputContexts: [
  { name: 'weather-followup', lifespan: 10 }
]
```

**Solution:** Use lifespan 1-2 for most contexts

```javascript
// Better - expires after 2 turns
outputContexts: [
  { name: 'weather-followup', lifespan: 2 }
]
```

**Rule of thumb:**
- Immediate follow-ups: lifespan = 1
- Multi-turn conversations: lifespan = 2-3
- Parameter collection: lifespan = 1 per parameter

---

## Migration Completion Checklist

Before marking a plugin as migrated:

- [ ] All intents converted to `getIntentFlows()`
- [ ] Scoring rules tested with >10 example inputs
- [ ] All parameters explicitly defined
- [ ] Custom extractors written if needed
- [ ] Fulfillment function tested
- [ ] Output contexts defined
- [ ] Follow-up handlers implemented
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Documentation updated
- [ ] Old methods removed (`getIntents`, `getNLUPatterns`, `handleQuery`)
- [ ] Code review completed
- [ ] Performance validated (<50ms)

---

## Need Help?

**Common questions:**

1. **How do I convert my NLU patterns?**
   - See Pattern 1-4 examples above

2. **How do I handle complex parameter extraction?**
   - Write a custom extractor (see Custom Parameter Extractors section)

3. **How do I add follow-up support?**
   - Define output contexts and followUp handlers (see Pattern 4)

4. **My scores are too low/high**
   - Adjust boosters and anti-patterns (see Scoring Rules Best Practices)

5. **How do I test my migration?**
   - Use the unit test template above

**Next:** See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for phased rollout schedule.
