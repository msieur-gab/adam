# ADAM Agent - Architecture Improvement Proposal

## Executive Summary

This proposal outlines improvements to the ADAM agent's natural language understanding and response generation capabilities. The goal is to move from simple pattern matching to intent-driven architecture with semantic understanding.

## Current Architecture Issues

### 1. Intent Recognition Limitations
- **Pattern matching only**: Simple keyword inclusion checks
- **No semantic understanding**: Can't understand "What's the weather today?" vs "Will it rain tomorrow?"
- **No entity extraction**: Can't extract dates, times, locations from user input
- **No question type analysis**: Doesn't distinguish what/when/why/how questions
- **Stateless**: No conversation context or memory

### 2. API Integration
- **No external APIs**: Everything is local
- **No service abstraction**: No way to call weather, calendar, or other APIs
- **Hard to extend**: Adding new capabilities requires modifying core code

### 3. Data Storage
- **No user profile table**: Personal data scattered in settings
- **Missing user context**: No location, birthdate, timezone, preferences
- **Limited personalization**: Can't use user data for context-aware responses

### 4. Response Generation
- **Template-based only**: Hardcoded response variations
- **No structure**: Responses are plain strings
- **No metadata**: Can't track response type, confidence, entities used

---

## Proposed Architecture

### 1. Natural Language Understanding (NLU) Service

**Purpose**: Extract meaning, intent, entities, and context from user input

**Features**:
- **Intent Classification**: Map input to specific intents with confidence scores
- **Entity Extraction**: Pull out dates, times, locations, names, etc.
- **Question Type Analysis**: Identify what/when/why/how/who questions
- **Temporal Understanding**: Parse "today", "tomorrow", "next week", "in 3 days"
- **Slot Filling**: Extract parameters needed for intent execution
- **Context Tracking**: Maintain conversation state and references

**Example Flow**:
```javascript
Input: "What's the weather tomorrow in Paris?"

NLU Output:
{
  intent: "weather_query",
  confidence: 0.95,
  questionType: "what",
  entities: {
    date: {
      type: "relative",
      value: "tomorrow",
      parsed: "2025-11-08"
    },
    location: {
      type: "city",
      value: "Paris"
    }
  },
  slots: {
    temporal: "tomorrow",
    location: "Paris",
    metric: "general" // could be "temperature", "precipitation", etc.
  }
}
```

**Implementation Strategy**:
- **Phase 1**: Rule-based NLU with regex and temporal parsing
- **Phase 2**: Integrate existing LLM for semantic understanding
- **Phase 3**: Fine-tuned small model for intent classification

---

### 2. API Services Layer

**Purpose**: Abstract external API calls into dedicated services

**Architecture**:
```
api/
├── base-api-service.js       # Base class with error handling, caching
├── weather-service.js         # Weather API integration
├── calendar-service.js        # Calendar/events
├── news-service.js           # News headlines
├── geocoding-service.js      # Location lookup
└── service-registry.js       # Service discovery and routing
```

**Features**:
- **Consistent interface**: All services implement same contract
- **Error handling**: Graceful degradation, fallbacks
- **Caching**: Cache API responses in IndexedDB
- **Rate limiting**: Respect API quotas
- **Offline support**: Return cached data when offline

**Example Service**:
```javascript
class WeatherService extends BaseApiService {
  async query(params) {
    const { location, date } = params;

    // Check cache first
    const cached = await this.getCache(`weather:${location}:${date}`);
    if (cached && !this.isStale(cached)) return cached;

    // Call API
    const response = await fetch(
      `https://api.weather.com/v1/forecast?location=${location}&date=${date}`
    );

    // Transform to standard format
    const data = await this.transform(response);

    // Cache result
    await this.setCache(`weather:${location}:${date}`, data);

    return data;
  }

  async transform(apiResponse) {
    // Convert API format to our schema
    return {
      location: apiResponse.location.name,
      date: apiResponse.date,
      temperature: apiResponse.temp.current,
      conditions: apiResponse.weather.description,
      precipitation: apiResponse.precip.probability
    };
  }
}
```

---

### 3. Enhanced User Profile Schema

**Purpose**: Store user-specific data for personalized, context-aware responses

**New IndexedDB Table**: `userProfile`

**Schema**:
```javascript
{
  userProfile: 'key, data', // Single-row table with comprehensive user data
}
```

**Data Structure**:
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

  // Context for responses
  interests: ["gardening", "cooking", "reading"],

  // Health (integrate with existing profile)
  medications: [...],
  doctors: [...],

  // Family (integrate with existing)
  family: [...],

  // Memory & Learning
  conversationPreferences: {
    formality: "casual",
    verbosity: "moderate",
    topicsToAvoid: []
  },

  // Privacy
  shareLocation: true,
  shareBirthdate: true,

  // Metadata
  createdAt: "2025-11-07T10:00:00Z",
  updatedAt: "2025-11-07T10:00:00Z"
}
```

**Usage**:
- Auto-fill location for weather queries
- Calculate age-appropriate responses
- Use timezone for time-based queries
- Personalize greetings and responses
- Remember user preferences over time

---

### 4. JSON Schema for Response Generation

**Purpose**: Structure responses with metadata for better rendering and tracking

