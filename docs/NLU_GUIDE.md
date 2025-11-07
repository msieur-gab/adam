# Natural Language Understanding (NLU) Guide

## Overview

The ADAM agent now includes a sophisticated Natural Language Understanding (NLU) system that can:

- **Extract intent** from user queries (what they want to do)
- **Identify question types** (what, when, why, how, who)
- **Parse entities** (dates, times, locations, people)
- **Understand temporal expressions** (today, tomorrow, next week)
- **Call external APIs** (weather, news, etc.)
- **Generate structured responses** with JSON schema
- **Use user context** for personalized answers

## Architecture

```
User Input
    ↓
NLU Service (Intent + Entity Extraction)
    ↓
Service Registry (Route to API if needed)
    ↓
Response Generator (Create structured response)
    ↓
Companion Chat (Display + TTS)
```

## Example Queries

### Weather Queries

```javascript
Input: "What is the weather today?"
Output: {
  intent: "weather_query",
  questionType: "what",
  entities: {
    temporal: { type: "today", value: "today" }
  },
  response: "The weather today will be sunny with a temperature of 22°C."
}
```

```javascript
Input: "Will it rain tomorrow in Paris?"
Output: {
  intent: "weather_query",
  questionType: "what", // implied
  entities: {
    temporal: { type: "tomorrow", value: "tomorrow" },
    location: { type: "city", value: "Paris" }
  },
  response: "Tomorrow in Paris will be partly cloudy with temperatures around 20°C."
}
```

```javascript
Input: "What's the temperature next week?"
Output: {
  intent: "weather_query",
  questionType: "what",
  entities: {
    temporal: { type: "next_week", value: "next week" }
  }
}
```

### Date & Time Queries

```javascript
Input: "What is the date today?"
Output: {
  intent: "date_query",
  questionType: "what",
  response: "Today is Friday, November 8, 2025."
}
```

```javascript
Input: "What will the date be tomorrow?"
Output: {
  intent: "date_query",
  questionType: "what",
  entities: {
    temporal: { type: "tomorrow", value: "tomorrow" }
  },
  response: "Tomorrow will be Saturday, November 9, 2025."
}
```

```javascript
Input: "What time is it?"
Output: {
  intent: "time_query",
  questionType: "what",
  response: "It's 2:30 PM."
}
```

### Complex Temporal Understanding

The NLU service can parse various temporal expressions:

- **Relative dates**: "today", "tomorrow", "yesterday"
- **Relative periods**: "next week", "next month", "in 3 days"
- **Day of week**: "next Monday", "this Friday"
- **Specific dates**: "January 15", "15/11/2025"
- **Times**: "3pm", "15:00", "noon"

### Question Type Analysis

The system identifies different question types:

```javascript
"What is the weather?" → questionType: "what"
"When is my appointment?" → questionType: "when"
"Why did it rain?" → questionType: "why"
"How do I cook this?" → questionType: "how"
"Who called me?" → questionType: "who"
"Where is my doctor?" → questionType: "where"
```

## Using User Profile for Context

The enhanced system uses the user profile to auto-fill missing information:

```javascript
// User profile has location: "Paris"
Input: "What's the weather?"
// System auto-fills location from profile
Output: "The weather in Paris today will be sunny..."
```

```javascript
// User profile has preferences.temperatureUnit: "celsius"
Input: "What's the temperature?"
Output: "The temperature is 22°C." // Uses Celsius
```

## Adding Custom Intents

To add a new intent, update three files:

### 1. NLU Service (`src/services/nlu-service.js`)

Add intent pattern:

```javascript
initIntentPatterns() {
  return {
    // ... existing intents

    // New intent
    news_query: {
      patterns: [
        '\\bnews\\b',
        '\\bheadlines\\b',
        '\\blatest\\b.*\\bnews\\b'
      ],
      keywords: ['news', 'headlines', 'breaking'],
      requiredEntities: []
    }
  };
}
```

### 2. API Service (if needed)

Create new service in `src/api/`:

```javascript
// src/api/news-service.js
import { BaseApiService } from './base-api-service.js';

export class NewsService extends BaseApiService {
  constructor() {
    super('news', {
      cacheTTL: 21600000, // 6 hours
    });
  }

  async query(params) {
    // Implement news API call
  }

  async transform(response) {
    // Transform API response to standard format
  }
}

export const newsService = new NewsService();
```

Register in service registry (`src/api/service-registry.js`):

```javascript
import { newsService } from './news-service.js';

initialize() {
  this.registerService('news', newsService);
  this.mapIntentToService('news_query', 'news');
}
```

### 3. Response Generator

Add response template in `src/services/response-generator.js`:

