# NLU Examples - Before & After

## Example 1: Basic Weather Query

### Before (Old System)
```
User: "What is the weather today?"

System Process:
1. Pattern match: "weather" → weather intent
2. Template response: "I can help you with weather information..."
3. No actual weather data

Output: Generic template response
```

### After (New System)
```
User: "What is the weather today?"

System Process:
1. NLU Analysis:
   - Intent: weather_query (confidence: 0.95)
   - Question Type: "what"
   - Entities: { temporal: "today" }
   - Temporal Parsing: "2025-11-07"

2. Service Call:
   - Check user profile for location
   - Call weather API (or use cache)
   - Get real weather data

3. Response Generation:
   - Format: "The weather in Paris today will be sunny with a temperature of 22°C."
   - Include suggestions: "Would you like the hourly forecast?"

Output: Real weather data in natural language
```

## Example 2: Temporal Understanding

### Before
```
User: "What's the date tomorrow?"

System: "Today is November 7, 2025" (only handles "today")
```

### After
```
User: "What's the date tomorrow?"

System Process:
1. Extract temporal: "tomorrow"
2. Parse to: "2025-11-08"
3. Format: "Tomorrow will be Friday, November 8, 2025."

Output: "Tomorrow will be Friday, November 8, 2025."
```

## Example 3: Context-Aware Responses

### Before
```
User: "What's the weather?"

System: "I can help you with weather information. What location?"
(Always asks for location)
```

### After
```
User: "What's the weather?"

System Process:
1. NLU detects missing location
2. Check user profile: location = "Paris"
3. Auto-fill location from profile
4. Call weather API

Output: "The weather in Paris today will be sunny with a temperature of 22°C."
(No need to ask for location)
```

## Example 4: Question Type Analysis

### Before
```
User: "When is my medication?"
User: "What medication do I take?"
User: "Why do I take medication?"

System: Same generic response for all
```

### After
```
User: "When is my medication?"
System recognizes: questionType = "when"
Output: "Your next medication is at 2:00 PM - Aspirin 100mg"

User: "What medication do I take?"
System recognizes: questionType = "what"
Output: "You take Aspirin 100mg twice daily and Metformin 500mg with breakfast"

User: "Why do I take aspirin?"
System recognizes: questionType = "why"
Output: "Aspirin is prescribed for cardiovascular health. Please consult your doctor for details."
```

## Example 5: Complex Queries

### Before
```
User: "Will it rain next Tuesday in London?"

System: Generic weather template (no date or location parsing)
```

### After
```
User: "Will it rain next Tuesday in London?"

System Process:
1. NLU Analysis:
   - Intent: weather_query
   - Entities:
     - temporal: "next Tuesday" → parsed to "2025-11-12"
     - location: "London"
   - Slots: { location: "London", date: "2025-11-12" }

2. Weather API:
   - Query forecast for London on 2025-11-12
   - Get precipitation probability

3. Response:
   - "Next Tuesday in London will be partly cloudy with a 40% chance of rain."

Output: Accurate answer with parsed date and location
```

## Example 6: Multiple Entities

### Before
```
User: "What's the temperature tomorrow at 3pm?"

System: Can't handle multiple temporal entities
```

### After
```
User: "What's the temperature tomorrow at 3pm?"

System Process:
1. Extract temporal: "tomorrow" + "3pm"
2. Combine: "2025-11-08 15:00"
3. Query hourly forecast
4. Response: "Tomorrow at 3pm, the temperature will be 24°C"

Output: Handles both date and time
```

## Example 7: Conversation Context

### Before
```
User: "What's the weather in Paris?"
System: "The weather in Paris is sunny."

User: "What about tomorrow?"
System: "The date tomorrow is November 8." (loses context)
```

### After
```
User: "What's the weather in Paris?"
System: "The weather in Paris is sunny."
Context saved: { lastIntent: "weather_query", lastEntities: { location: "Paris" } }

User: "What about tomorrow?"
System Process:
1. Detect partial query
2. Use context: location = "Paris" (from previous)
3. New temporal: "tomorrow"
4. Query: Weather in Paris tomorrow

Output: "Tomorrow in Paris will be partly cloudy with temperatures around 20°C."
```

## Example 8: API Failure Graceful Degradation

### Before
```
User: "What's the weather?"
API fails → System: "Sorry, I can't help with that."
```

### After
```
User: "What's the weather?"

System Process:
1. Try API → fails
2. Check cache → found data from 30 min ago
3. Use cached data with disclaimer

Output: "The weather in Paris is sunny with a temperature of 22°C. (Last updated 30 minutes ago)"

If cache also empty:
Output: "I'm having trouble getting the weather forecast right now. Please try again later."
```

## Example 9: Personalized Preferences

### Before
```
User: "What's the temperature?"
System: Always uses Celsius (hardcoded)
```

### After
```
User: "What's the temperature?"

System Process:
1. Check user profile: preferences.temperatureUnit = "fahrenheit"
2. Convert temperature
3. Format response

Output: "The temperature is 72°F" (respects user preference)
```

## Example 10: Structured Response with UI Hints

### Before
```
User: "What's the weather?"

Output: Plain text response only
```

### After
```
User: "What's the weather?"

Response Object:
{
  text: "The weather in Paris today will be sunny with a temperature of 22°C.",

  ui: {
    type: "weather_card",
    icon: "sunny",
    color: "#FFD700"
  },

  data: {
    temperature: 22,
    conditions: "sunny",
    humidity: 65,
    windSpeed: 15
  },

  suggestions: [
    "Would you like the hourly forecast?",
    "Should I remind you about this later?"
  ]
}

Output: Rich weather card with icon, data, and follow-up suggestions
```

## Performance Comparison

### Before
- Pattern matching: ~1-2ms
- Template selection: ~1ms
- **Total**: ~3ms
- No external data

### After
- NLU analysis: ~10-50ms
- Service call (cached): ~5-10ms
- Response generation: ~5-20ms
- **Total**: ~30-100ms (cached)
- **Total**: ~500-2000ms (fresh API call)

Trade-off: Slightly slower but much more intelligent and accurate

## Summary

| Feature | Before | After |
|---------|--------|-------|
| Intent Recognition | Simple keyword matching | Confidence-scored multi-pattern |
| Entity Extraction | None | Dates, times, locations, people |
| Temporal Parsing | Only "today" | Full date/time expressions |
| Question Type | Not detected | What/when/why/how/who |
| API Integration | None | Weather, news, etc. |
| User Context | Basic profile | Full personalization |
| Response Format | Plain text | Structured JSON + UI hints |
| Caching | None | Intelligent TTL-based cache |
| Fallback | Generic error | Graceful degradation |
| Conversation Memory | None | Context tracking |