**Response Schema**:
```javascript
{
  // Response content
  text: "The weather in Paris tomorrow will be sunny with a high of 22°C.",

  // Metadata
  intent: "weather_query",
  confidence: 0.95,

  // Entities used in response
  entities: {
    location: "Paris",
    date: "2025-11-08",
    temperature: 22,
    conditions: "sunny"
  },

  // Data sources
  sources: [
    {
      service: "weather-api",
      endpoint: "/forecast",
      timestamp: "2025-11-07T10:00:00Z"
    }
  ],

  // Alternative responses
  alternatives: [
    "Tomorrow in Paris will be sunny with temperatures around 22°C.",
    "Expect sunny weather in Paris tomorrow, reaching 22°C."
  ],

  // Follow-up suggestions
  suggestions: [
    "Would you like the hourly forecast?",
    "Should I remind you about this tomorrow?"
  ],

  // UI hints
  ui: {
    type: "weather_card",
    icon: "sunny",
    color: "#FFD700"
  },

  // Logging & Analytics
  timestamp: "2025-11-07T10:00:00Z",
  processingTime: 150, // ms

  // Error handling
  fallback: "I'm having trouble getting the weather forecast right now.",
  error: null
}
```

**Benefits**:
- **Richer UI**: Render cards, icons, structured data
- **Better logging**: Track which services were used
- **Quality metrics**: Monitor confidence scores
- **A/B testing**: Try different response variations
- **Context preservation**: Keep entity information for follow-ups

---

## Implementation Plan

### Phase 1: Foundation (Week 1)
1. ✅ Create NLU service skeleton
2. ✅ Implement temporal parser (today, tomorrow, dates)
3. ✅ Implement question type classifier (what/when/why/how)
4. ✅ Update IndexedDB schema with userProfile table
5. ✅ Create user profile migration from existing settings

### Phase 2: Intent & Entity Recognition (Week 2)
1. Implement entity extractors:
   - Date/time entities
   - Location entities
   - Person entities (names, family members)
2. Create intent classifier with confidence scoring
3. Build slot filling mechanism
4. Add conversation context tracking

### Phase 3: API Services Layer (Week 3)
1. Create base API service class
2. Implement weather service (OpenWeatherMap or similar)
3. Implement geocoding service
4. Create service registry and routing
5. Add caching layer in IndexedDB

### Phase 4: Response Generation (Week 4)
1. Create response schema validator
2. Update conversation service to use JSON responses
3. Implement response rendering in companion-chat component
4. Add response alternatives and suggestions
5. Create UI components for rich responses (cards, icons)

### Phase 5: Integration & Testing (Week 5)
1. Integrate NLU into conversation flow
2. Connect API services to intents
3. Wire up user profile to response personalization
4. End-to-end testing of new architecture
5. Performance optimization

### Phase 6: LLM Integration (Week 6)
1. Integrate existing LLM service as fallback
2. Use LLM for unrecognized intents
3. Fine-tune prompts for context-aware responses
4. Implement hybrid rule-based + LLM approach

---

## Technical Decisions

### 1. Temporal Parsing Library
**Choice**: Use `date-fns` or `chrono-node` for temporal understanding
- Handles "tomorrow", "next week", "in 3 days"
- Respects user timezone
- Lightweight and battle-tested

### 2. Entity Extraction
**Choice**: Custom rule-based extractors + LLM fallback
- Start with regex patterns for common entities
- Use LLM for complex/ambiguous cases
- Keep extraction fast for real-time voice

### 3. API Services
**Choice**: Free-tier APIs with graceful degradation
- OpenWeatherMap (free tier: 1000 calls/day)
- NewsAPI (free tier: 100 calls/day)
- Store API keys in user profile (optional)

### 4. Caching Strategy
**Choice**: IndexedDB with TTL
- Cache API responses for 1-6 hours depending on data type
- Weather: 1 hour
- News: 6 hours
- Geocoding: 30 days (static)

---

## Migration Strategy

### Backward Compatibility
- Keep existing conversation-service.js functional
- New NLU service wraps existing intents
- Gradually migrate intents to new architecture
- No breaking changes to existing UI

### Data Migration
- Auto-migrate existing profile to userProfile table
- Keep old settings table for backward compat
- One-time migration on first load

### Feature Flags
- Enable new NLU via feature flag
- A/B test old vs new intent recognition
- Gradual rollout to users

---

## Success Metrics

1. **Intent Recognition Accuracy**: >90% for common queries
2. **Response Relevance**: User satisfaction rating >4/5
3. **API Success Rate**: >95% successful API calls
4. **Response Time**: <500ms for cached, <2s for API calls
5. **User Engagement**: Increased conversation length

---

## Next Steps

1. **Review & Approve**: Get feedback on this proposal
2. **Prioritize**: Which phase to start with?
3. **API Selection**: Choose weather/news API providers
4. **UI Mockups**: Design rich response components
5. **Start Implementation**: Begin Phase 1

---

## Questions for Discussion

1. Which external APIs should we prioritize? (Weather, News, Calendar?)
2. Should we use a paid LLM API (OpenAI) or keep it local-only?
3. Do we need user authentication for API key management?
4. Should we support multiple languages in Phase 1 or later?
5. Privacy: How much user data should we store?