```javascript
generateServiceResponse(nluResult, data, userProfile) {
  switch (intent) {
    case 'news_query':
      return this.generateNewsResponse(data, userProfile);
    // ... other cases
  }
}

generateNewsResponse(newsData, userProfile) {
  const { headlines } = newsData;
  return `Here are the latest headlines: ${headlines.join(', ')}`;
}
```

## User Profile Schema

The user profile now includes:

```javascript
{
  // Identity
  name: "John",
  nickname: "Johnny",
  birthdate: "1950-05-15",
  age: 75,

  // Location & Timezone
  location: {
    city: "Paris",
    country: "France",
    timezone: "Europe/Paris",
    coordinates: { lat: 48.8566, lon: 2.3522 }
  },

  // Preferences
  preferences: {
    language: "en",
    voiceGender: "female",
    temperatureUnit: "celsius",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24h"
  },

  // Context
  interests: ["gardening", "cooking"],

  // Health (existing)
  medications: [...],
  doctors: [...],

  // Family (existing)
  family: [...]
}
```

## API Integration

### Weather API Setup

1. Get free API key from [OpenWeatherMap](https://openweathermap.org/api)
2. Update `src/api/weather-service.js`:

```javascript
constructor(apiKey = null) {
  super('weather', { cacheTTL: 3600000 });
  this.apiKey = apiKey || 'YOUR_API_KEY_HERE';
}
```

3. The system will gracefully fallback to mock data if API fails

### API Caching

All API responses are cached in IndexedDB:

- **Weather**: 1 hour TTL
- **News**: 6 hours TTL
- **Geocoding**: 30 days TTL

Cached data is automatically used when:
- API is unavailable
- Network is offline
- Cache is still fresh (within TTL)

## Response Schema

All responses follow this JSON schema:

```javascript
{
  // The text to display/speak
  text: string,

  // Intent metadata
  intent: string,
  confidence: number (0-1),

  // Extracted entities
  entities: {
    temporal: { type, value, parsed },
    location: { type, value },
    ...
  },

  // Service data (if applicable)
  data: object | null,

  // Data sources
  sources: [
    {
      service: string,
      timestamp: ISO datetime
    }
  ],

  // Alternative phrasings
  alternatives: string[],

  // Follow-up suggestions
  suggestions: string[],

  // UI hints
  ui: {
    type: string, // "weather_card", "info_card", etc.
    icon: string,
    color: string
  },

  // Metadata
  timestamp: ISO datetime,
  processingTime: number (ms),

  // Error handling
  fallback: string | null,
  error: string | null
}
```

## Testing

### Test NLU Analysis

```javascript
import { nluService } from './src/services/nlu-service.js';

const result = await nluService.analyze("What's the weather tomorrow?");
console.log(result);
// {
//   intent: "weather_query",
//   questionType: "what",
//   entities: { temporal: { type: "tomorrow", value: "tomorrow" } },
//   confidence: 0.8
// }
```

### Test Response Generation

```javascript
import { enhancedConversationService } from './src/services/enhanced-conversation-service.js';

const response = await enhancedConversationService.generateResponse(
  "What's the weather today?"
);
console.log(response);
// {
//   text: "The weather today will be sunny with a temperature of 22°C.",
//   response: { /* full response object */ },
//   nlu: { /* NLU analysis */ }
// }
```

### Enable Debug Logging

Check browser console for detailed logs:
- `[NLU]` - Intent and entity extraction
- `[ServiceRegistry]` - API service calls
- `[ResponseGenerator]` - Response generation
- `[CompanionChat]` - Final output

## Migration from Old System

The new system is **backward compatible**. To switch:

1. Set feature flag in `src/components/companion-chat.js`:

```javascript
const USE_ENHANCED_NLU = true; // Enable new system
```

2. Existing profile data is automatically migrated to new schema

3. Old conversation service remains available as fallback

## Performance

- **NLU Analysis**: ~10-50ms
- **API Calls**: ~500-2000ms (first call), ~5-10ms (cached)
- **Response Generation**: ~5-20ms
- **Total**: <100ms (cached), <2s (with API)

## Privacy & Data

- **All processing is local** (no data sent to external services except API calls)
- **User profile stored locally** in IndexedDB
- **API responses cached locally**
- **No tracking or analytics**
- **User can disable location sharing**

## Next Steps

1. Add more API services (calendar, news, reminders)
2. Integrate LLM for unrecognized intents
3. Add multi-language support
4. Implement conversation context tracking
5. Add A/B testing for response variations

## Troubleshooting

### "No service found for intent"

The intent doesn't have an API service registered. Add it to service registry or use template-based response.

### "Weather API failed"

- Check API key in `weather-service.js`
- Verify network connection
- System will fallback to cached or mock data

### "Intent confidence too low"

- Improve intent patterns in `nlu-service.js`
- Add more keywords
- Check for typos in user input

### "User profile not found"

- Initialize profile in app settings
- Migration runs automatically on first load
- Check browser console for migration logs
