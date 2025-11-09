# Quick Start Guide: Dialogflow Architecture

## For Plugin Developers

### Minimum Viable Intent Flow

The simplest intent flow you can create:

```javascript
class MyPlugin extends BasePlugin {
  getIntentFlows() {
    return {
      my_intent: {
        // What words trigger this intent?
        scoringRules: {
          required: [
            { nouns: ['word1', 'word2'] }
          ]
        },

        // What info do you need?
        parameters: {},

        // What do you do?
        fulfill: async (params) => {
          return {
            text: "Your response here"
          };
        }
      }
    };
  }
}
```

### Adding Parameters

```javascript
parameters: {
  location: {
    entity: 'place',           // What type? (place, date, person, number, any)
    required: false,           // Must have it?
    default: 'San Francisco'   // Fallback value
  }
}
```

### Adding Follow-Ups

```javascript
// 1. Store context after fulfillment
outputContexts: [
  {
    name: 'my-followup',
    lifespan: 2,
    parameters: (result, params) => ({
      lastValue: params.location
    })
  }
],

// 2. Handle follow-up queries
followUps: {
  modifier: {
    triggers: ['tomorrow', 'next'],
    requiresContext: 'my-followup',
    modifyParams: (contextData, signals) => ({
      location: contextData.lastValue,
      timeframe: signals.dates[0]
    }),
    reuseIntent: 'my_intent'
  }
}
```

---

## For Architects

### System Flow

```
User Input
    ↓
Enhanced NLU (extract all signals from Compromise.js)
    ↓
Check for Follow-Ups (using active contexts)
    ↓
Score All Intents (using declarative rules)
    ↓
Route by Confidence
    ↓
Extract Parameters
    ↓
Fulfill Intent
    ↓
Set Output Contexts
    ↓
Response
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| ConversationContext | `conversation-context.js` | Manages context lifespan |
| EnhancedNLUService | `enhanced-nlu-service.js` | Extracts Compromise signals |
| IntentFlowEngine | `intent-flow-engine.js` | Scores, routes, fulfills |
| BasePlugin | `plugin-base.js` | Plugin interface |

### Confidence Thresholds

| Range | Action |
|-------|--------|
| ≥ 0.7 | Execute immediately |
| 0.45-0.7 | Execute with hedging |
| < 0.45 | Fallback |
| Ambiguous (Δ < 0.15) | Disambiguate |

---

## For Testing

### Test Your Scoring Rules

```javascript
const testCases = [
  { input: "what's the weather?", expected: 0.6 },
  { input: "weather tomorrow in Paris", expected: 0.9 },
  { input: "will it rain?", expected: 0.6 }
];

for (const tc of testCases) {
  const result = await engine.execute(tc.input);
  expect(result.confidence).toBeCloseTo(tc.expected, 1);
}
```

### Test Follow-Ups

```javascript
// First query
await engine.execute("What's the weather in Tokyo?");

