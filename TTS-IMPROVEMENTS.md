# TTS Control & News Reader Improvements

## Implemented Features

### 1. ✅ Push-to-Talk Interrupts TTS

**User clicks microphone while TTS is playing → TTS stops immediately**

Implementation in `src/components/voice-input.js`:
- When user clicks mic button, `ttsService.stop()` is called
- Dispatches `voice-interrupt` event to notify other components
- Provides immediate user control during long readings

### 2. ✅ Prevent Overlapping Audio

**New input before TTS starts → Previous TTS is cancelled**

Implementation in `src/components/companion-chat.js`:
- Request ID tracking system (`currentRequestId`)
- Each new voice input increments the request ID
- Old requests are invalidated and won't speak
- Checks at multiple points:
  - Before processing starts
  - After NLU processing completes
  - Before TTS generation

**Flow Example:**
```
User: "what's the news" (Request #1)
  → Processing...
  → Fetching articles...
User: "what's the weather" (Request #2 - interrupts)
  → Request #1 cancelled
  → Request #2 starts processing
  → Only Request #2 will speak
```

### 3. ✅ Fetch Full Article Content

**Reads actual article content, not just RSS headline/description**

Implementation in `src/plugins/news-reader-plugin.js`:
- New `fetchArticleContent(url)` method
- Uses RSS proxy to fetch BBC article pages
- Parses HTML to extract article paragraphs
- Tries multiple selectors for different BBC formats:
  - `[data-component="text-block"]`
  - `article`
  - `.article__body`
  - `.story-body`
- Falls back to RSS description if parsing fails
- Returns `isFull` flag to indicate if full content was retrieved

## Testing

### Test 1: Interrupt Long Article
1. Say "what's the news"
2. Say "read article number 1"
3. While article is being read, click microphone
4. ✅ Speech should stop immediately

### Test 2: Rapid Input Prevention
1. Say "what's the news"
2. Immediately say "what's the weather" (before first response)
3. ✅ Only weather response should be spoken

### Test 3: Full Article Content
1. Say "what's the news"
2. Say "read article number 2"
3. ✅ Should read the full BBC article content (longer than RSS summary)
4. Check console for: `[NewsReader] Article content length: XXXX chars`

## Console Logs to Monitor

**Voice Interruption:**
```
[VoiceInput] Stopped TTS for new voice input
[CompanionChat] Voice interrupt received - cancelling pending TTS
```

**Request Cancellation:**
```
[CompanionChat] New input request #2
[CompanionChat] Request #1 cancelled (current: #2)
[CompanionChat] Skipping TTS for outdated request #1 (current: #2)
```

**Article Fetching:**
```
[NewsReader] Fetching full article from: https://www.bbc.com/news/articles/...
[NewsReader] Article content length: 2547 chars
```

## Architecture Changes

### Voice Input Component
- Imports `ttsService`
- Stops TTS on `startListening()`
- Dispatches `voice-interrupt` custom event

### Companion Chat Component
- Tracks `currentRequestId` for request management
- Listens for `voice-interrupt` events
- Passes `requestId` through entire processing pipeline:
  - `handleVoiceInput` → `processInput` → `addCompanionMessage` → `speak`
- Checks request validity at each async boundary

### News Reader Plugin
- New `fetchArticleContent()` method
- Uses proxy endpoint for CORS-free HTML fetching
- Robust HTML parsing with multiple fallback selectors
- Graceful degradation to RSS description

## Benefits

1. **Better User Control**
   - User can interrupt long readings anytime
   - Natural push-to-talk interaction

2. **No Audio Conflicts**
   - Only one response speaks at a time
   - Rapid inputs don't queue up multiple TTS

3. **Richer Content**
   - Reads full BBC articles, not just summaries
   - More informative news reading experience

## Edge Cases Handled

- Request cancelled mid-processing → Won't speak
- Request cancelled after processing → Won't speak
- Article fetch fails → Falls back to RSS description
- BBC HTML structure changes → Multiple selector fallbacks
- User interrupts during generation → TTS stops gracefully

---

**Status:** ✅ All improvements implemented and ready for testing
**Server:** http://localhost:3001/
**Test Command:** "what's the news" → "read article number 1" → click mic