// Follow-up
const result = await engine.execute("And tomorrow?");
expect(result.params.location).toBe('Tokyo');
expect(result.params.timeframe).toContain('tomorrow');
```

---

## Implementation Phases

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| 1. Foundation | Week 1 | Core services |
| 2. Hybrid Mode | Week 2 | Comparison data |
| 3. Pilot (Weather) | Week 3 | One plugin migrated |
| 4. Full Migration | Week 4-5 | All plugins |
| 5. Cleanup | Week 6 | Remove old code |

**Next Step:** Begin Phase 1 with ConversationContext service

---

## Decision Tree: When to Use What

### Should I use a custom extractor?

- **No** if: Standard entity extraction works (dates, places, people)
- **Yes** if: Entity is in specific phrase structure ("remind me to X")

### Should I use required parameters?

- **No** if: Parameter has a sensible default
- **Yes** if: Intent meaningless without it

### What should my context lifespan be?

- **1 turn**: Immediate follow-up only
- **2 turns**: Normal follow-up conversation
- **3+ turns**: Multi-step parameter collection

### How many boosters should I add?

- **Start with 2-3**: Entity presence boosters
- **Add more if needed**: Based on test results
- **Total boost < 0.5**: Prevent over-scoring

---

## Common Patterns Cheat Sheet

### Pattern: Simple Query

```javascript
{
  scoringRules: {
    required: [{ nouns: ['time', 'clock'] }],
    boosters: [{ isQuestion: true, boost: 0.1 }]
  },
  parameters: {},
  fulfill: async () => ({ text: new Date().toLocaleTimeString() })
}
```

### Pattern: Query with Entity

```javascript
{
  scoringRules: {
    required: [{ nouns: ['weather'] }],
    boosters: [
      { hasDate: true, boost: 0.3 },
      { hasPlace: true, boost: 0.2 }
    ]
  },
  parameters: {
    location: { entity: 'place', required: false, default: 'SF' },
    timeframe: { entity: 'date', required: false, default: 'today' }
  },
  fulfill: async (params) => {
    const forecast = await fetchWeather(params.location, params.timeframe);
    return { text: `Weather: ${forecast}` };
  }
}
```

### Pattern: Multi-Turn Collection

```javascript
{
  scoringRules: { /* ... */ },
  parameters: {
    task: { entity: 'any', required: true, prompt: 'What task?' },
    time: { entity: 'date', required: true, prompt: 'When?' }
  },
  parameterFlow: {
    onMissingTask: {
      prompt: 'What should I remind you about?',
      inputContext: 'reminder-awaiting-task',
      lifespan: 1
    },
    onMissingTime: {
      prompt: 'When?',
      inputContext: 'reminder-awaiting-time',
      lifespan: 1
    }
  },
  fulfill: async (params) => {
    await createReminder(params.task, params.time);
    return { text: `Reminder set: ${params.task}` };
  }
}
```

### Pattern: With Follow-Up

```javascript
{
  scoringRules: { /* ... */ },
  parameters: { /* ... */ },
  fulfill: async (params) => { /* ... */ },

  outputContexts: [
    {
      name: 'context-name',
      lifespan: 2,
      parameters: (result, params) => ({ lastValue: params.value })
    }
  ],

  followUps: {
    temporal: {
      triggers: ['tomorrow', 'next'],
      requiresContext: 'context-name',
      modifyParams: (ctx, sig) => ({
        value: ctx.lastValue,
        time: sig.dates[0]
      }),
      reuseIntent: 'original_intent'
    }
  }
}
```

---

## Troubleshooting

### Intent not matching

**Check:**
1. Are required patterns too strict?
2. Are boosters too low?
3. Are anti-patterns too aggressive?

**Fix:** Adjust scoring rules, test with examples

### Parameters not extracted

**Check:**
1. Is entity type correct?
2. Does extractor handle edge cases?
3. Are Compromise signals available?

**Fix:** Write custom extractor, add fallbacks

### Follow-ups not working

**Check:**
1. Is output context being set?
2. Is lifespan correct?
3. Do triggers match user input?

**Fix:** Debug context lifecycle, adjust triggers

### Score too high/low

**Check:**
1. Total boosters under 0.5?
2. Are anti-patterns applied?
3. Is base score (0.5) appropriate?

**Fix:** Tune boosters and penalties

---

## File Locations

```
adam/
├── docs/
│   ├── DIALOGFLOW_ARCHITECTURE.md    ← Architecture overview
│   ├── IMPLEMENTATION_PLAN.md        ← 6-week plan
│   ├── MIGRATION_STRATEGY.md         ← Plugin migration guide
│   └── QUICK_START_GUIDE.md          ← This file
│
└── src/
    ├── services/
    │   ├── conversation-context.js         [Phase 1]
    │   ├── enhanced-nlu-service.js         [Phase 1]
    │   └── intent-flow-engine.js           [Phase 1]
    │
    └── plugins/
        ├── plugin-base.js                  [Phase 1 - enhance]
        ├── weather-plugin.js               [Phase 3 - migrate]
        └── reminder-plugin.js              [Phase 4 - migrate]
```

---

## Next Steps

1. **Read:** [DIALOGFLOW_ARCHITECTURE.md](./DIALOGFLOW_ARCHITECTURE.md) for full design
2. **Plan:** [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for roadmap
3. **Migrate:** [MIGRATION_STRATEGY.md](./MIGRATION_STRATEGY.md) for plugin conversion
4. **Start:** Phase 1, Task 1 - Build ConversationContext service

**Questions?** Review the detailed docs or ask in team chat.
